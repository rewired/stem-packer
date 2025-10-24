import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { ZipFile } from 'yazl';
import { buildZipPlan } from './binPacking.js';
import { filterIgnored } from './filters.js';
import {
  AbortPackingError,
  MetadataEntry,
  PackCandidate,
  ZipPackOptions,
  ZipPackResult,
  ZipProgress,
} from './types.js';

const DETERMINISTIC_MTIME = new Date('1980-01-01T00:00:00Z');

function toBuffer(content: string | Buffer): Buffer {
  return typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
}

function emitProgress(callback: ZipPackOptions['onProgress'], progress: ZipProgress) {
  callback?.({ ...progress });
}

function computeMetadataOverhead(metadataEntries: MetadataEntry[]): number {
  return metadataEntries.reduce((total, entry) => total + toBuffer(entry.content).byteLength, 0);
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function packZipBestFit(options: ZipPackOptions): Promise<ZipPackResult> {
  const {
    files,
    outputDir,
    archiveBaseName,
    targetSizeMB,
    metadataEntries,
    ignoreGlobs,
    onProgress,
    signal,
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

  const metadataOverheadBytes = computeMetadataOverhead(metadataEntries);
  const targetSizeBytes = Math.floor(targetSizeMB * 1024 * 1024);
  const plan = buildZipPlan(filteredFiles, {
    archiveBaseName,
    targetSizeBytes,
    metadataOverheadBytes,
  });

  await ensureDirectory(outputDir);

  const outputPaths: string[] = [];
  emitProgress(onProgress, {
    state: 'packing',
    current: 0,
    total: plan.length,
    percent: plan.length === 0 ? 100 : 0,
    message: plan.length === 0 ? 'Nothing to pack' : 'Packing',
    currentArchive: plan.length === 0 ? null : plan[0].archiveName,
  });

  let completed = 0;

  for (const archivePlan of plan) {
    abortIfSignalled();

    emitProgress(onProgress, {
      state: 'packing',
      current: completed,
      total: plan.length,
      percent: plan.length === 0 ? 100 : Math.floor((completed / plan.length) * 100),
      message: `Packing ${archivePlan.archiveName}`,
      currentArchive: archivePlan.archiveName,
    });

    const zipFile = new ZipFile();
    const outputPath = path.join(outputDir, archivePlan.archiveName);
    const outputStream = createWriteStream(outputPath, { flags: 'w' });
    const openStreams = new Set<ReturnType<typeof createReadStream>>();
    const zipErrorListener = (error: Error) => {
      outputStream.destroy(error);
    };
    zipFile.outputStream.once('error', zipErrorListener);

    const teardown = (error?: Error) => {
      for (const stream of openStreams) {
        stream.destroy(error);
      }
      openStreams.clear();
    };

    const abortHandler = async () => {
      signal?.removeEventListener('abort', abortHandler);
      const abortError = new AbortPackingError();
      teardown(abortError);
      zipFile.end();
      outputStream.destroy(abortError);
      await fs.rm(outputPath, { force: true });
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      for (const entry of metadataEntries) {
        zipFile.addBuffer(toBuffer(entry.content), entry.entryName, {
          mtime: DETERMINISTIC_MTIME,
        });
      }

      for (const file of archivePlan.files) {
        const stream = createReadStream(file.absolutePath);
        openStreams.add(stream);
        const mtime = file.stats?.mtime ?? DETERMINISTIC_MTIME;
        zipFile.addReadStream(stream, file.relativePath, {
          mtime,
        });
        stream.once('error', (error) => {
          zipFile.end();
          outputStream.destroy(error);
        });
      }

      const closePromise = once(outputStream, 'close');
      const errorPromise = once(outputStream, 'error').then(([error]) => {
        throw error;
      });

      zipFile.outputStream.pipe(outputStream);
      zipFile.end();

      await Promise.race([closePromise.then(() => undefined), errorPromise]);
    } catch (error) {
      if (error instanceof AbortPackingError) {
        emitProgress(onProgress, {
          state: 'cancelled',
          current: completed,
          total: plan.length,
          percent: plan.length === 0 ? 0 : Math.floor((completed / plan.length) * 100),
          message: 'Packing cancelled',
          currentArchive: archivePlan.archiveName,
        });
        throw error;
      }
      await fs.rm(outputPath, { force: true });
      throw error;
    } finally {
      teardown();
      zipFile.outputStream.off('error', zipErrorListener);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }

    completed += 1;
    outputPaths.push(outputPath);

    emitProgress(onProgress, {
      state: 'packing',
      current: completed,
      total: plan.length,
      percent: plan.length === 0 ? 100 : Math.floor((completed / plan.length) * 100),
      message: `Finished ${archivePlan.archiveName}`,
      currentArchive: archivePlan.archiveName,
    });
  }

  emitProgress(onProgress, {
    state: 'completed',
    current: plan.length,
    total: plan.length,
    percent: 100,
    message: 'Packing complete',
    currentArchive: plan.length === 0 ? null : plan.at(-1)?.archiveName ?? null,
  });

  return {
    plan,
    outputPaths,
  };
}
