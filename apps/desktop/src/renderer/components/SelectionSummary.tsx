import type { AudioFileItem } from '../../shared/preferences';
import { useTranslation } from '../hooks/useTranslation';
import { formatBytes } from '../utils/formatBytes';

interface SelectionSummaryProps {
  folderPath: string;
  fileCount: number;
  totalSize: number;
  ignoredCount: number;
}

export function SelectionSummary({ folderPath, fileCount, totalSize, ignoredCount }: SelectionSummaryProps) {
  const { t } = useTranslation();
  const formattedSize = formatBytes(totalSize, t);

  const fileCountLabel =
    fileCount === 1
      ? t('selection_summary_files_one')
      : t('selection_summary_files_other', { count: fileCount });

  const ignoredLabel =
    ignoredCount === 1
      ? t('selection_summary_ignored_one')
      : t('selection_summary_ignored_other', { count: ignoredCount });
  const gridColumns =
    ignoredCount > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="rounded-xl border border-base-content/30 bg-base-100/5 p-6 min-h-[12rem]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
            {t('selection_summary_title')}
          </h3>
          <span className="badge badge-outline badge-primary">{fileCountLabel}</span>
        </div>
        <dl className={`grid gap-4 ${gridColumns}`}>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase text-base-content/60">
              {t('selection_summary_folder')}
            </dt>
            <dd className="break-words text-sm font-medium text-base-content/80">{folderPath}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs uppercase text-base-content/60">
              {t('selection_summary_size')}
            </dt>
            <dd className="text-sm font-medium text-base-content/80">{formattedSize}</dd>
          </div>
          {ignoredCount > 0 ? (
            <div className="flex flex-col gap-1">
              <dt className="text-xs uppercase text-base-content/60">
                {t('selection_summary_ignored')}
              </dt>
              <dd className="text-sm font-medium text-base-content/80">{ignoredLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function calculateTotalSize(files: AudioFileItem[]): number {
  return files.reduce((sum, file) => sum + file.sizeBytes, 0);
}
