import { Icon } from '@stem-packer/ui';
import type { PackingProgressEvent } from '../../shared/packing';
import { useTranslation } from '../hooks/useTranslation';

interface PackingProgressProps {
  progress: PackingProgressEvent | null;
  percentComplete: number;
  onCancel: () => void | Promise<void>;
  isCancelling: boolean;
}

export function PackingProgress({ progress, percentComplete, onCancel, isCancelling }: PackingProgressProps) {
  const { t } = useTranslation();

  if (!progress) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-semibold">{t('packing_progress_title')}</p>
          <p className="text-sm text-base-content/80">
            {progress.message ?? t('packing_progress_waiting')}
          </p>
          <p className="text-xs text-base-content/60">
            {t('packing_progress_detail', {
              current: progress.current ?? 0,
              total: progress.total ?? 0
            })}
          </p>
          {progress.currentArchive ? (
            <p className="text-xs text-base-content/60">
              {t('packing_progress_current_archive', {
                name: progress.currentArchive
              })}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 md:w-72">
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
                void onCancel();
              }}
              disabled={isCancelling}
            >
              <Icon name="cancel" className="text-lg" />
              <span>
                {isCancelling ? t('button_cancelling_packing') : t('button_cancel_packing')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
