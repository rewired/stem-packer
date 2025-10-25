import { Icon } from '@stem-packer/ui';
import type { PackingResult } from '../../shared/packing';
import { useTranslation } from '../hooks/useTranslation';

export type PackingStatus = 'idle' | 'packing' | 'completed' | 'cancelled' | 'error';

interface PackingStatusAlertsProps {
  status: PackingStatus;
  packingError: { name: string; message: string } | null;
  lastPackResult: PackingResult | null;
  onDismissNotice: () => void;
  onDismissError: () => void;
}

export function PackingStatusAlerts({
  status,
  packingError,
  lastPackResult,
  onDismissNotice,
  onDismissError
}: PackingStatusAlertsProps) {
  const { t } = useTranslation();

  if (status === 'completed' && lastPackResult) {
    return (
      <div className="alert alert-success">
        <Icon name="check_circle" className="text-xl" />
        <div className="flex flex-col text-sm">
          <span>{t('packing_success_message', { count: lastPackResult.outputPaths.length })}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissNotice}>
          {t('button_close')}
        </button>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="alert alert-info">
        <Icon name="info" className="text-xl" />
        <span className="text-sm">{t('packing_cancelled_message')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissNotice}>
          {t('button_close')}
        </button>
      </div>
    );
  }

  if (status === 'error' && packingError) {
    return (
      <div className="alert alert-error">
        <Icon name="error" className="text-xl" />
        <div className="flex flex-col text-sm">
          <span>{t('packing_error_message')}</span>
          <span className="text-xs text-base-content/70">{packingError.message}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissError}>
          {t('button_close')}
        </button>
      </div>
    );
  }

  return null;
}
