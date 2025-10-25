import { useTranslation } from '../hooks/useTranslation';
import type { AppInfo } from '../../shared/preferences';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  appInfo: AppInfo | null;
}

export function AboutModal({ open, onClose, appInfo }: AboutModalProps) {
  const { t } = useTranslation();

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`} open={open} onClose={() => onClose()}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{t('about_title')}</h3>
        <p className="py-4 text-base-content/80">{t('about_description')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/70">
          {appInfo ? <li>{t('about_version', { version: appInfo.version })}</li> : null}
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
