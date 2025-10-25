import { Icon } from '@stem-packer/ui';
import type { Preferences } from '../../shared/preferences';
import type { PackingProgressEvent } from '../../shared/packing';
import { useTranslation } from '../hooks/useTranslation';

interface TopToolbarProps {
  onChooseFolder: () => void | Promise<void>;
  onPack: () => void | Promise<void>;
  onTargetSizeChange: (value: number) => void | Promise<void>;
  onFormatChange: (format: Preferences['format']) => void | Promise<void>;
  onAutoSplitChange: (value: boolean) => void | Promise<void>;
  targetSizeMB: number;
  format: Preferences['format'];
  autoSplit: boolean;
  disabled?: boolean;
  canPack: boolean;
  isPacking: boolean;
  isScanning: boolean;
  isCancellingPacking: boolean;
  progress: PackingProgressEvent | null;
  preferencesReady: boolean;
}

export function TopToolbar({
  onChooseFolder,
  onPack,
  onTargetSizeChange,
  onFormatChange,
  onAutoSplitChange,
  targetSizeMB,
  format,
  autoSplit,
  disabled,
  canPack,
  isPacking,
  isScanning,
  isCancellingPacking,
  progress,
  preferencesReady
}: TopToolbarProps) {
  const { t } = useTranslation();
  const wrapperClasses = disabled ? 'opacity-60 pointer-events-none' : '';

  const handleTargetSizeChange = (value: number) => {
    if (!preferencesReady) {
      return;
    }
    void onTargetSizeChange(value);
  };

  const handleFormatChange = (nextFormat: Preferences['format']) => {
    if (!preferencesReady || format === nextFormat) {
      return;
    }
    void onFormatChange(nextFormat);
  };

  const handleAutoSplitChange = (nextValue: boolean) => {
    if (!preferencesReady) {
      return;
    }
    void onAutoSplitChange(nextValue);
  };

  const chooseFolderLabel = isScanning ? t('button_scanning') : t('btn_choose_folder');
  const packLabel = isCancellingPacking
    ? t('button_cancelling_packing')
    : isPacking
      ? t('button_packing_active')
      : t('btn_pack');
  const progressPercent = progress?.percent ?? null;
  const roundedProgress = progressPercent !== null ? Math.round(progressPercent) : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${wrapperClasses}`}>
      <button
        className="btn btn-sm"
        type="button"
        onClick={() => {
          void onChooseFolder();
        }}
        disabled={isScanning}
      >
        <Icon name="folder_open" className="text-xl" />
        <span>{chooseFolderLabel}</span>
      </button>
      <label className="flex items-center gap-2 text-sm font-medium">
        <span>{t('lbl_target_size_mb')}</span>
        <input
          type="number"
          min={1}
          step={1}
          className="input input-bordered input-sm w-28"
          value={targetSizeMB}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (!Number.isNaN(nextValue) && nextValue > 0) {
              handleTargetSizeChange(nextValue);
            }
          }}
          disabled={!preferencesReady}
        />
      </label>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{t('settings_format')}</span>
        <div className="join">
          <button
            type="button"
            className={`btn btn-sm btn-outline join-item ${format === 'zip' ? 'btn-active btn-primary' : ''}`}
            onClick={() => {
              handleFormatChange('zip');
            }}
            aria-pressed={format === 'zip'}
            disabled={!preferencesReady}
          >
            {t('seg_zip')}
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-outline join-item ${format === '7z' ? 'btn-active btn-primary' : ''}`}
            onClick={() => {
              handleFormatChange('7z');
            }}
            aria-pressed={format === '7z'}
            disabled={!preferencesReady}
          >
            {t('seg_7z')}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <span>{t('toggle_autosplit')}</span>
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={autoSplit}
          onChange={(event) => {
            handleAutoSplitChange(event.target.checked);
          }}
          disabled={!preferencesReady}
        />
      </label>
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => {
          void onPack();
        }}
        disabled={!canPack || isPacking}
      >
        <Icon name="inventory_2" className="text-xl" />
        <span>{packLabel}</span>
        {isPacking && roundedProgress !== null ? (
          <span className="text-xs text-primary-content/80">{roundedProgress}%</span>
        ) : null}
      </button>
    </div>
  );
}
