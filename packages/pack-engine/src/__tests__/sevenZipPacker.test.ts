import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as childProcess from 'node:child_process';
import { path7za } from '7zip-bin';
import { pack7zVolumes } from '../sevenZipPacker.js';
import { AbortPackingError, PackCandidate } from '../types.js';

function createTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'pack-engine-7z-'));
}

function createFile(root: string, relativePath: string, size: number) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, Buffer.alloc(size, 1));
  return absolutePath;
}

describe('pack7zVolumes', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const metadataEntries = [
    { entryName: 'PACK-METADATA.json', content: JSON.stringify({ ok: true }) },
    { entryName: 'INFO.txt', content: 'Title: Example' },
  ];

  test('creates numbered volumes with metadata written once at the archive root', async () => {
    const inputDir = path.join(tempDir, 'input');
    const outputDir = path.join(tempDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const files: PackCandidate[] = [
      {
        absolutePath: createFile(inputDir, 'mix/take-01.wav', 2048),
        relativePath: 'mix/take-01.wav',
        size: 2048,
      },
      {
        absolutePath: createFile(inputDir, 'mix/take-02.wav', 2048),
        relativePath: 'mix/take-02.wav',
        size: 2048,
      },
      {
        absolutePath: createFile(inputDir, 'mix/ignore.tmp', 1024),
        relativePath: 'mix/ignore.tmp',
        size: 1024,
      },
    ];

    const result = await pack7zVolumes({
      files,
      archiveBaseName: 'stems',
      targetSizeMB: 0.002,
      outputDir,
      metadataEntries,
      ignoreGlobs: ['**/*.tmp'],
      sevenZipBinaryPath: path7za,
    });

    expect(result.outputPaths.length).toBeGreaterThan(1);
    expect(result.outputPaths[0]).toMatch(/\.7z\.001$/);
    expect(result.files).toHaveLength(2);

    const listOutput = await new Promise<string>((resolve, reject) => {
      const child = childProcess.spawn(path7za, ['l', result.outputPaths[0]]);
      let stdout = '';
      let stderr = '';
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `7z exited with code ${code}`));
        }
      });
    });

    const metadataMatches = listOutput.match(/PACK-METADATA\.json/g) ?? [];
    const infoMatches = listOutput.match(/INFO\.txt/g) ?? [];
    const ignoredMatches = listOutput.match(/ignore\.tmp/g) ?? [];

    expect(metadataMatches).toHaveLength(1);
    expect(infoMatches).toHaveLength(1);
    expect(ignoredMatches).toHaveLength(0);
  });

  test('removes orphaned parts when the 7z process fails', async () => {
    const inputDir = path.join(tempDir, 'input');
    const outputDir = path.join(tempDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const files: PackCandidate[] = [
      {
        absolutePath: createFile(inputDir, 'mix/take.wav', 1024),
        relativePath: 'mix/take.wav',
        size: 1024,
      },
    ];

    const scriptPath = path.join(tempDir, 'fake-7z.mjs');
    await fs.writeFile(
      scriptPath,
      `#!/usr/bin/env node\n` +
        "import { promises as fs } from 'node:fs';\n" +
        "import path from 'node:path';\n" +
        'const args = process.argv.slice(2);\n' +
        "const archiveArg = args.find((arg) => arg.includes('.7z'));\n" +
        "const listArg = args.find((arg) => arg.startsWith('@'));\n" +
        'const cwd = process.cwd();\n' +
        'if (listArg) {\n' +
        '  try {\n' +
        '    await fs.readFile(path.join(cwd, listArg.slice(1)), \'utf8\');\n' +
        '  } catch {\n' +
        '    // ignore\n' +
        '  }\n' +
        '}\n' +
        'if (archiveArg) {\n' +
        '  const partPath = `${archiveArg}.001`;\n' +
        '  await fs.mkdir(path.dirname(partPath), { recursive: true });\n' +
        "  await fs.writeFile(partPath, 'partial');\n" +
        '}\n' +
        "console.error('simulated failure');\n" +
        'process.exit(2);\n',
      { mode: 0o755 },
    );

    await expect(
      pack7zVolumes({
        files,
        archiveBaseName: 'stems',
        targetSizeMB: 0.001,
        outputDir,
        metadataEntries,
        sevenZipBinaryPath: scriptPath,
      }),
    ).rejects.toThrow(/7z exited/);

    const entries = await fs.readdir(outputDir);
    expect(entries.filter((name) => name.startsWith('stems.7z'))).toHaveLength(0);
  });

  test('aborting the signal cancels packing and removes temporary volumes', async () => {
    const inputDir = path.join(tempDir, 'input');
    const outputDir = path.join(tempDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const largeFile = createFile(inputDir, 'mix/long.wav', 8 * 1024 * 1024);
    const controller = new AbortController();

    const packPromise = pack7zVolumes({
      files: [
        {
          absolutePath: largeFile,
          relativePath: 'mix/long.wav',
          size: 8 * 1024 * 1024,
        },
      ],
      archiveBaseName: 'stems',
      targetSizeMB: 1,
      outputDir,
      metadataEntries,
      sevenZipBinaryPath: path7za,
      signal: controller.signal,
    });

    controller.abort();

    await expect(packPromise).rejects.toBeInstanceOf(AbortPackingError);
    const entries = await fs.readdir(outputDir);
    expect(entries.filter((name) => name.startsWith('stems.7z'))).toHaveLength(0);
  });
});
