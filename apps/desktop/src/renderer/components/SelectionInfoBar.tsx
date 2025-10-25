import { Icon } from '@stem-packer/ui';
import { useTranslation } from '../hooks/useTranslation';
import { middleEllipsis } from '../utils/formatPath';

interface SelectionInfoBarProps {
  folderPath: string | null;
  fileCount: number;
  ignoredCount: number;
  zipCount: number;
  sevenZipCount: number;
  onCopyPath?: () => void | Promise<void>;
}

export function SelectionInfoBar({
  folderPath,
  fileCount,
  ignoredCount,
  zipCount,
  sevenZipCount,
  onCopyPath
}: SelectionInfoBarProps) {
  const { t } = useTranslation();
  const hasFolder = Boolean(folderPath);
  const truncatedPath = hasFolder && folderPath ? middleEllipsis(folderPath) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        <span className="text-base-content/70">{t('lbl_folder')}:</span>
        <span
          className="inline-block max-w-[40ch] truncate font-medium text-base-content"
          title={folderPath ?? undefined}
        >
          {truncatedPath ?? t('selected_folder_empty')}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => {
            if (onCopyPath && hasFolder) {
              void onCopyPath();
            }
          }}
          disabled={!hasFolder}
          aria-label={t('btn_copy')}
        >
          <Icon name="content_copy" className="text-base" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-base-content/70">{t('lbl_files')}:</span>
        <span className="badge badge-sm">{fileCount}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-base-content/70">{t('lbl_ignored')}:</span>
        <span className="badge badge-sm badge-ghost">{ignoredCount}</span>
      </div>
      <div className="flex items-center gap-1 text-base-content/70">
        <span>{t('lbl_estimates')}:</span>
        <span className="font-medium text-base-content">
          ZIP ≈ {zipCount} · 7z ≈ {sevenZipCount}
        </span>
      </div>
    </div>
  );
}
