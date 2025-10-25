import type { Translator } from '../hooks/useTranslation';

const sizeKeys = ['file_size_bytes', 'file_size_kb', 'file_size_mb', 'file_size_gb'] as const;

export function formatBytes(size: number, t: Translator): string {
  if (size === 0) {
    return t(sizeKeys[0], { value: '0' });
  }

  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < sizeKeys.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted = unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return t(sizeKeys[unitIndex], { value: formatted });
}
