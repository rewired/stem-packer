import { type AudioFileItem, type Preferences } from '../shared/preferences';
import { createIgnoreMatcher } from './ignore';

export interface EstimateResult {
  totalBytes: number;
  archiveCount: number;
  consideredFiles: AudioFileItem[];
}

function clampTargetSize(targetSizeMB: number): number {
  return Math.max(1, targetSizeMB);
}

export function estimateArchiveCount(
  files: AudioFileItem[],
  preferences: Preferences
): EstimateResult {
  const shouldIgnore = createIgnoreMatcher(preferences.ignore_enabled, preferences.ignore_globs);
  const consideredFiles = files.filter((file) => !shouldIgnore(file.relativePath));
  const totalBytes = consideredFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  const targetBytes = clampTargetSize(preferences.targetSizeMB) * 1024 * 1024;
  const archiveCount = consideredFiles.length === 0 ? 0 : Math.max(1, Math.ceil(totalBytes / targetBytes));

  return {
    totalBytes,
    archiveCount,
    consideredFiles
  };
}
