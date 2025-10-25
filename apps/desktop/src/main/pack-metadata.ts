import type {
  ChannelMapSource,
  MetadataEntry,
} from '@stem-packer/pack-engine';
import { INFO_TXT_LABELS } from './info-labels';
import type { InfoTextFields } from '../shared/info';

export interface PackMetadataSource {
  relativePath: string;
  channelCount?: number | null;
  channelMapSource?: ChannelMapSource | null;
}

export interface PackMetadataOutput {
  relativePath: string;
  sizeBytes: number;
  derivedFrom?: string | null;
  channelIndex?: number | null;
  channelLabel?: string | null;
  channelMapSource?: ChannelMapSource | null;
}

export interface PackMetadataOptions {
  format: 'zip' | '7z';
  targetSizeMB: number;
  autoSplitMultichannelToMono: boolean;
  info: InfoTextFields;
  outputs: PackMetadataOutput[];
  sources?: PackMetadataSource[];
  generatedAt?: Date;
  schemaVersion?: number;
}

interface NormalizedInfoFields {
  title: string;
  artist: string;
  album: string;
  bpm: string;
  key: string;
  license: string;
  attribution: string;
}

interface SourceRecord {
  channelCount: number | null;
  channelMapSource: ChannelMapSource | null;
}

interface FileEntry {
  relativePath: string;
  sizeBytes: number;
  originalChannelCount: number | null;
  splitStrategy: 'none' | 'mono-per-channel';
  derivedFrom: string | null;
  channelIndex: number | null;
  channelLabel: string | null;
  channelMapSource: ChannelMapSource | null;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value);
}

function normalizeInfoFields(fields: InfoTextFields): NormalizedInfoFields {
  return {
    title: toStringValue(fields.title),
    artist: toStringValue(fields.artist),
    album: toStringValue(fields.album),
    bpm: toStringValue(fields.bpm),
    key: toStringValue(fields.key),
    license: toStringValue(fields.license),
    attribution: toStringValue(fields.attribution),
  };
}

function normalizeChannelCount(value: number | null | undefined): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : null;
}

function normalizeChannelMapSource(value: ChannelMapSource | null | undefined): ChannelMapSource | null {
  if (value === 'mask' || value === 'fallback') {
    return value;
  }

  if (value === 'unknown') {
    return 'unknown';
  }

  return null;
}

function buildSourceMap(sources: PackMetadataSource[] | undefined): Map<string, SourceRecord> {
  const map = new Map<string, SourceRecord>();

  if (!sources) {
    return map;
  }

  for (const source of sources) {
    const key = source.relativePath;
    const channelCount = normalizeChannelCount(source.channelCount);
    const channelMapSource = normalizeChannelMapSource(source.channelMapSource) ?? null;
    map.set(key, { channelCount, channelMapSource });
  }

  return map;
}

function computeDerivedGroupCounts(outputs: PackMetadataOutput[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const output of outputs) {
    const key = output.derivedFrom;
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function normalizeOutputFile(
  output: PackMetadataOutput,
  sourceMap: Map<string, SourceRecord>,
  derivedCounts: Map<string, number>,
): FileEntry {
  const derivedFrom = output.derivedFrom ?? null;
  const sourceKey = derivedFrom ?? output.relativePath;
  const sourceRecord = sourceMap.get(sourceKey);
  const sourceChannelCount = normalizeChannelCount(sourceRecord?.channelCount ?? null);
  const derivedCount = derivedFrom ? normalizeChannelCount(derivedCounts.get(derivedFrom) ?? null) : null;
  const originalChannelCount = sourceChannelCount ?? derivedCount;
  const splitStrategy = derivedFrom ? 'mono-per-channel' : 'none';
  const channelIndex = typeof output.channelIndex === 'number' ? output.channelIndex : null;
  const channelLabel = typeof output.channelLabel === 'string' ? output.channelLabel : null;
  const channelMapSource = derivedFrom
    ? normalizeChannelMapSource(output.channelMapSource ?? sourceRecord?.channelMapSource ?? 'unknown') ?? 'unknown'
    : normalizeChannelMapSource(sourceRecord?.channelMapSource ?? null);

  return {
    relativePath: output.relativePath,
    sizeBytes: Math.max(0, Math.trunc(output.sizeBytes ?? 0)),
    originalChannelCount: originalChannelCount ?? null,
    splitStrategy,
    derivedFrom,
    channelIndex,
    channelLabel,
    channelMapSource: derivedFrom ? channelMapSource ?? 'unknown' : channelMapSource ?? null,
  };
}

export function createPackMetadataEntry(options: PackMetadataOptions): MetadataEntry {
  const normalizedInfo = normalizeInfoFields(options.info);
  const generatedAt = options.generatedAt ?? new Date();
  const schemaVersion = options.schemaVersion ?? 1;
  const sourceMap = buildSourceMap(options.sources);
  const derivedCounts = computeDerivedGroupCounts(options.outputs);
  const files = options.outputs
    .map((output) => normalizeOutputFile(output, sourceMap, derivedCounts))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const metadata = {
    schemaVersion,
    generatedAt: generatedAt.toISOString(),
    pack: {
      format: options.format,
      targetSizeMB: Math.max(1, Math.trunc(options.targetSizeMB)),
      autoSplitMultichannelToMono: Boolean(options.autoSplitMultichannelToMono),
    },
    info: normalizedInfo,
    files,
  };

  const content = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    entryName: 'PACK-METADATA.json',
    content,
  };
}

export function createInfoTextEntry(fields: InfoTextFields): MetadataEntry {
  const normalized = normalizeInfoFields(fields);
  const lines = [
    `${INFO_TXT_LABELS.title}: ${normalized.title}`,
    `${INFO_TXT_LABELS.artist}: ${normalized.artist}`,
    `${INFO_TXT_LABELS.album}: ${normalized.album}`,
    `${INFO_TXT_LABELS.bpm}: ${normalized.bpm}`,
    `${INFO_TXT_LABELS.key}: ${normalized.key}`,
    `${INFO_TXT_LABELS.license}: ${normalized.license}`,
    `${INFO_TXT_LABELS.attribution}: ${normalized.attribution}`,
  ];

  const content = Buffer.from(`${lines.join('\n')}\n`, 'utf8');

  return {
    entryName: 'INFO.txt',
    content,
  };
}
