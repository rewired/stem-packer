import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as childProcess from 'node:child_process';
import { path7za } from '7zip-bin';
import { filterIgnored } from './filters.js';
import {
  AbortPackingError,
  MetadataEntry,
  PackCandidate,
  SevenZipPackOptions,
  SevenZipPackResult,
  SevenZipProgress,
} from './types.js';

function toBuffer(content: string | Buffer): Buffer {
  return typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
}

function emitProgress(
  callback: SevenZipPackOptions['onProgress'],
  progress: SevenZipProgress,
) {
  callback?.({ ...progress });
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    try {
      await fs.access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

async function locateSevenZipOnPath(): Promise<string | null> {
  const pathVariable = process.env.PATH ?? '';
  const segments = pathVariable.split(path.delimiter).filter(Boolean);
  const candidates = process.platform === 'win32'
    ? ['7z.exe', '7za.exe', '7zz.exe']
    : ['7z', '7za', '7zz'];

  for (const segment of segments) {
    for (const candidate of candidates) {
      const candidatePath = path.join(segment, candidate);
      if (await fileExists(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

let resolvedSevenZipPath: string | null = null;

async function ensureExecutable(binaryPath: string) {
  try {
    await fs.chmod(binaryPath, 0o755);
  } catch {
    // Ignore permission failures; the binary may already be executable or immutable.
  }
}

export async function resolveSevenZipBinary(customPath?: string): Promise<string> {
  if (customPath) {
    await ensureExecutable(customPath);
    return customPath;
  }

  if (resolvedSevenZipPath) {
    return resolvedSevenZipPath;
  }

  const envOverride = process.env.STEM_PACKER_7Z_PATH;
  if (envOverride) {
    resolvedSevenZipPath = envOverride;
    await ensureExecutable(resolvedSevenZipPath);
    return resolvedSevenZipPath;
  }

  const located = await locateSevenZipOnPath();
  if (located) {
    resolvedSevenZipPath = located;
    await ensureExecutable(resolvedSevenZipPath);
    return resolvedSevenZipPath;
  }

  resolvedSevenZipPath = path7za;
  await ensureExecutable(resolvedSevenZipPath);
  return resolvedSevenZipPath;
}

async function stageMetadata(stagingRoot: string, entries: MetadataEntry[]) {
  for (const entry of entries) {
    const destination = path.join(stagingRoot, entry.entryName);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, toBuffer(entry.content));
  }
}

async function stageFile(stagingRoot: string, candidate: PackCandidate) {
  const destination = path.join(stagingRoot, candidate.relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.link(candidate.absolutePath, destination);
  } catch {
    await fs.copyFile(candidate.absolutePath, destination);
  }
}

async function createListFile(
  stagingRoot: string,
  metadataEntries: MetadataEntry[],
  files: PackCandidate[],
) {
  const entries = new Set<string>();
  for (const metadata of metadataEntries) {
    entries.add(metadata.entryName);
  }
  for (const file of files) {
    entries.add(file.relativePath);
  }
  const listPath = path.join(stagingRoot, '__pack-list.txt');
  await fs.writeFile(listPath, Array.from(entries).join('\n'), 'utf8');
  return listPath;
}

async function removeArchiveOutputs(outputDir: string, archiveBase: string) {
  try {
    const entries = await fs.readdir(outputDir);
    await Promise.all(
      entries
        .filter((name) => name === archiveBase || name.startsWith(`${archiveBase}.`))
        .map((name) => fs.rm(path.join(outputDir, name), { force: true })),
    );
  } catch {
    // ignore cleanup errors
  }
}

function parsePercent(text: string): number | null {
  const matches = text.match(/(\d{1,3})%/g);
  if (!matches) {
    return null;
  }
  const last = matches.at(-1);
  if (!last) {
    return null;
  }
  const value = parseInt(last.replace('%', ''), 10);
  if (Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

function sortArchiveParts(archiveBase: string, names: string[]): string[] {
  const basePattern = new RegExp(`^${archiveBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.(\\d+))?$`);
  return names
    .map((name) => {
      const match = basePattern.exec(name);
      const index = match?.[1] ? parseInt(match[1], 10) : match ? 0 : Number.POSITIVE_INFINITY;
      return { name, index };
    })
    .filter((entry) => entry.index !== Number.POSITIVE_INFINITY)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

export async function pack7zVolumes(options: SevenZipPackOptions): Promise<SevenZipPackResult> {
  const {
    files,
    outputDir,
    archiveBaseName,
    targetSizeMB,
    metadataEntries,
    ignoreGlobs,
    onProgress,
    signal,
    sevenZipBinaryPath,
  } = options;

  const abortIfSignalled = () => {
    if (signal?.aborted) {
      throw new AbortPackingError();
    }
  };

  abortIfSignalled();

  const filteredFiles = filterIgnored(files, ignoreGlobs).map<PackCandidate>((file) => ({
    ...file,
    relativePath: normalizeRelativePath(file.relativePath),
  }));

  const archiveBase = `${archiveBaseName}.7z`;
  const archiveTarget = path.join(outputDir, archiveBase);
  const binary = await resolveSevenZipBinary(sevenZipBinaryPath);
  const volumeSizeBytes = Math.max(1, Math.floor(targetSizeMB * 1024 * 1024));

  await ensureDirectory(outputDir);

  emitProgress(onProgress, {
    state: 'packing',
    current: 0,
    total: 1,
    percent: 0,
    message: `Packing ${archiveBase}`,
    currentArchive: archiveBase,
  });

  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'stem-packer-7z-'));

  try {
    await stageMetadata(stagingRoot, metadataEntries);
    abortIfSignalled();
    for (const file of filteredFiles) {
      abortIfSignalled();
      await stageFile(stagingRoot, file);
    }

    const listPath = await createListFile(stagingRoot, metadataEntries, filteredFiles);

    const args = [
      'a',
      '-t7z',
      '-mx=0',
      `-v${volumeSizeBytes}b`,
      archiveTarget,
      `@${path.basename(listPath)}`,
    ];

    const child = childProcess.spawn(binary, args, {
      cwd: stagingRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let aborted = false;
    const abortHandler = () => {
      aborted = true;
      child.kill('SIGTERM');
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        const percent = parsePercent(chunk);
        if (percent !== null) {
          emitProgress(onProgress, {
            state: 'packing',
            current: 0,
            total: 1,
            percent,
            message: `Packing ${archiveBase}`,
            currentArchive: archiveBase,
          });
        }
      });
    }

    let stderrBuffer = '';
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderrBuffer += chunk;
      });
    }

    const exitCode: number = await new Promise((resolve, reject) => {
      child.once('error', (error) => {
        reject(error);
      });
      child.once('close', (code) => {
        resolve(code ?? 0);
      });
    });

    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }

    if (aborted || exitCode !== 0) {
      if (aborted) {
        emitProgress(onProgress, {
          state: 'cancelled',
          current: 0,
          total: 1,
          percent: 0,
          message: 'Packing cancelled',
          currentArchive: archiveBase,
        });
        await removeArchiveOutputs(outputDir, archiveBase);
        throw new AbortPackingError();
      }

      await removeArchiveOutputs(outputDir, archiveBase);
      throw new Error(`7z exited with code ${exitCode}${stderrBuffer ? `: ${stderrBuffer.trim()}` : ''}`);
    }
  } catch (error) {
    if (error instanceof AbortPackingError) {
      throw error;
    }
    await removeArchiveOutputs(outputDir, archiveBase);
    throw error;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }

  const entries = await fs.readdir(outputDir);
  const archiveNames = sortArchiveParts(archiveBase, entries);
  const outputPaths = archiveNames.map((name) => path.join(outputDir, name));

  emitProgress(onProgress, {
    state: 'completed',
    current: 1,
    total: 1,
    percent: 100,
    message: 'Packing complete',
    currentArchive: archiveBase,
  });

  return {
    outputPaths,
    archiveBase,
    volumeSizeBytes,
    files: filteredFiles,
  };
}
