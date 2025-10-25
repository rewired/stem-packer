import { Icon } from '@stem-packer/ui';
import type { AppInfo } from '../../shared/preferences';
import { useTranslation } from '../hooks/useTranslation';

interface HeaderProps {
  onAboutClick: () => void;
  appInfo: AppInfo | null;
}

export function Header({ onAboutClick, appInfo }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
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
