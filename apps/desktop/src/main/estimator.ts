import { type AudioFileItem, type Preferences } from '../shared/preferences';
import { createIgnoreMatcher } from './ignore';

export interface EstimateResult {
  totalBytes: number;
  zipArchiveCount: number;
  sevenZipVolumeCount: number;
  consideredFiles: AudioFileItem[];
  splitCount: number;
  splitCandidateCount: number;
}

const MONO_SPLIT_OVERHEAD_BYTES = 4096;
const LOSSLESS_SPLIT_EXTENSIONS = new Set(['.wav', '.wave', '.aif', '.aiff', '.flac']);

function clampTargetSize(targetSizeMB: number): number {
  return Math.max(1, targetSizeMB);
}

function isMonoSplitCandidate(file: AudioFileItem, targetBytes: number): boolean {
  const channelCount = Math.max(1, file.channels ?? 1);
  if (channelCount <= 1) {
    return false;
  }

  if (file.sizeBytes <= targetBytes) {
    return false;
  }

  return LOSSLESS_SPLIT_EXTENSIONS.has(file.extension.toLowerCase());
}

function shouldApplyMonoSplit(
  file: AudioFileItem,
  preferences: Preferences,
  targetBytes: number
): boolean {
  if (!preferences.auto_split_multichannel_to_mono) {
    return false;
  }

  if (!isMonoSplitCandidate(file, targetBytes)) {
    return false;
  }

  const channelCount = Math.max(1, file.channels ?? 1);
  const baseSize = Math.ceil(file.sizeBytes / channelCount) + MONO_SPLIT_OVERHEAD_BYTES;

  return baseSize <= targetBytes;
}

interface EstimatedItem {
  sizeBytes: number;
  key: string;
}

function planItems(
  files: AudioFileItem[],
  preferences: Preferences,
  targetBytes: number
): { items: EstimatedItem[]; splitCount: number; splitCandidateCount: number } {
  const items: EstimatedItem[] = [];
  let splitCount = 0;
  let splitCandidateCount = 0;

  for (const file of files) {
    const isCandidate = isMonoSplitCandidate(file, targetBytes);
    if (isCandidate) {
      splitCandidateCount += 1;
    }

    if (shouldApplyMonoSplit(file, preferences, targetBytes)) {
      const channelCount = Math.max(1, file.channels ?? 1);
      const baseSize = Math.ceil(file.sizeBytes / channelCount);
      const estimatedSize = baseSize + MONO_SPLIT_OVERHEAD_BYTES;
      splitCount += channelCount;

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        items.push({
          sizeBytes: estimatedSize,
          key: `${file.relativePath}#split-${channelIndex}`
        });
      }
      continue;
    }

    items.push({
      sizeBytes: file.sizeBytes,
      key: file.relativePath
    });
  }

  return { items, splitCount, splitCandidateCount };
}

function bestFitBinCount(items: EstimatedItem[], capacity: number): number {
  if (items.length === 0) {
    return 0;
  }

  const bins: number[] = [];
  const sorted = [...items].sort((a, b) => {
    if (b.sizeBytes !== a.sizeBytes) {
      return b.sizeBytes - a.sizeBytes;
    }
    return a.key.localeCompare(b.key);
  });

  for (const item of sorted) {
    let bestIndex = -1;
    let smallestRemaining = Number.POSITIVE_INFINITY;

    for (let index = 0; index < bins.length; index += 1) {
      const remaining = capacity - bins[index];
      if (item.sizeBytes <= remaining && remaining - item.sizeBytes < smallestRemaining) {
        bestIndex = index;
        smallestRemaining = remaining - item.sizeBytes;
      }
    }

    if (bestIndex === -1) {
      bins.push(item.sizeBytes);
    } else {
      bins[bestIndex] += item.sizeBytes;
    }
  }

  return bins.length;
}

export function estimateArchiveCount(
  files: AudioFileItem[],
  preferences: Preferences
): EstimateResult {
  const shouldIgnore = createIgnoreMatcher(preferences.ignore_enabled, preferences.ignore_globs);
  const consideredFiles = files.filter((file) => !shouldIgnore(file.relativePath));
  const targetBytes = clampTargetSize(preferences.targetSizeMB) * 1024 * 1024;
  const { items, splitCount, splitCandidateCount } = planItems(
    consideredFiles,
    preferences,
    targetBytes
  );
  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
  const zipArchiveCount = bestFitBinCount(items, targetBytes);
  const sevenZipVolumeCount =
    totalBytes === 0 ? 0 : Math.max(1, Math.ceil(totalBytes / targetBytes));

  return {
    totalBytes,
    zipArchiveCount,
    sevenZipVolumeCount,
    consideredFiles,
    splitCount,
    splitCandidateCount
  };
}
