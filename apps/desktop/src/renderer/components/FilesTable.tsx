import { Icon } from '@stem-packer/ui';
import type { AudioFileItem } from '../../shared/preferences';
import type { ExcessNonSplittablePrediction } from '../../main/estimator';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { formatBytes } from '../utils/formatBytes';

interface FilesTableProps {
  files: AudioFileItem[];
  monoSplitCandidates?: AudioFileItem[];
  nonSplittableWarnings?: Map<string, ExcessNonSplittablePrediction>;
  showMonoSplitLegend?: boolean;
  showEmptyState?: boolean;
  emptyStateKey?: TranslationKey;
}

export function FilesTable({
  files,
  monoSplitCandidates,
  nonSplittableWarnings,
  showMonoSplitLegend,
  showEmptyState,
  emptyStateKey
}: FilesTableProps) {
  const { t } = useTranslation();

  const warningMap = nonSplittableWarnings ?? new Map();
  const monoSplitCandidatePaths = new Set(
    (monoSplitCandidates ?? []).map((file) => file.relativePath)
  );

  if (files.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    const messageKey = emptyStateKey ?? 'table_empty_state';
    return (
      <div className="rounded-lg border border-base-content/20 p-4 text-center text-base-content/60">
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
                nonSplittableWarning={warningMap.get(file.relativePath)}
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
  nonSplittableWarning,
  isMonoSplitCandidate
}: {
  file: AudioFileItem;
  nonSplittableWarning?: ExcessNonSplittablePrediction;
  isMonoSplitCandidate: boolean;
}) {
  const { t } = useTranslation();
  const severityClass =
    nonSplittableWarning?.severity === 'critical'
      ? 'badge-error text-error-content'
      : 'badge-warning text-warning-content';
  const showNonSplittableWarning = Boolean(nonSplittableWarning);
  return (
    <tr>
      <td className="align-top">
        <div className="flex flex-wrap items-center gap-2">
          {showNonSplittableWarning ? (
            <span
              className={`badge badge-sm flex items-center gap-1 ${severityClass}`}
              title={t('tooltip_switch_to_7z_volumes')}
              aria-label={t('warn_exceeds_limit_long')}
              data-severity={nonSplittableWarning?.severity}
            >
              <Icon name="warning" className="text-xs" aria-hidden="true" />
              <span>{t('warn_exceeds_limit_short')}</span>
            </span>
          ) : null}
          <span className="font-medium">{file.name}</span>
          {isMonoSplitCandidate ? (
            <span className="badge badge-outline badge-neutral badge-sm flex items-center gap-1">
              <Icon name="call_split" className="text-xs" aria-hidden="true" />
              {t('badge_mono_split')}
            </span>
          ) : null}
        </div>
      </td>
      <td className="align-top uppercase text-base-content/70">{file.extension.replace('.', '')}</td>
      <td className="align-top text-right text-base-content/70">{formatBytes(file.sizeBytes, t)}</td>
    </tr>
  );
}
