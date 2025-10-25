import { Icon } from '@stem-packer/ui';
import type { AudioFileItem } from '../../shared/preferences';
import type { PackingProgressEvent, PackingResult } from '../../shared/packing';
import type { InfoTextFormState } from '../../shared/info';
import type { DroppedFolderResolutionError } from '../../shared/drop';
import type { ExcessNonSplittablePrediction } from '../../main/estimator';
import { DropSurface } from './DropSurface';
import { FilesTable } from './FilesTable';
import { MetadataForm } from './MetadataForm';
import { PackingProgress } from './PackingProgress';
import { PackingStatusAlerts, type PackingStatus } from './PackingStatusAlerts';
import { useTranslation } from '../hooks/useTranslation';

interface PackCardProps {
  active: boolean;
  panelId: string;
  labelledBy: string;
  files: AudioFileItem[];
  monoSplitTooLargeFiles: AudioFileItem[];
  monoSplitCandidates: AudioFileItem[];
  nonSplittableWarnings: Map<string, ExcessNonSplittablePrediction>;
  isScanning: boolean;
  onFolderDrop: (folderPath: string) => Promise<void> | void;
  onDropError: (reason: DroppedFolderResolutionError) => Promise<void> | void;
  onChooseFolder: () => Promise<void>;
  selectedFolder: string | null;
  ignoredCount: number;
  metadataFields: InfoTextFormState;
  onMetadataChange: (update: Partial<InfoTextFormState>) => void;
  onArtistBlur: () => void | Promise<void>;
  onStartPacking: () => Promise<void> | void;
  canStartPacking: boolean;
  packingStatus: PackingStatus;
  packingProgress: PackingProgressEvent | null;
  onCancelPacking: () => Promise<void> | void;
  isCancellingPacking: boolean;
  packingError: { name: string; message: string } | null;
  onDismissPackingError: () => void;
  lastPackResult: PackingResult | null;
  onDismissPackingNotice: () => void;
  onReset: () => Promise<void> | void;
  isZipFormat: boolean;
  showEmptyState: boolean;
}

export function PackCard({
  active,
  panelId,
  labelledBy,
  files,
  monoSplitTooLargeFiles,
  monoSplitCandidates,
  nonSplittableWarnings,
  isScanning,
  onFolderDrop,
  onDropError,
  onChooseFolder,
  selectedFolder,
  ignoredCount,
  metadataFields,
  onMetadataChange,
  onArtistBlur,
  onStartPacking,
  canStartPacking,
  packingStatus,
  packingProgress,
  onCancelPacking,
  isCancellingPacking,
  packingError,
  onDismissPackingError,
  lastPackResult,
  onDismissPackingNotice,
  onReset,
  isZipFormat,
  showEmptyState
}: PackCardProps) {
  const { t } = useTranslation();

  const percentComplete = Math.round(packingProgress?.percent ?? 0);
  const showProgress = packingStatus === 'packing';
  const hasFiles = files.length > 0;
  const hasSelection = Boolean(selectedFolder) && hasFiles;
  const showSelectionControls = !hasSelection;
  const showMonoSplitWarning = isZipFormat && monoSplitTooLargeFiles.length > 0;
  const showMonoSplitLegend = isZipFormat && monoSplitCandidates.length > 0;
  const chooseButtonPlaceholder = (
    <div className="btn btn-primary invisible select-none" aria-hidden="true">
      <Icon name="folder_open" className="text-2xl" />
      <span>{t('button_choose_folder')}</span>
    </div>
  );
  const canReset =
    hasSelection ||
    ignoredCount > 0 ||
    packingStatus !== 'idle' ||
    packingProgress !== null ||
    packingError !== null ||
    lastPackResult !== null;

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      className="w-full"
    >
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body gap-3 p-4">
          <div className="flex flex-col gap-3">
            {showSelectionControls ? (
              <DropSurface
                isActive={false}
                onFolderDrop={onFolderDrop}
                onDropError={onDropError}
                disabled={isScanning}
              />
            ) : null}
            {showMonoSplitWarning ? (
              <div className="alert alert-warning flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <Icon name="warning" className="text-2xl" />
                  <div className="space-y-1">
                    <p className="font-semibold">{t('warning_zip_mono_split_title')}</p>
                    <p className="text-sm text-base-content/80">
                      {t('warning_zip_mono_split_description')}
                    </p>
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="list"
                  aria-label={t('warning_zip_mono_split_list_label')}
                >
                  {monoSplitTooLargeFiles.map((file) => (
                    <span
                      key={file.relativePath}
                      className="badge badge-warning badge-outline"
                      role="listitem"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              {showSelectionControls ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    void onChooseFolder();
                  }}
                  disabled={isScanning}
                >
                  <Icon name="folder_open" className="text-2xl" />
                  <span>{isScanning ? t('button_scanning') : t('button_choose_folder')}</span>
                </button>
              ) : (
                chooseButtonPlaceholder
              )}
            </div>
            <FilesTable
              files={files}
              monoSplitCandidates={isZipFormat ? monoSplitCandidates : undefined}
              nonSplittableWarnings={nonSplittableWarnings}
              showMonoSplitLegend={showMonoSplitLegend}
              showEmptyState={showEmptyState}
              emptyStateKey="no_supported_audio_in_folder"
            />
            <MetadataForm fields={metadataFields} onChange={onMetadataChange} onArtistBlur={onArtistBlur} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  void onReset();
                }}
                disabled={isScanning || packingStatus === 'packing' || !canReset}
              >
                <Icon name="restart_alt" className="text-2xl" />
                <span>{t('button_reset')}</span>
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  void onStartPacking();
                }}
                disabled={!canStartPacking}
              >
                <Icon name="inventory_2" className="text-2xl" />
                <span>
                  {packingStatus === 'packing'
                    ? t('button_packing_active')
                    : t('button_start_packing')}
                </span>
              </button>
            </div>
            {showProgress ? (
              <PackingProgress
                progress={packingProgress}
                percentComplete={percentComplete}
                onCancel={onCancelPacking}
                isCancelling={isCancellingPacking}
              />
            ) : null}
            <PackingStatusAlerts
              status={packingStatus}
              packingError={packingError}
              lastPackResult={lastPackResult}
              onDismissNotice={onDismissPackingNotice}
              onDismissError={onDismissPackingError}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
