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

import { AbortPackingError } from '@stem-packer/pack-engine';
import type { ZipPackOptions, ZipPackResult, ZipProgress } from '@stem-packer/pack-engine';
import type { AudioFileItem } from '../../shared/preferences';
import { PreferencesStore, ArtistStore } from '../stores';
import { PackingManager } from '../packingManager';
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
