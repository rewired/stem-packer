import type { AudioFileItem } from '../../shared/preferences';
import { useTranslation, type TranslationKey } from '../hooks/useTranslation';
import { formatBytes } from '../utils/formatBytes';

interface FilesTableProps {
  files: AudioFileItem[];
  warningFiles?: AudioFileItem[];
  showEmptyState?: boolean;
  emptyStateKey?: TranslationKey;
}

export function FilesTable({ files, warningFiles, showEmptyState, emptyStateKey }: FilesTableProps) {
  const { t } = useTranslation();

  const warningPaths = new Set(
    (warningFiles ?? []).map((file) => file.relativePath)
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ file, isWarning }: { file: AudioFileItem; isWarning: boolean }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="align-top">
        <span className="font-medium">{file.name}</span>
        {isWarning ? (
          <span className="badge badge-warning badge-sm ml-2">
            {t('badge_zip_mono_split_file')}
          </span>
        ) : null}
      </td>
      <td className="align-top uppercase text-base-content/70">{file.extension.replace('.', '')}</td>
      <td className="align-top text-right text-base-content/70">{formatBytes(file.sizeBytes, t)}</td>
    </tr>
  );
}
