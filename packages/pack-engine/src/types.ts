import type { Stats } from 'node:fs';

export interface PackCandidate {
  /** Absolute file path on disk. */
  absolutePath: string;
  /** Relative path to persist inside the archive using forward slashes. */
  relativePath: string;
  /** Byte size, typically sourced from {@link Stats.size}. */
  size: number;
  /** Optional Node.js stats metadata for deterministic timestamps. */
  stats?: Pick<Stats, 'mtime' | 'mtimeMs'>;
}

export interface MetadataEntry {
  /** Target path inside the archive (e.g. `PACK-METADATA.json`). */
  entryName: string;
  /** UTF-8 string or buffer payload that should be embedded. */
  content: string | Buffer;
}

export interface ZipBinPlan {
  archiveName: string;
  files: PackCandidate[];
}

export interface ZipProgress {
  state: 'packing' | 'completed' | 'cancelled';
  current: number;
  total: number;
  percent: number;
  message: string;
  currentArchive: string | null;
}

export interface ZipPackOptions {
  files: PackCandidate[];
  /** Directory that will receive the resulting `stems-XX.zip` archives. */
  outputDir: string;
  /** Base name for generated archives (e.g. `stems`). */
  archiveBaseName: string;
  /** Target ceiling in megabytes for each archive. */
  targetSizeMB: number;
  /** Additional entries that must be injected into every archive. */
  metadataEntries: MetadataEntry[];
  /** Optional glob patterns that should be excluded when packing. */
  ignoreGlobs?: string[];
  /** Progress callback that mirrors the IPC payload shape. */
  onProgress?: (progress: ZipProgress) => void;
  /** Abort signal that cancels the entire job and tears down open streams. */
  signal?: AbortSignal;
}

export interface ZipPackResult {
  plan: ZipBinPlan[];
  outputPaths: string[];
}

export class AbortPackingError extends Error {
  constructor(message = 'Packing cancelled') {
    super(message);
    this.name = 'AbortPackingError';
  }
}

export interface SevenZipProgress {
  state: 'packing' | 'completed' | 'cancelled';
  current: number;
  total: number;
  percent: number;
  message: string;
  currentArchive: string | null;
}

export interface SevenZipPackOptions {
  files: PackCandidate[];
  outputDir: string;
  archiveBaseName: string;
  targetSizeMB: number;
  metadataEntries: MetadataEntry[];
  ignoreGlobs?: string[];
  onProgress?: (progress: SevenZipProgress) => void;
  signal?: AbortSignal;
  /** Optional override for the 7z binary path, useful for tests or custom distributions. */
  sevenZipBinaryPath?: string;
}

export interface SevenZipPackResult {
  outputPaths: string[];
  archiveBase: string;
  volumeSizeBytes: number;
  files: PackCandidate[];
}

export interface MonoChannelSplitPlan {
  /** Zero-based index for the channel in the original multichannel source. */
  channelIndex: number;
  /** Canonical label (e.g. `L`, `R`, `LFE`) or fallback `chNN` string. */
  channelLabel: string;
  /** Relative path for the derived mono asset using forward slashes. */
  relativePath: string;
  /** Estimated byte size of the mono asset including container overhead. */
  estimatedSizeBytes: number;
}

export interface MultichannelSplitPlan {
  /** Indicates whether the source should be split into mono assets. */
  shouldSplit: boolean;
  /** True when at least one mono exceeds the target limit, forcing 7z volumes. */
  needsSevenZipOnly: boolean;
  /** Planned mono outputs sorted by channel index. */
  outputs: MonoChannelSplitPlan[];
}

export interface PlanMultichannelSplitOptions {
  /** Relative path of the original source used to derive mono file names. */
  relativePath: string;
  /** Total byte size of the multichannel source. */
  bytes: number;
  /** Canonical container/codec format string. */
  format: string;
  /** Number of channels reported by the probe. */
  channels: number;
  /** Canonical labels per channel (length should match `channels`). */
  channelLabels: string[];
  /** Target size limit in megabytes. */
  targetSizeMB: number;
  /** Optional per-mono overhead to add when estimating derived sizes. */
  overheadBytes?: number;
}
