import path from 'node:path';
import type {
  ChannelMapSource,
  MonoChannelSplitPlan,
  MultichannelSplitPlan,
  PlanMultichannelSplitOptions
} from './types.js';

const LOSSLESS_SPLIT_FORMATS = new Set(['wav', 'wave', 'aif', 'aiff', 'flac']);
const DEFAULT_OVERHEAD_BYTES = 4096;

function clampTargetBytes(targetSizeMB: number): number {
  return Math.max(1, targetSizeMB) * 1024 * 1024;
}

function resolveChannelLabel(
  labels: string[],
  channelIndex: number,
  defaultSource: ChannelMapSource,
): { label: string; source: ChannelMapSource } {
  const raw = labels[channelIndex];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      return { label: trimmed, source: defaultSource };
    }
  }

  return {
    label: `ch${String(channelIndex + 1).padStart(2, '0')}`,
    source: 'fallback',
  };
}

function normaliseFormat(format: string): string {
  return format.trim().toLowerCase();
}

export function planMultichannelSplit(options: PlanMultichannelSplitOptions): MultichannelSplitPlan {
  const channelCount = Math.max(0, Math.trunc(options.channels));
  const targetBytes = clampTargetBytes(options.targetSizeMB);
  const result: MultichannelSplitPlan = {
    shouldSplit: false,
    needsSevenZipOnly: false,
    outputs: []
  };

  if (channelCount <= 1) {
    return result;
  }

  const format = normaliseFormat(options.format ?? '');
  if (!LOSSLESS_SPLIT_FORMATS.has(format)) {
    return result;
  }

  const totalBytes = Math.max(0, Math.trunc(options.bytes));
  if (totalBytes <= targetBytes) {
    return result;
  }

  const overheadBytes = Math.max(0, Math.trunc(options.overheadBytes ?? DEFAULT_OVERHEAD_BYTES));
  const perChannelSize = Math.ceil(totalBytes / channelCount) + overheadBytes;

  const parsed = path.posix.parse(options.relativePath);
  const outputs: MonoChannelSplitPlan[] = [];
  let needsSevenZipOnly = false;

  const defaultSource: ChannelMapSource = options.channelMapSource ?? 'unknown';

  for (let index = 0; index < channelCount; index += 1) {
    const { label, source } = resolveChannelLabel(options.channelLabels, index, defaultSource);
    const channelFileName = `${parsed.name}_${label}${parsed.ext}`;
    const relativePath = parsed.dir ? `${parsed.dir}/${channelFileName}` : channelFileName;

    outputs.push({
      channelIndex: index,
      channelLabel: label,
      channelMapSource: source,
      relativePath,
      estimatedSizeBytes: perChannelSize
    });

    if (perChannelSize > targetBytes) {
      needsSevenZipOnly = true;
    }
  }

  result.shouldSplit = true;
  result.needsSevenZipOnly = needsSevenZipOnly;
  result.outputs = outputs;

  return result;
}
