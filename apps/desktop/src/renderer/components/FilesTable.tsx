import type { AudioFileItem } from '../../shared/preferences';
import { useTranslation } from '../hooks/useTranslation';
import { formatBytes } from '../utils/formatBytes';

interface FilesTableProps {
  files: AudioFileItem[];
}

export function FilesTable({ files }: FilesTableProps) {
  const { t } = useTranslation();

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-base-content/20 p-6 text-center text-base-content/60">
        {t('table_empty_state')}
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
            <FileRow key={file.relativePath} file={file} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ file }: { file: AudioFileItem }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td className="align-top">
        <div className="flex flex-col">
          <span className="font-medium">{file.name}</span>
          <span className="text-xs text-base-content/60">{file.relativePath}</span>
        </div>
      </td>
      <td className="align-top uppercase text-base-content/70">{file.extension.replace('.', '')}</td>
      <td className="align-top text-right text-base-content/70">{formatBytes(file.sizeBytes, t)}</td>
    </tr>
  );
}
