import { useEffect, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
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
import { DEFAULT_INFO_TEXT_FORM, type InfoTextFormState } from '../shared/info';
import type { CollisionCheckPayload, CollisionKind } from '../shared/collisions';
import { estimateArchiveCount } from '../main/estimator';
import { useToast } from './hooks/useToast';
import type { PackingProgressEvent, PackingResult } from '../shared/packing';

type PackingStatus = 'idle' | 'packing' | 'completed' | 'cancelled' | 'error';

type PackingErrorPayload = { name: string; message: string } | null;

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

interface CollisionPrompt {
  payload: CollisionCheckPayload;
  kind: CollisionKind;
  collisionCount: number;
  outputDir: string;
}

interface SplitDecisionPrompt {
  folderPath: string;
  candidateCount: number;
}

interface PerformScanOptions {
  suppressSplitPrompt?: boolean;
}

function normalizeFileUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'file:') {
      return null;
    }

    const host = url.host && url.host !== 'localhost' ? `//${url.host}` : '';
    let pathname = decodeURI(url.pathname);

    if (/^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }

    const rawPath = `${host}${pathname}`;
    const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
    return isWindows ? rawPath.replace(/\//g, '\\') : rawPath;
  } catch (error) {
    console.error('Failed to decode dropped URI', uri, error);
    return null;
  }
}

function extractDroppedPaths(event: ReactDragEvent<HTMLDivElement>): string[] {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return [];
  }

  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const fromUris = uriList
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map(normalizeFileUri)
      .filter((value): value is string => Boolean(value));

    if (fromUris.length > 0) {
      return fromUris;
    }
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((path): path is string => typeof path === 'string' && path.length > 0);
  }

  return [];
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

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    setIsDragging(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) {
      return;
    }

    const paths = extractDroppedPaths(event);
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

function MetadataForm({
  fields,
  onChange,
  onArtistBlur
}: {
  fields: InfoTextFormState;
  onChange: (update: Partial<InfoTextFormState>) => void;
  onArtistBlur?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  const handleArtistBlur = () => {
    if (onArtistBlur) {
      void onArtistBlur();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">{t('metadata_section_title')}</h3>
        <p className="text-sm text-base-content/70">{t('metadata_section_description')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_title')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_artist')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.artist}
            onChange={(event) => onChange({ artist: event.target.value })}
            onBlur={handleArtistBlur}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_album')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.album}
            onChange={(event) => onChange({ album: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_bpm')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.bpm}
            onChange={(event) => onChange({ bpm: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_key')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.key}
            onChange={(event) => onChange({ key: event.target.value })}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('metadata_field_license')}</span>
          </div>
          <input
            type="text"
            className="input input-bordered"
            value={fields.license}
            onChange={(event) => onChange({ license: event.target.value })}
          />
        </label>
        <label className="form-control md:col-span-2">
          <div className="label">
            <span className="label-text">{t('metadata_field_attribution')}</span>
          </div>
          <textarea
            className="textarea textarea-bordered h-24"
            value={fields.attribution}
            onChange={(event) => onChange({ attribution: event.target.value })}
          />
        </label>
      </div>
    </div>
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

function PackCard({
  active,
  panelId,
  labelledBy,
  files,
  isScanning,
  onDrop,
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
  onDismissPackingNotice
}: {
  active: boolean;
  panelId: string;
  labelledBy: string;
  files: AudioFileItem[];
  isScanning: boolean;
  onDrop: (paths: string[]) => Promise<void> | void;
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
  packingError: PackingErrorPayload;
  onDismissPackingError: () => void;
  lastPackResult: PackingResult | null;
  onDismissPackingNotice: () => void;
}) {
  const { t } = useTranslation();

  const percentComplete = Math.round(packingProgress?.percent ?? 0);
  const showProgress = packingStatus === 'packing';
  const showSuccess = packingStatus === 'completed' && lastPackResult;
  const showCancelled = packingStatus === 'cancelled';
  const showError = packingStatus === 'error' && packingError;

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      className="w-full"
    >
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="flex flex-col gap-4">
            <DragAndDropArea isActive={files.length > 0} onDrop={onDrop} disabled={isScanning} />
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
                onClick={() => {
                  void onChooseFolder();
                }}
                disabled={isScanning}
              >
                <Icon name="folder_open" className="text-2xl" />
                <span>{isScanning ? t('button_scanning') : t('button_choose_folder')}</span>
              </button>
            </div>
            <FilesTable files={files} />
            <MetadataForm
              fields={metadataFields}
              onChange={onMetadataChange}
              onArtistBlur={onArtistBlur}
            />
            <div className="flex justify-end">
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
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="font-semibold">{t('packing_progress_title')}</p>
                    <p className="text-sm text-base-content/80">
                      {packingProgress?.message ?? t('packing_progress_waiting')}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {t('packing_progress_detail', {
                        current: packingProgress?.current ?? 0,
                        total: packingProgress?.total ?? 0
                      })}
                    </p>
                    {packingProgress?.currentArchive ? (
                      <p className="text-xs text-base-content/60">
                        {t('packing_progress_current_archive', {
                          name: packingProgress.currentArchive
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-3 md:w-72">
                    <progress
                      className="progress progress-primary w-full"
                      value={percentComplete}
                      max={100}
                      aria-label={t('packing_progress_label')}
                    />
                    <div className="flex items-center justify-between text-xs text-base-content/70">
                      <span>{t('packing_progress_percent', { percent: percentComplete })}</span>
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => {
                          void onCancelPacking();
                        }}
                        disabled={isCancellingPacking}
                      >
                        <Icon name="cancel" className="text-lg" />
                        <span>
                          {isCancellingPacking
                            ? t('button_cancelling_packing')
                            : t('button_cancel_packing')}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {showSuccess && lastPackResult ? (
              <div className="alert alert-success">
                <Icon name="check_circle" className="text-xl" />
                <div className="flex flex-col text-sm">
                  <span>
                    {t('packing_success_message', {
                      count: lastPackResult.outputPaths.length
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onDismissPackingNotice}
                >
                  {t('button_close')}
                </button>
              </div>
            ) : null}
            {showCancelled ? (
              <div className="alert alert-info">
                <Icon name="info" className="text-xl" />
                <span className="text-sm">{t('packing_cancelled_message')}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onDismissPackingNotice}
                >
                  {t('button_close')}
                </button>
              </div>
            ) : null}
            {showError && packingError ? (
              <div className="alert alert-error">
                <Icon name="error" className="text-xl" />
                <div className="flex flex-col text-sm">
                  <span>{t('packing_error_message')}</span>
                  <span className="text-xs text-base-content/70">{packingError.message}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onDismissPackingError}
                >
                  {t('button_close')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreferencesCard({
  active,
  panelId,
  labelledBy,
  preferences,
  onChange,
  onSave,
  isSaving
}: {
  active: boolean;
  panelId: string;
  labelledBy: string;
  preferences: Preferences | null;
  onChange: (prefs: Preferences) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
      className="w-full"
    >
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="text-2xl font-semibold">{t('settings_title')}</h2>
          <p className="text-sm text-base-content/70">{t('settings_description')}</p>
          <SettingsPanel
            preferences={preferences}
            onChange={onChange}
            onSave={onSave}
            isSaving={isSaving}
          />
        </div>
      </div>
    </section>
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
    <dialog className={`modal ${open ? 'modal-open' : ''}`} open={open} onClose={() => onClose()}>
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

function CollisionDialog({
  prompt,
  onIgnore,
  onAbort
}: {
  prompt: CollisionPrompt | null;
  onIgnore: () => void | Promise<void>;
  onAbort: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  if (!prompt) {
    return null;
  }

  const messageKey =
    prompt.kind === 'zip' ? 'dialog_overwrite_message_zip' : 'dialog_overwrite_message_7z';
  const messageParams: Record<string, string | number> =
    prompt.kind === 'zip'
      ? { count: prompt.collisionCount, directory: prompt.outputDir }
      : { directory: prompt.outputDir };

  return (
    <dialog className="modal modal-open" open onClose={() => onAbort()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('dialog_overwrite_title')}</h3>
        <p className="py-4 text-base-content/80">{t(messageKey, messageParams)}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => onAbort()}>
            {t('dialog_overwrite_abort')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onIgnore()}>
            {t('dialog_overwrite_ignore')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={() => onAbort()}>
        <button type="submit">{t('dialog_overwrite_abort')}</button>
      </form>
    </dialog>
  );
}

function SplitDecisionDialog({
  prompt,
  onChooseSplit,
  onChooseSevenZip,
  onCancel
}: {
  prompt: SplitDecisionPrompt | null;
  onChooseSplit: () => void | Promise<void>;
  onChooseSevenZip: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  if (!prompt) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open onClose={() => onCancel()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('dialog_multichannel_title')}</h3>
        <p className="py-4 text-base-content/80">
          {t('dialog_multichannel_message', { count: prompt.candidateCount })}
        </p>
        <div className="modal-action flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn" onClick={() => onCancel()}>
            {t('dialog_multichannel_cancel')}
          </button>
          <button type="button" className="btn" onClick={() => onChooseSevenZip()}>
            {t('dialog_multichannel_choose_7z')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onChooseSplit()}>
            {t('dialog_multichannel_choose_split')}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={() => onCancel()}>
        <button type="submit">{t('dialog_multichannel_cancel')}</button>
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
  const [collisionPrompt, setCollisionPrompt] = useState<CollisionPrompt | null>(null);
  const [splitDecisionPrompt, setSplitDecisionPrompt] = useState<SplitDecisionPrompt | null>(
    null
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'pack' | 'preferences'>('pack');
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
    try {
      const result: ScanResult = await window.stemPacker.scanFolder(folderPath);
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

  const resetToIdle = async () => {
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
    showToast(t('toast_action_cancelled'));
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
