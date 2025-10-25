import { useEffect, useState } from 'react';
import { Icon } from '@stem-packer/ui';
import type { TranslationKey } from './hooks/useTranslation';
import { TranslationProvider, useTranslation } from './hooks/useTranslation';
import type {
  AppInfo,
  AudioFileItem,
  Preferences,
  ScanResult
} from '../shared/preferences';
import { DEFAULT_PREFERENCES } from '../shared/preferences';
import { DEFAULT_INFO_TEXT_FORM, type InfoTextFormState } from '../shared/info';
import type { CollisionCheckPayload } from '../shared/collisions';
import { estimateArchiveCount } from '../main/estimator';
import { useToast } from './hooks/useToast';
import type { PackingProgressEvent, PackingResult } from '../shared/packing';
import { PackCard } from './components/PackCard';
import { PreferencesCard } from './components/PreferencesCard';
import { Header } from './components/Header';
import { AboutModal } from './components/AboutModal';
import { CollisionDialog, type CollisionPrompt } from './components/CollisionDialog';
import { SplitDecisionDialog, type SplitDecisionPrompt } from './components/SplitDecisionDialog';
import { resolveDroppedFolder } from './hooks/useDroppedPaths';
import type { PackingStatus } from './components/PackingStatusAlerts';

interface PerformScanOptions {
  suppressSplitPrompt?: boolean;
}

type PackingErrorPayload = { name: string; message: string } | null;

type AppTab = 'pack' | 'preferences';

function AppContent() {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [files, setFiles] = useState<AudioFileItem[]>([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [collisionPrompt, setCollisionPrompt] = useState<CollisionPrompt | null>(null);
  const [splitDecisionPrompt, setSplitDecisionPrompt] = useState<SplitDecisionPrompt | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('pack');
  const [metadataFields, setMetadataFields] = useState<InfoTextFormState>(DEFAULT_INFO_TEXT_FORM);
  const [packingStatus, setPackingStatus] = useState<PackingStatus>('idle');
  const [packingProgress, setPackingProgress] = useState<PackingProgressEvent | null>(null);
  const [packingError, setPackingError] = useState<PackingErrorPayload>(null);
  const [lastPackResult, setLastPackResult] = useState<PackingResult | null>(null);
  const [isCancellingPacking, setIsCancellingPacking] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const preventWindowNavigation = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    window.addEventListener('dragover', preventWindowNavigation);
    window.addEventListener('drop', preventWindowNavigation);

    return () => {
      window.removeEventListener('dragover', preventWindowNavigation);
      window.removeEventListener('drop', preventWindowNavigation);
    };
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const [info, prefs, artistProfile] = await Promise.all([
        window.stemPacker.getAppInfo(),
        window.stemPacker.getPreferences(),
        window.stemPacker.getArtist()
      ]);
      setAppInfo(info);
      setPreferences(prefs);
      setMetadataFields((current) => ({ ...current, artist: artistProfile.artist }));
    }

    bootstrap().catch((error) => {
      console.error('Failed to initialize application', error);
    });
  }, []);

  useEffect(() => {
    const unsubscribeProgress = window.stemPacker.onPackingProgress((event) => {
      setPackingProgress(event);
      if (event.state === 'packing') {
        setPackingStatus('packing');
      } else if (event.state === 'completed') {
        setPackingStatus('completed');
      } else if (event.state === 'cancelled') {
        setPackingStatus('cancelled');
        setLastPackResult(null);
        setIsCancellingPacking(false);
        showToast(t('toast_packing_cancelled'));
      }

      if (event.state !== 'packing') {
        setIsCancellingPacking(false);
      }
    });

    const unsubscribeResult = window.stemPacker.onPackingResult((result) => {
      setLastPackResult(result);
      setPackingStatus('completed');
      setIsCancellingPacking(false);
      setPackingProgress((current) =>
        current
          ? { ...current, state: 'completed', percent: 100 }
          : {
              state: 'completed',
              current: result.outputPaths.length,
              total: result.outputPaths.length,
              percent: 100,
              message: t('packing_progress_waiting'),
              currentArchive: null
            }
      );
      showToast(t('toast_packing_success', { count: result.outputPaths.length }));
    });

    const unsubscribeError = window.stemPacker.onPackingError((error) => {
      setPackingError(error);
      setPackingStatus('error');
      setPackingProgress(null);
      setLastPackResult(null);
      setIsCancellingPacking(false);
      showToast(t('toast_packing_failed'));
    });

    return () => {
      unsubscribeProgress();
      unsubscribeResult();
      unsubscribeError();
    };
  }, [showToast, t]);

  const handleMetadataChange = (update: Partial<InfoTextFormState>) => {
    setMetadataFields((current) => ({ ...current, ...update }));
  };

  const persistArtist = async () => {
    try {
      const profile = await window.stemPacker.saveArtist(metadataFields.artist);
      setMetadataFields((current) => ({ ...current, artist: profile.artist }));
    } catch (error) {
      console.error('Failed to persist artist name', error);
    }
  };

  const performScan = async (
    folderPath: string,
    overridePreferences?: Preferences,
    options: PerformScanOptions = {}
  ) => {
    setIsScanning(true);
    setIgnoredCount(0);
    setCollisionPrompt(null);
    setSplitDecisionPrompt(null);
    setPackingStatus('idle');
    setPackingProgress(null);
    setPackingError(null);
    setLastPackResult(null);
    setIsCancellingPacking(false);
    setFiles([]);
    setSelectedFolder(null);
    try {
      const result: ScanResult = await window.stemPacker.scanFolder(folderPath);
      if (result.files.length === 0) {
        const warningMessage =
          result.ignoredCount > 0
            ? t('toast_scan_no_audio_with_ignored', { ignoredCount: result.ignoredCount })
            : t('toast_scan_no_audio');
        showToast(warningMessage);
        await resetToIdle({ toastKey: null });
        return;
      }

      setFiles(result.files);
      setSelectedFolder(result.folderPath);
      setIgnoredCount(result.ignoredCount);
      const activePreferences = overridePreferences ?? preferences ?? DEFAULT_PREFERENCES;

      const estimate = estimateArchiveCount(result.files, activePreferences);
      const hasSplits = estimate.splitCount > 0;
      const hasIgnored = result.ignoredCount > 0;
      const messageKey = hasSplits
        ? hasIgnored
          ? 'toast_archive_estimate_split_ignored'
          : 'toast_archive_estimate_split'
        : hasIgnored
          ? 'toast_archive_estimate_ignored'
          : 'toast_archive_estimate';

      showToast(
        t(messageKey, {
          zipCount: estimate.zipArchiveCount,
          sevenZipCount: estimate.sevenZipVolumeCount,
          splitCount: estimate.splitCount,
          ignoredCount: result.ignoredCount
        })
      );

      const collisionPayload: CollisionCheckPayload = {
        inputFolder: result.folderPath,
        format: activePreferences.format,
        outputDir: activePreferences.outputDir
      };

      try {
        const collisionResult = await window.stemPacker.detectCollisions(collisionPayload);
        if (collisionResult.hasCollisions && collisionResult.kind) {
          setCollisionPrompt({
            payload: collisionPayload,
            kind: collisionResult.kind,
            collisionCount: collisionResult.collisionCount,
            outputDir: collisionResult.outputDir
          });
        }
      } catch (error) {
        console.error('Failed to detect output collisions', error);
      }

      if (
        !options.suppressSplitPrompt &&
        !activePreferences.auto_split_multichannel_to_mono &&
        estimate.splitCandidateCount > 0
      ) {
        setSplitDecisionPrompt({
          folderPath: result.folderPath,
          candidateCount: estimate.splitCandidateCount
        });
      }
    } catch (error) {
      console.error('Failed to scan folder', error);
      showToast(t('toast_scan_failed'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    const folderPath = resolveDroppedFolder(paths);
    if (!folderPath) {
      return;
    }

    await performScan(folderPath);
  };

  const handleChooseFolder = async () => {
    const result = await window.stemPacker.chooseInputFolder();
    if (!result.canceled && result.folderPath) {
      await performScan(result.folderPath);
    }
  };

  const savePreferences = async () => {
    if (!preferences) {
      return;
    }
    setIsSavingPreferences(true);
    try {
      const updated = await window.stemPacker.savePreferences(preferences);
      setPreferences(updated);
      showToast(t('toast_preferences_saved'));
    } catch (error) {
      console.error('Failed to save preferences', error);
      showToast(t('toast_preferences_failed'));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleOverwriteCollisions = async () => {
    if (!collisionPrompt) {
      return;
    }

    try {
      await window.stemPacker.overwriteCollisions(collisionPrompt.payload);
      showToast(t('toast_overwrite_done'));
      setCollisionPrompt(null);
    } catch (error) {
      console.error('Failed to overwrite existing outputs', error);
      showToast(t('toast_overwrite_failed'));
    }
  };

  const resetToIdle = async (options: { toastKey?: TranslationKey | null } = {}) => {
    const { toastKey } = options;
    setCollisionPrompt(null);
    setSplitDecisionPrompt(null);
    setFiles([]);
    setSelectedFolder(null);
    setIgnoredCount(0);
    setPackingStatus('idle');
    setPackingProgress(null);
    setPackingError(null);
    setLastPackResult(null);
    setIsCancellingPacking(false);
    setMetadataFields((current) => ({ ...DEFAULT_INFO_TEXT_FORM, artist: current.artist }));
    if (toastKey === null) {
      return;
    }
    const key = toastKey ?? 'toast_action_cancelled';
    showToast(t(key));
  };

  const handleAbortCollisions = async () => {
    await resetToIdle();
  };

  const handleSplitDecisionSplit = async () => {
    if (!splitDecisionPrompt) {
      return;
    }

    const prompt = splitDecisionPrompt;
    setSplitDecisionPrompt(null);

    try {
      const updated = await window.stemPacker.savePreferences({
        auto_split_multichannel_to_mono: true
      });
      setPreferences(updated);
      await performScan(prompt.folderPath, updated);
    } catch (error) {
      console.error('Failed to enable multichannel auto split', error);
      showToast(t('toast_preferences_failed'));
    }
  };

  const handleSplitDecisionSevenZip = async () => {
    if (!splitDecisionPrompt) {
      return;
    }

    const prompt = splitDecisionPrompt;
    setSplitDecisionPrompt(null);

    try {
      const updated = await window.stemPacker.savePreferences({ format: '7z' });
      setPreferences(updated);
      await performScan(prompt.folderPath, updated, { suppressSplitPrompt: true });
    } catch (error) {
      console.error('Failed to switch to 7z volumes', error);
      showToast(t('toast_preferences_failed'));
    }
  };

  const handleSplitDecisionCancel = async () => {
    await resetToIdle();
  };

  const handleStartPacking = async () => {
    if (!selectedFolder || files.length === 0 || !preferences) {
      showToast(t('toast_packing_unavailable'));
      return;
    }

    setPackingStatus('packing');
    setPackingError(null);
    setLastPackResult(null);
    setIsCancellingPacking(false);
    setPackingProgress({
      state: 'packing',
      current: 0,
      total: files.length,
      percent: 0,
      message: t('packing_progress_waiting'),
      currentArchive: null
    });

    try {
      await window.stemPacker.startPacking({
        folderPath: selectedFolder,
        files,
        info: { ...metadataFields },
        artist: metadataFields.artist
      });
    } catch (error) {
      console.error('Failed to start packing', error);
      const err = error as Error;
      setPackingStatus('error');
      setPackingError({
        name: err?.name ?? 'Error',
        message: err?.message ?? String(error)
      });
      setPackingProgress(null);
      setIsCancellingPacking(false);
      showToast(t('toast_packing_failed'));
    }
  };

  const handleCancelPacking = async () => {
    setIsCancellingPacking(true);
    try {
      const cancelled = await window.stemPacker.cancelPacking();
      if (!cancelled) {
        showToast(t('toast_packing_cancel_failed'));
      }
    } catch (error) {
      console.error('Failed to cancel packing', error);
      showToast(t('toast_packing_cancel_failed'));
    } finally {
      setIsCancellingPacking(false);
    }
  };

  const handleDismissPackingNotice = () => {
    setPackingStatus('idle');
    setLastPackResult(null);
    setPackingProgress(null);
  };

  const handleDismissPackingError = () => {
    setPackingError(null);
    setPackingStatus('idle');
  };

  const canStartPacking =
    files.length > 0 &&
    Boolean(selectedFolder) &&
    Boolean(preferences) &&
    !isScanning &&
    packingStatus !== 'packing';

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        <Header onAboutClick={() => setAboutOpen(true)} appInfo={appInfo} />
        <div className="flex flex-col gap-4">
          <div role="tablist" className="tabs tabs-boxed w-fit">
            <button
              id="pack-tab"
              role="tab"
              type="button"
              className={`tab ${activeTab === 'pack' ? 'tab-active' : ''}`}
              aria-selected={activeTab === 'pack'}
              aria-controls="pack-panel"
              onClick={() => setActiveTab('pack')}
            >
              {t('tab_pack')}
            </button>
            <button
              id="preferences-tab"
              role="tab"
              type="button"
              className={`tab ${activeTab === 'preferences' ? 'tab-active' : ''}`}
              aria-selected={activeTab === 'preferences'}
              aria-controls="preferences-panel"
              onClick={() => setActiveTab('preferences')}
            >
              {t('tab_preferences')}
            </button>
          </div>
          <div className="space-y-6">
            <PackCard
              active={activeTab === 'pack'}
              panelId="pack-panel"
              labelledBy="pack-tab"
              files={files}
              isScanning={isScanning}
              onDrop={handleDrop}
              onChooseFolder={handleChooseFolder}
              selectedFolder={selectedFolder}
              ignoredCount={ignoredCount}
              metadataFields={metadataFields}
              onMetadataChange={handleMetadataChange}
              onArtistBlur={persistArtist}
              onStartPacking={handleStartPacking}
              canStartPacking={canStartPacking}
              packingStatus={packingStatus}
              packingProgress={packingProgress}
              onCancelPacking={handleCancelPacking}
              isCancellingPacking={isCancellingPacking}
              packingError={packingError}
              onDismissPackingError={handleDismissPackingError}
              lastPackResult={lastPackResult}
              onDismissPackingNotice={handleDismissPackingNotice}
              onReset={() => {
                void resetToIdle();
              }}
            />
            <PreferencesCard
              active={activeTab === 'preferences'}
              panelId="preferences-panel"
              labelledBy="preferences-tab"
              preferences={preferences}
              onChange={setPreferences}
              onSave={savePreferences}
              isSaving={isSavingPreferences}
            />
          </div>
        </div>
      </section>

      <div className={toast.visible && toast.message ? 'toast toast-start' : 'hidden'}>
        {toast.message ? (
          <div className="alert alert-info">
            <Icon name="info" className="text-xl" />
            <span>{toast.message}</span>
          </div>
        ) : null}
      </div>

      <CollisionDialog
        prompt={collisionPrompt}
        onIgnore={handleOverwriteCollisions}
        onAbort={handleAbortCollisions}
      />
      <SplitDecisionDialog
        prompt={splitDecisionPrompt}
        onChooseSplit={handleSplitDecisionSplit}
        onChooseSevenZip={handleSplitDecisionSevenZip}
        onCancel={handleSplitDecisionCancel}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} appInfo={appInfo} />
    </main>
  );
}

export default function App() {
  return (
    <TranslationProvider locale="en">
      <AppContent />
    </TranslationProvider>
  );
}
