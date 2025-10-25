import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PREFERENCES, type AudioFileItem } from '../../shared/preferences';
import { estimateArchiveCount } from '../estimator';
import { filterPackableFiles } from '../packer';
import { scanAudioFiles } from '../scanner';

const tmpPrefix = 'stem-packer-ignore-';

describe('ignore integration', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), tmpPrefix));

    await fs.writeFile(path.join(tempDir, 'track1.wav'), Buffer.alloc(1024));
    await fs.writeFile(path.join(tempDir, 'mix.flac'), Buffer.alloc(2048));
    await fs.writeFile(path.join(tempDir, 'Thumbs.db'), 'ignored');
    await fs.writeFile(path.join(tempDir, '.DS_Store'), 'ignored');

    await fs.mkdir(path.join(tempDir, 'cache'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'cache', '~render.wav'), Buffer.alloc(1024));
    await fs.writeFile(path.join(tempDir, 'cache', 'keep.wav'), Buffer.alloc(1024));

    await fs.mkdir(path.join(tempDir, 'playlists'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'playlists', 'set.m3u8'), 'ignored');

    await fs.mkdir(path.join(tempDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(tempDir, '.git', 'HEAD'), 'ref: refs/heads/main');

    await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'subdir', 'beat.ogg'), Buffer.alloc(4096));
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('excludes ignored files from scanning, estimating, and packing', async () => {
    const preferences = { ...DEFAULT_PREFERENCES };
    const result = await scanAudioFiles(tempDir, preferences);

    expect(result.files.map((file) => file.relativePath)).toEqual([
      'cache/keep.wav',
      'mix.flac',
      'subdir/beat.ogg',
      'track1.wav'
    ]);
    expect(result.ignoredCount).toBe(5);
    expect(result.monoSplitTooLargeFiles).toHaveLength(0);

    const manualList: AudioFileItem[] = [
      ...result.files,
      {
        name: 'Thumbs.db',
        relativePath: 'Thumbs.db',
        extension: '.db',
        sizeBytes: 64,
        fullPath: path.join(tempDir, 'Thumbs.db')
      },
      {
        name: 'set.m3u8',
        relativePath: 'playlists/set.m3u8',
        extension: '.m3u8',
        sizeBytes: 64,
        fullPath: path.join(tempDir, 'playlists', 'set.m3u8')
      }
    ];

    const estimate = estimateArchiveCount(manualList, preferences);
    const expectedBytes = result.files.reduce((sum, file) => sum + file.sizeBytes, 0);
    expect(estimate.totalBytes).toBe(expectedBytes);
    expect(estimate.consideredFiles).toHaveLength(result.files.length);
    expect(estimate.zipArchiveCount).toBeGreaterThanOrEqual(1);
    expect(estimate.sevenZipVolumeCount).toBeGreaterThanOrEqual(1);

    const packable = filterPackableFiles(manualList, preferences);
    expect(packable).toEqual(result.files);
  });
});
