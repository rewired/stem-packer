import { Icon } from '@stem-packer/ui';
import type { AudioFileItem } from '../../shared/preferences';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { formatBytes } from '../utils/formatBytes';

interface FilesTableProps {
  files: AudioFileItem[];
  warningFiles?: AudioFileItem[];
  monoSplitCandidates?: AudioFileItem[];
  showMonoSplitLegend?: boolean;
  showEmptyState?: boolean;
  emptyStateKey?: TranslationKey;
}

export function FilesTable({
  files,
  warningFiles,
  monoSplitCandidates,
  showMonoSplitLegend,
  showEmptyState,
  emptyStateKey
}: FilesTableProps) {
  const { t } = useTranslation();

  const warningPaths = new Set(
    (warningFiles ?? []).map((file) => file.relativePath)
  );
  const monoSplitCandidatePaths = new Set(
    (monoSplitCandidates ?? []).map((file) => file.relativePath)
  );

  if (files.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    const messageKey = emptyStateKey ?? 'table_empty_state';
    return (
      <div className="rounded-lg border border-base-content/20 p-6 text-center text-base-content/60">
        {t(messageKey)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
              <FileRow
                key={file.relativePath}
                file={file}
                isWarning={warningPaths.has(file.relativePath)}
                isMonoSplitCandidate={monoSplitCandidatePaths.has(file.relativePath)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {showMonoSplitLegend ? (
        <div className="flex items-center gap-2 text-xs text-base-content/70">
          <Icon name="info" className="text-sm" aria-hidden="true" />
          <span>{t('legend_mono_split')}</span>
        </div>
      ) : null}
    </div>
  );
}

function FileRow({
  file,
  isWarning,
  isMonoSplitCandidate
}: {
  file: AudioFileItem;
  isWarning: boolean;
  isMonoSplitCandidate: boolean;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="align-top">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{file.name}</span>
          {isMonoSplitCandidate ? (
            <span className="badge badge-outline badge-neutral badge-sm flex items-center gap-1">
              <Icon name="call_split" className="text-xs" aria-hidden="true" />
              {t('badge_mono_split')}
            </span>
          ) : null}
          {isWarning ? (
            <span className="badge badge-warning badge-sm">{t('badge_zip_mono_split_file')}</span>
          ) : null}
        </div>
      </td>
      <td className="align-top uppercase text-base-content/70">{file.extension.replace('.', '')}</td>
      <td className="align-top text-right text-base-content/70">{formatBytes(file.sizeBytes, t)}</td>
    </tr>
  );
}
