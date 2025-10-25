import { useTranslation } from '../hooks/useTranslation';
import type { Preferences } from '../../shared/preferences';
import { SettingsPanel } from './SettingsPanel';

interface PreferencesCardProps {
  active: boolean;
  panelId: string;
  labelledBy: string;
  preferences: Preferences | null;
  onChange: (prefs: Preferences) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function PreferencesCard({
  active,
  panelId,
  labelledBy,
  preferences,
  onChange,
  onSave,
  isSaving
}: PreferencesCardProps) {
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
        <div className="card-body gap-3 p-4">
          <h2 className="text-xl font-semibold">{t('settings_title')}</h2>
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
