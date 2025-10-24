import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildZipPlan } from '../binPacking.js';
import { packZipBestFit } from '../zipPacker.js';
import { AbortPackingError, PackCandidate } from '../types.js';

function createTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'pack-engine-'));
}

function createFile(dir: string, relativePath: string, size: number) {
  const absolutePath = path.join(dir, relativePath);
  const parent = path.dirname(absolutePath);
  mkdirSync(parent, { recursive: true });
  writeFileSync(absolutePath, Buffer.alloc(size, 1));
  return absolutePath;
}

describe('ZIP best-fit planner', () => {
  test('distributes files under the target size using best-fit', () => {
    const files: PackCandidate[] = [
      { absolutePath: '/a', relativePath: 'a.wav', size: 8 },
      { absolutePath: '/b', relativePath: 'b.wav', size: 4 },
      { absolutePath: '/c', relativePath: 'c.wav', size: 4 },
      { absolutePath: '/d', relativePath: 'd.wav', size: 2 },
    ];

    const plan = buildZipPlan(files, {
      archiveBaseName: 'stems',
      targetSizeBytes: 12,
      metadataOverheadBytes: 2,
    });

    expect(plan).toHaveLength(2);
    const binSizes = plan.map((bin) => bin.files.reduce((sum, file) => sum + file.size, 0));
    expect(binSizes[0]).toBeLessThanOrEqual(10);
    expect(binSizes[1]).toBeLessThanOrEqual(10);
    expect(plan[0].archiveName).toBe('stems-01.zip');
    expect(plan[1].archiveName).toBe('stems-02.zip');
  });
});

describe('packZipBestFit', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const metadataEntries = [
    { entryName: 'PACK-METADATA.json', content: JSON.stringify({ ok: true }) },
    { entryName: 'INFO.txt', content: 'Title: Example' },
  ];

  test('excludes ignored files from the packing plan', async () => {
    createFile(tempDir, 'mix/session.wav', 1024);
    createFile(tempDir, 'mix/.DS_Store', 64);

    const result = await packZipBestFit({
      files: [
        {
          absolutePath: path.join(tempDir, 'mix/session.wav'),
          relativePath: 'mix/session.wav',
          size: 1024,
        },
        {
          absolutePath: path.join(tempDir, 'mix/.DS_Store'),
          relativePath: 'mix/.DS_Store',
          size: 64,
        },
      ],
      archiveBaseName: 'stems',
      targetSizeMB: 1,
      outputDir: tempDir,
      metadataEntries,
    });

    expect(result.plan).toHaveLength(1);
    expect(result.plan[0].files).toEqual([
      expect.objectContaining({ relativePath: 'mix/session.wav' }),
    ]);
  });

  test('aborting the signal cancels packing and removes partial archives', async () => {
    const bigFile = createFile(tempDir, 'take.wav', 5 * 1024 * 1024);

    const controller = new AbortController();
    const packPromise = packZipBestFit({
      files: [
        {
          absolutePath: bigFile,
          relativePath: 'take.wav',
          size: 5 * 1024 * 1024,
        },
      ],
      archiveBaseName: 'stems',
      targetSizeMB: 10,
      outputDir: tempDir,
      metadataEntries,
      signal: controller.signal,
    });

    controller.abort();

    await expect(packPromise).rejects.toBeInstanceOf(AbortPackingError);
    const entries = await fs.readdir(tempDir);
    expect(entries.filter((name) => name.endsWith('.zip'))).toHaveLength(0);
  });
});
