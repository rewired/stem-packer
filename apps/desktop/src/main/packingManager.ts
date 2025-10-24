import { promises as fs } from 'node:fs';
import type { StatsFs } from 'node:fs';
import path from 'node:path';
import {
  AbortPackingError,
  type MetadataEntry,
  type PackCandidate,
  type SevenZipPackOptions,
  type SevenZipPackResult,
  type SevenZipProgress,
  type ZipPackOptions,
  type ZipPackResult,
  type ZipProgress,
  pack7zVolumes,
  packZipBestFit,
} from '@stem-packer/pack-engine';
import { createInfoTextEntry, createPackMetadataEntry } from './pack-metadata';
import { filterPackableFiles } from './packer';
import { resolveOutputDirectory } from './collisions';
import type { AudioFileItem, Preferences } from '../shared/preferences';
import type { PackingRequest, PackingResult, PackingProgressEvent } from '../shared/packing';
import type { PreferencesStore, ArtistStore } from './stores';
import type { ArtistProfile } from '../shared/artist';

const MINIMUM_MARGIN_BYTES = 128 * 1024 * 1024; // 128 MB safety margin.
const MARGIN_RATIO = 0.1; // 10% overhead margin.

function toBuffer(content: string | Buffer): Buffer {
  return typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
}

async function readCandidateStats(file: AudioFileItem): Promise<Pick<PackCandidate, 'stats'>> {
  try {
    const stats = await fs.stat(file.fullPath);
    return {
      stats: {
        mtime: stats.mtime,
        mtimeMs: stats.mtimeMs,
      },
    };
  } catch {
    return { stats: undefined };
  }
}

async function ensureStatTarget(target: string): Promise<string> {
  let current = path.resolve(target);
  while (true) {
    try {
      await fs.access(current);
      return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const parent = path.dirname(current);
        if (parent === current) {
          return current;
        }
        current = parent;
        continue;
      }
      throw error;
    }
  }
}

class InsufficientDiskSpaceError extends Error {
  readonly requiredBytes: number;
  readonly availableBytes: number;

  constructor(requiredBytes: number, availableBytes: number) {
    super(
      `Insufficient disk space: requires ${requiredBytes} bytes with margin but only ${availableBytes} bytes available.`,
    );
    this.name = 'InsufficientDiskSpaceError';
    this.requiredBytes = requiredBytes;
    this.availableBytes = availableBytes;
  }
}

interface ActiveJob {
  controller: AbortController;
  promise: Promise<PackingResult>;
}

export interface PackingManagerOptions {
  preferencesStore: PreferencesStore;
  artistStore: ArtistStore;
  emitProgress?: (progress: PackingProgressEvent) => void;
  emitResult?: (result: PackingResult) => void;
  emitError?: (error: Error) => void;
  zipRunner?: (options: ZipPackOptions) => Promise<ZipPackResult>;
  sevenZipRunner?: (options: SevenZipPackOptions) => Promise<SevenZipPackResult>;
  statfs?: (path: string) => Promise<StatsFs>;
}

export class PackingManager {
  private readonly preferencesStore: PreferencesStore;
  private readonly artistStore: ArtistStore;
  private readonly emitProgress?: (progress: PackingProgressEvent) => void;
  private readonly emitResult?: (result: PackingResult) => void;
  private readonly emitError?: (error: Error) => void;
  private readonly zipRunner: (options: ZipPackOptions) => Promise<ZipPackResult>;
  private readonly sevenZipRunner: (options: SevenZipPackOptions) => Promise<SevenZipPackResult>;
  private readonly statfs: (path: string) => Promise<StatsFs>;
  private activeJob: ActiveJob | null = null;

  constructor(options: PackingManagerOptions) {
    this.preferencesStore = options.preferencesStore;
    this.artistStore = options.artistStore;
    this.emitProgress = options.emitProgress;
    this.emitResult = options.emitResult;
    this.emitError = options.emitError;
    this.zipRunner = options.zipRunner ?? packZipBestFit;
    this.sevenZipRunner = options.sevenZipRunner ?? pack7zVolumes;
    this.statfs = options.statfs ?? ((target) => fs.statfs(target));
  }

  private emitProgressEvent(progress: PackingProgressEvent) {
    this.emitProgress?.({ ...progress });
  }

  private emitResultEvent(result: PackingResult) {
    this.emitResult?.(result);
  }

  private emitErrorEvent(error: Error) {
    this.emitError?.(error);
  }

  private async preparePackCandidates(files: AudioFileItem[]): Promise<PackCandidate[]> {
    const candidates: PackCandidate[] = [];
    for (const file of files) {
      const stats = await readCandidateStats(file);
      candidates.push({
        absolutePath: file.fullPath,
        relativePath: file.relativePath,
        size: file.sizeBytes,
        ...stats,
      });
    }
    return candidates;
  }

  private buildMetadataEntries(
    preferences: Preferences,
    artist: ArtistProfile,
    files: AudioFileItem[],
  ): MetadataEntry[] {
    const outputs = files.map((file) => ({
      relativePath: file.relativePath,
      sizeBytes: file.sizeBytes,
    }));

    const metadata = createPackMetadataEntry({
      format: preferences.format,
      targetSizeMB: preferences.targetSizeMB,
      autoSplitMultichannelToMono: preferences.auto_split_multichannel_to_mono,
      info: artist,
      outputs,
    });

    const infoText = createInfoTextEntry(artist);
    return [metadata, infoText];
  }

  private async ensureFreeSpace(
    outputDir: string,
    format: Preferences['format'],
    candidates: PackCandidate[],
    metadataEntries: MetadataEntry[],
  ): Promise<void> {
    const baseBytes = candidates.reduce((sum, candidate) => sum + candidate.size, 0);
    const metadataBytes = metadataEntries.reduce(
      (sum, entry) => sum + toBuffer(entry.content).byteLength,
      0,
    );
    const stagingMultiplier = format === '7z' ? 2 : 1;
    const requiredBytes = (baseBytes + metadataBytes) * stagingMultiplier;
    const marginBytes = Math.max(Math.ceil(requiredBytes * MARGIN_RATIO), MINIMUM_MARGIN_BYTES);
    const requiredWithMargin = requiredBytes + marginBytes;

    const statTarget = await ensureStatTarget(outputDir);
    const stats = await this.statfs(statTarget);
    const blockSize = Number(stats.bsize ?? 0);
    const availableBlocks = stats.bavail ?? stats.bfree;
    const availableBytes = blockSize * Number(availableBlocks ?? 0);

    if (!Number.isFinite(availableBytes) || availableBytes < requiredWithMargin) {
      throw new InsufficientDiskSpaceError(requiredWithMargin, availableBytes);
    }
  }

  async start(request: PackingRequest): Promise<PackingResult> {
    if (this.activeJob) {
      throw new Error('Packing is already in progress');
    }

    const preferences = this.preferencesStore.get();
    const normalizedFolder = path.resolve(request.folderPath);
    const packable = filterPackableFiles(request.files, preferences);

    if (packable.length === 0) {
      throw new Error('No packable audio files were provided for packing');
    }

    const artistInput = request.artist ?? this.artistStore.get().artist;
    const artistProfile = await this.artistStore.set(artistInput);

    const metadataEntries = this.buildMetadataEntries(preferences, artistProfile, packable);
    const candidates = await this.preparePackCandidates(packable);
    const outputDir = resolveOutputDirectory(normalizedFolder, preferences.outputDir);

    await this.ensureFreeSpace(outputDir, preferences.format, candidates, metadataEntries);

    const controller = new AbortController();
    const onProgress = (progress: ZipProgress | SevenZipProgress) => {
      this.emitProgressEvent(progress);
    };

    const packPromise: Promise<PackingResult> = (async () => {
      try {
        if (preferences.format === 'zip') {
          const result = await this.zipRunner({
            files: candidates,
            outputDir,
            archiveBaseName: 'stems',
            targetSizeMB: preferences.targetSizeMB,
            metadataEntries,
            ignoreGlobs: preferences.ignore_globs,
            onProgress,
            signal: controller.signal,
          });
          const payload: PackingResult = { format: 'zip', ...result };
          this.emitResultEvent(payload);
          return payload;
        }

        const result = await this.sevenZipRunner({
          files: candidates,
          outputDir,
          archiveBaseName: 'stems',
          targetSizeMB: preferences.targetSizeMB,
          metadataEntries,
          ignoreGlobs: preferences.ignore_globs,
          onProgress,
          signal: controller.signal,
        });
        const payload: PackingResult = { format: '7z', ...result };
        this.emitResultEvent(payload);
        return payload;
      } catch (error) {
        if (error instanceof AbortPackingError) {
          throw error;
        }
        this.emitErrorEvent(error as Error);
        throw error;
      }
    })();

    this.activeJob = { controller, promise: packPromise };

    try {
      const result = await packPromise;
      return result;
    } finally {
      this.activeJob = null;
    }
  }

  async cancel(): Promise<boolean> {
    const job = this.activeJob;
    if (!job) {
      return false;
    }

    job.controller.abort();

    try {
      await job.promise;
      return false;
    } catch (error) {
      if (error instanceof AbortPackingError) {
        return true;
      }
      throw error;
    } finally {
      if (this.activeJob === job) {
        this.activeJob = null;
      }
    }
  }
}

export { InsufficientDiskSpaceError };
