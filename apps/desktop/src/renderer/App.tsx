import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { TranslationProvider, useTranslation } from './hooks/useTranslation';
import type { Translator } from './hooks/useTranslation';
import { Icon } from '@stem-packer/ui';
import type {
  AppInfo,
  AudioFileItem,
  Preferences,
  ScanResult
} from '../shared/preferences';
import { DEFAULT_PREFERENCES } from '../shared/preferences';
import { estimateArchiveCount } from '../main/estimator';
import { useToast } from './hooks/useToast';

const sizeKeys = ['file_size_bytes', 'file_size_kb', 'file_size_mb', 'file_size_gb'] as const;

function formatBytes(size: number, t: Translator) {
  if (size === 0) {
    return t(sizeKeys[0], { value: '0' });
  }

  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < sizeKeys.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return t(sizeKeys[unitIndex], { value: formatted });
}

function DragAndDropArea({
  isActive,
  onDrop,
  disabled
}: {
  isActive: boolean;
  onDrop: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    const paths = files.map((file) => (file as File & { path?: string }).path).filter(Boolean) as string[];
    if (paths.length > 0) {
      onDrop(paths);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 border-dashed ${
        isDragging || isActive ? 'border-primary bg-primary/10' : 'border-base-content/30'
      } p-10 transition-colors`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="presentation"
    >
      <div className="flex flex-col items-center gap-3 text-center text-base-content/80">
        <Icon name="file_open" className="text-5xl" />
        <p className="text-lg font-medium">{t('drag_drop_title')}</p>
        <p>{t('drag_drop_description')}</p>
      </div>
    </div>
  );
}

function FilesTable({ files }: { files: AudioFileItem[] }) {
  const { t } = useTranslation();

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-base-content/20 p-6 text-center text-base-content/60">
        {t('table_empty_state')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th className="w-1/2">{t('table_column_name')}</th>
            <th>{t('table_column_type')}</th>
            <th className="text-right">{t('table_column_size')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow key={file.relativePath} file={file} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ file }: { file: AudioFileItem }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="align-top">
        <div className="flex flex-col">
          <span className="font-medium">{file.name}</span>
          <span className="text-xs text-base-content/60">{file.relativePath}</span>
        </div>
      </td>
      <td className="align-top uppercase text-base-content/70">{file.extension.replace('.', '')}</td>
      <td className="align-top text-right text-base-content/70">
        {formatBytes(file.sizeBytes, t)}
      </td>
    </tr>
  );
}

function SettingsPanel({
  preferences,
  onChange,
  onSave,
  isSaving
}: {
  preferences: Preferences | null;
  onChange: (prefs: Preferences) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}) {
  const { t } = useTranslation();

  if (!preferences) {
    return null;
  }

  const handleChange = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    onChange({ ...preferences, [key]: value });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('settings_target_size')}</span>
            <span className="label-text-alt text-base-content/60">{t('settings_target_size_hint')}</span>
          </div>
          <input
            type="number"
            min={1}
            step={1}
            className="input input-bordered"
            value={preferences.targetSizeMB}
            onChange={(event) => handleChange('targetSizeMB', Number(event.target.value))}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('settings_format')}</span>
          </div>
          <select
            className="select select-bordered"
            value={preferences.format}
            onChange={(event) => handleChange('format', event.target.value as Preferences['format'])}
          >
            <option value="zip">{t('settings_format_zip')}</option>
            <option value="7z">{t('settings_format_7z')}</option>
          </select>
        </label>
      </div>
      <label className="form-control">
        <div className="label">
          <span className="label-text">{t('settings_output_directory')}</span>
          <span className="label-text-alt text-base-content/60">{t('settings_output_directory_hint')}</span>
        </div>
        <input
          type="text"
          className="input input-bordered"
          value={preferences.outputDir}
          onChange={(event) => handleChange('outputDir', event.target.value)}
          placeholder={t('settings_output_directory_placeholder')}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control">
          <div className="label cursor-pointer">
            <span className="label-text">{t('settings_auto_split')}</span>
          </div>
          <input
            type="checkbox"
            className="toggle"
            checked={preferences.auto_split_multichannel_to_mono}
            onChange={(event) =>
              handleChange('auto_split_multichannel_to_mono', event.target.checked)
            }
          />
          <span className="mt-2 text-sm text-base-content/60">
            {t('settings_auto_split_hint')}
          </span>
        </label>
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={preferences.ignore_enabled}
              onChange={(event) => handleChange('ignore_enabled', event.target.checked)}
            />
            <span className="label-text">{t('settings_ignore_enabled')}</span>
          </label>
          <span className="mt-1 text-sm text-base-content/60">
            {t('settings_ignore_enabled_hint')}
          </span>
        </div>
      </div>
      <label className="form-control">
        <div className="label">
          <span className="label-text">{t('settings_ignore_patterns')}</span>
        </div>
        <textarea
          className="textarea textarea-bordered h-32 font-mono text-sm"
          value={preferences.ignore_globs.join('\n')}
          onChange={(event) =>
            handleChange(
              'ignore_globs',
              event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
            )
          }
        />
        <span className="mt-1 text-sm text-base-content/60">
          {t('settings_ignore_patterns_hint')}
        </span>
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? t('button_saving') : t('button_save_preferences')}
        </button>
      </div>
    </form>
  );
}

function Header({ onAboutClick, appInfo }: { onAboutClick: () => void; appInfo: AppInfo | null }) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Icon name="library_music" className="text-4xl" />
        <div>
          <h1 className="text-3xl font-semibold">{t('app_header_title')}</h1>
          {appInfo ? (
            <p className="text-sm text-base-content/60">
              {t('app_header_version', { version: appInfo.version })}
            </p>
          ) : null}
        </div>
      </div>
      <button className="btn btn-ghost" onClick={onAboutClick} type="button">
        <Icon name="info" className="text-2xl" />
        <span>{t('button_about')}</span>
      </button>
    </header>
  );
}

function AboutModal({ open, onClose, appInfo }: { open: boolean; onClose: () => void; appInfo: AppInfo | null }) {
  const { t } = useTranslation();

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`} onClose={() => onClose()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('about_title')}</h3>
        <p className="py-4 text-base-content/80">{t('about_description')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/70">
          {appInfo ? (
            <li>
              {t('about_version', { version: appInfo.version })}
            </li>
          ) : null}
          <li>{t('about_license')}</li>
          <li>{t('about_links')}</li>
        </ul>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            {t('button_close')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={() => onClose()}>
        <button type="submit">{t('button_close')}</button>
      </form>
    </dialog>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [files, setFiles] = useState<AudioFileItem[]>([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    async function bootstrap() {
      const [info, prefs] = await Promise.all([
        window.stemPacker.getAppInfo(),
        window.stemPacker.getPreferences()
      ]);
      setAppInfo(info);
      setPreferences(prefs);
      if (prefs.lastInputDir) {
        await performScan(prefs.lastInputDir, prefs);
      }
    }

    bootstrap().catch((error) => {
      console.error('Failed to initialize application', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performScan = async (folderPath: string, overridePreferences?: Preferences) => {
    setIsScanning(true);
    setIgnoredCount(0);
    try {
      const result: ScanResult = await window.stemPacker.scanFolder(folderPath);
      setFiles(result.files);
      setSelectedFolder(result.folderPath);
      setIgnoredCount(result.ignoredCount);
      const activePreferences = overridePreferences ?? preferences ?? DEFAULT_PREFERENCES;
      setPreferences((current) => {
        if (current) {
          return { ...current, lastInputDir: result.folderPath };
        }
        if (overridePreferences) {
          return { ...overridePreferences, lastInputDir: result.folderPath };
        }
        return current;
      });

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
    await performScan(paths[0]);
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

  return (
    <main className="min-h-screen bg-base-300 text-base-content">
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        <Header onAboutClick={() => setAboutOpen(true)} appInfo={appInfo} />

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="flex flex-col gap-4">
              <DragAndDropArea isActive={files.length > 0} onDrop={handleDrop} disabled={isScanning} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/70">
                  <span>
                    {selectedFolder
                      ? t('selected_folder_label', { path: selectedFolder })
                      : t('selected_folder_empty')}
                  </span>
                  {ignoredCount > 0 ? (
                    <span className="badge badge-outline badge-secondary">
                      {t('badge_ignored_count', { count: ignoredCount })}
                    </span>
                  ) : null}
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleChooseFolder}
                  disabled={isScanning}
                >
                  <Icon name="folder_open" className="text-2xl" />
                  <span>{isScanning ? t('button_scanning') : t('button_choose_folder')}</span>
                </button>
              </div>
              <FilesTable files={files} />
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="text-2xl font-semibold">{t('settings_title')}</h2>
            <p className="text-sm text-base-content/70">{t('settings_description')}</p>
            <SettingsPanel
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
