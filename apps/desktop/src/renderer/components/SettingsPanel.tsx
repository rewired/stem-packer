import type { Preferences } from '../../shared/preferences';
import { useTranslation } from '../hooks/useTranslation';

interface SettingsPanelProps {
  preferences: Preferences | null;
  onChange: (prefs: Preferences) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function SettingsPanel({ preferences, onChange, onSave, isSaving }: SettingsPanelProps) {
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
            <span className="label-text sr-only">{t('settings_target_size')}</span>
            <span className="label-text-alt text-base-content/60">{t('settings_target_size_hint')}</span>
          </div>
          <input
            type="number"
            min={1}
            step={1}
            className="input input-bordered"
            value={preferences.targetSizeMB}
            onChange={(event) => handleChange('targetSizeMB', Number(event.target.value))}
            placeholder={t('settings_target_size')}
          />
        </label>
        <label className="form-control">
          <div className="label">
            <span className="label-text">{t('settings_format')}</span>
          </div>
          <select
            className="select select-bordered select-sm"
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
      <label className="form-control">
        <div className="label cursor-pointer">
          <span className="label-text">{t('settings_auto_split')}</span>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={preferences.auto_split_multichannel_to_mono}
          onChange={(event) => handleChange('auto_split_multichannel_to_mono', event.target.checked)}
        />
        <span className="mt-2 text-sm text-base-content/60">{t('settings_auto_split_hint')}</span>
      </label>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? t('button_saving') : t('button_save_preferences')}
        </button>
      </div>
    </form>
  );
}
