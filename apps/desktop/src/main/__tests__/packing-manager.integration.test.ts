import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
vi.mock('@stem-packer/pack-engine', () => ({
  AbortPackingError: class AbortPackingError extends Error {
    constructor() {
      super('Packing cancelled');
      this.name = 'AbortPackingError';
    }
  },
  packZipBestFit: vi.fn(),
  pack7zVolumes: vi.fn(),
}));

import { AbortPackingError, packZipBestFit } from '@stem-packer/pack-engine';
import type { ZipPackOptions, ZipPackResult, ZipProgress } from '@stem-packer/pack-engine';
import type { AudioFileItem } from '../../shared/preferences';
import { PreferencesStore, ArtistStore } from '../stores';
import { PackingManager } from '../packingManager';
import { INFO_TXT_LABELS } from '../info-labels';
import type { PackingProgressEvent } from '../../shared/packing';

describe('PackingManager cancellation', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'stem-packer-pack-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test('cancel leaves no partial archives on disk', async () => {
    const preferencesStore = new PreferencesStore(tempRoot);
    const artistStore = new ArtistStore(tempRoot);
    await Promise.all([preferencesStore.load(), artistStore.load()]);
    await preferencesStore.set({
      targetSizeMB: 1,
      format: 'zip',
      outputDir: 'output',
    });

    const inputDir = path.join(tempRoot, 'input');
    const outputDir = path.join(inputDir, 'output');
    await fs.mkdir(inputDir, { recursive: true });

    const audioPath = path.join(inputDir, 'session.wav');
    writeFileSync(audioPath, Buffer.alloc(1024 * 1024, 1));
    const audioItem: AudioFileItem = {
      name: 'session.wav',
      relativePath: 'session.wav',
      extension: '.wav',
      sizeBytes: 1024 * 1024,
      fullPath: audioPath,
    };

    const progressEvents: PackingProgressEvent[] = [];

    const delayedZipRunner = async (options: ZipPackOptions): Promise<ZipPackResult> => {
      const archiveName = `${options.archiveBaseName}-01.zip`;
      const archivePath = path.join(options.outputDir, archiveName);
      await fs.mkdir(options.outputDir, { recursive: true });
      options.onProgress?.({
        state: 'packing',
        current: 0,
        total: 1,
        percent: 0,
        message: `Packing ${archiveName}`,
        currentArchive: archiveName,
      } satisfies ZipProgress);

      let aborted = false;
      const abortHandler = () => {
        aborted = true;
      };
      options.signal?.addEventListener('abort', abortHandler, { once: true });

      writeFileSync(archivePath, Buffer.alloc(512 * 1024, 1));
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (aborted) {
        await fs.rm(archivePath, { force: true });
        options.onProgress?.({
          state: 'cancelled',
          current: 0,
          total: 1,
          percent: 0,
          message: 'Packing cancelled',
          currentArchive: archiveName,
        } satisfies ZipProgress);
        throw new AbortPackingError();
      }

      options.onProgress?.({
        state: 'completed',
        current: 1,
        total: 1,
        percent: 100,
        message: 'Packing complete',
        currentArchive: archiveName,
      } satisfies ZipProgress);

      return {
        plan: [
          {
            archiveName,
            files: options.files,
          },
        ],
        outputPaths: [archivePath],
      };
    };

    const manager = new PackingManager({
      preferencesStore,
      artistStore,
      emitProgress: (event) => {
        progressEvents.push(event);
      },
      zipRunner: delayedZipRunner,
    });

    const startPromise = manager.start({
      folderPath: inputDir,
      files: [audioItem],
      info: {
        title: 'Cancelled Session',
        artist: 'Cancel Artist',
        album: '',
        bpm: '',
        key: '',
        license: '',
        attribution: '',
      },
      artist: 'Cancel Artist',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    const cancelled = await manager.cancel();
    await expect(startPromise).rejects.toBeInstanceOf(AbortPackingError);
    expect(cancelled).toBe(true);

    const outputs = await fs.readdir(outputDir).catch(() => [] as string[]);
    expect(outputs.filter((name) => name.endsWith('.zip'))).toHaveLength(0);
    expect(progressEvents.some((event) => event.state === 'cancelled')).toBe(true);
  });
});

describe('PackingManager metadata forwarding', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'stem-packer-metadata-'));
    vi.mocked(packZipBestFit).mockReset();
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test('embeds request info fields into metadata artifacts', async () => {
    const preferencesStore = new PreferencesStore(tempRoot);
    const artistStore = new ArtistStore(tempRoot);
    await Promise.all([preferencesStore.load(), artistStore.load()]);
    await preferencesStore.set({ targetSizeMB: 50, format: 'zip', outputDir: 'exports' });

    const inputDir = path.join(tempRoot, 'session');
    await fs.mkdir(inputDir, { recursive: true });
    const audioPath = path.join(inputDir, 'mix.wav');
    writeFileSync(audioPath, Buffer.alloc(64));

    const audioItem: AudioFileItem = {
      name: 'mix.wav',
      relativePath: 'mix.wav',
      extension: '.wav',
      sizeBytes: 64,
      fullPath: audioPath,
    };

    const capturedEntries: Array<{ entryName: string; content: Buffer | string }> = [];
    vi.mocked(packZipBestFit).mockImplementation(async (options) => {
      capturedEntries.splice(0, capturedEntries.length, ...options.metadataEntries);
      return {
        plan: [
          {
            archiveName: `${options.archiveBaseName}-01.zip`,
            files: options.files,
          },
        ],
        outputPaths: [path.join(options.outputDir, `${options.archiveBaseName}-01.zip`)],
      } as ZipPackResult;
    });

    const manager = new PackingManager({
      preferencesStore,
      artistStore,
      statfs: async () => ({ bsize: 4096, bavail: 1024 * 1024 * 1024 } as never),
    });

    const requestInfo = {
      title: 'Midnight Session',
      artist: 'Producer',
      album: 'Night Tapes',
      bpm: '128',
      key: 'Am',
      license: 'CC-BY 4.0',
      attribution: 'Mixed by StemPacker',
    } as const;

    await manager.start({
      folderPath: inputDir,
      files: [audioItem],
      info: requestInfo,
    });

    expect(vi.mocked(packZipBestFit)).toHaveBeenCalled();

    const metadataEntry = capturedEntries.find((entry) => entry.entryName === 'PACK-METADATA.json');
    const infoEntry = capturedEntries.find((entry) => entry.entryName === 'INFO.txt');

    expect(metadataEntry).toBeDefined();
    expect(infoEntry).toBeDefined();

    const metadataPayload = JSON.parse((metadataEntry!.content as Buffer).toString('utf8')) as {
      info: Record<string, string>;
    };

    expect(metadataPayload.info).toEqual({
      title: requestInfo.title,
      artist: requestInfo.artist,
      album: requestInfo.album,
      bpm: requestInfo.bpm,
      key: requestInfo.key,
      license: requestInfo.license,
      attribution: requestInfo.attribution,
    });

    const infoLines = (infoEntry!.content as Buffer)
      .toString('utf8')
      .trim()
      .split('\n');
    expect(infoLines).toEqual([
      `${INFO_TXT_LABELS.title}: ${requestInfo.title}`,
      `${INFO_TXT_LABELS.artist}: ${requestInfo.artist}`,
      `${INFO_TXT_LABELS.album}: ${requestInfo.album}`,
      `${INFO_TXT_LABELS.bpm}: ${requestInfo.bpm}`,
      `${INFO_TXT_LABELS.key}: ${requestInfo.key}`,
      `${INFO_TXT_LABELS.license}: ${requestInfo.license}`,
      `${INFO_TXT_LABELS.attribution}: ${requestInfo.attribution}`,
    ]);

    expect(artistStore.get().artist).toBe(requestInfo.artist);
  });
});
