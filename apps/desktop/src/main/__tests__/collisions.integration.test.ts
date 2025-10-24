import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectOutputCollisions, overwriteOutputCollisions } from '../collisions';
import type { CollisionCheckPayload } from '../../shared/collisions';

const tmpRoot = path.join(os.tmpdir(), 'stem-packer-collisions-');
const activeDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(tmpRoot);
  activeDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (activeDirs.length > 0) {
    const dir = activeDirs.pop();
    if (!dir) continue;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('collision detection and overwrite', () => {
  it('detects and removes StemPacker ZIP archives', async () => {
    const directory = await createTempDir();
    const payload: CollisionCheckPayload = {
      inputFolder: directory,
      outputDir: directory,
      format: 'zip'
    };

    await fs.writeFile(path.join(directory, 'stems-01.zip'), 'one');
    await fs.writeFile(path.join(directory, 'stems-02.zip'), 'two');
    await fs.writeFile(path.join(directory, 'stems.zip'), 'ignore me');

    const detection = await detectOutputCollisions(payload);

    expect(detection.hasCollisions).toBe(true);
    expect(detection.kind).toBe('zip');
    expect(detection.collisionCount).toBe(2);
    expect(detection.outputDir).toBe(path.resolve(directory));

    const resolution = await overwriteOutputCollisions(payload);
    expect(resolution.deletedCount).toBe(2);
    expect(resolution.kind).toBe('zip');

    const remaining = await fs.readdir(directory);
    expect(remaining.sort()).toEqual(['stems.zip']);
  });

  it('detects and removes entire 7z volume series', async () => {
    const directory = await createTempDir();
    const payload: CollisionCheckPayload = {
      inputFolder: directory,
      outputDir: directory,
      format: '7z'
    };

    await fs.writeFile(path.join(directory, 'stems.7z.001'), 'part1');
    await fs.writeFile(path.join(directory, 'stems.7z.002'), 'part2');
    await fs.writeFile(path.join(directory, 'stems.7z'), 'manifest');
    await fs.writeFile(path.join(directory, 'stems.7z.bak'), 'backup');

    const detection = await detectOutputCollisions(payload);

    expect(detection.hasCollisions).toBe(true);
    expect(detection.kind).toBe('7z');
    expect(detection.collisionCount).toBe(3);

    const resolution = await overwriteOutputCollisions(payload);
    expect(resolution.deletedCount).toBe(3);
    expect(resolution.kind).toBe('7z');

    const remaining = await fs.readdir(directory);
    expect(remaining.sort()).toEqual(['stems.7z.bak']);
  });

  it('resolves collisions in a relative output directory', async () => {
    const inputFolder = await createTempDir();
    const outputFolder = path.join(inputFolder, 'exports');
    await fs.mkdir(outputFolder);

    const payload: CollisionCheckPayload = {
      inputFolder,
      outputDir: 'exports',
      format: 'zip'
    };

    await fs.writeFile(path.join(outputFolder, 'stems-99.zip'), 'payload');

    const detection = await detectOutputCollisions(payload);
    expect(detection.hasCollisions).toBe(true);
    expect(detection.outputDir).toBe(path.resolve(outputFolder));

    await overwriteOutputCollisions(payload);
    const remaining = await fs.readdir(outputFolder);
    expect(remaining).toHaveLength(0);
  });
});
