import { execFile } from 'node:child_process/promises';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ExecuteMultichannelSplitOptions,
  ExecuteMultichannelSplitResult,
  MonoSplitCandidate,
  MonoChannelSplitPlan,
} from './types.js';

const TEMP_DIR_PREFIX = 'stem-packer-split-';

function toAbortError(signal: AbortSignal): Error {
  const { reason } = signal;
  if (reason instanceof Error) {
    return reason;
  }

  const message = typeof reason === 'string' && reason.length > 0 ? reason : 'The operation was aborted';
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }

  throw toAbortError(signal);
}

function normaliseRelativePath(relativePath: string): string {
  const normalised = path.posix.normalize(relativePath);
  if (!normalised || normalised === '.' || normalised.startsWith('..')) {
    throw new Error(`Invalid relative path in split plan: ${relativePath}`);
  }
  return normalised;
}

function toFileSystemPath(root: string, relativePath: string): string {
  const segments = normaliseRelativePath(relativePath).split('/');
  return path.join(root, ...segments);
}

function mapChannelArgument(plan: MonoChannelSplitPlan): string {
  return `0.0.${plan.channelIndex}`;
}

async function ensureParentDirectory(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function removeDirectory(target: string) {
  await fs.rm(target, { recursive: true, force: true });
}

async function runChannelExtraction(
  binary: string,
  sourceAbsolutePath: string,
  outputPath: string,
  plan: MonoChannelSplitPlan,
  signal: AbortSignal | undefined,
): Promise<void> {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    sourceAbsolutePath,
    '-map_channel',
    mapChannelArgument(plan),
    '-c',
    'copy',
    outputPath,
  ];

  await execFile(binary, args, { signal });
}

async function buildCandidate(
  options: ExecuteMultichannelSplitOptions,
  plan: MonoChannelSplitPlan,
  outputPath: string,
): Promise<MonoSplitCandidate> {
  const stats = await fs.stat(outputPath);
  return {
    absolutePath: outputPath,
    relativePath: normaliseRelativePath(plan.relativePath),
    size: stats.size,
    stats: { mtime: stats.mtime, mtimeMs: stats.mtimeMs },
    channelIndex: plan.channelIndex,
    channelLabel: plan.channelLabel,
    derivedFrom: options.sourceRelativePath,
    channelMapSource: plan.channelMapSource,
  };
}

export async function executeMultichannelSplit(
  options: ExecuteMultichannelSplitOptions,
): Promise<ExecuteMultichannelSplitResult> {
  const { plan } = options;

  if (!plan.shouldSplit || plan.outputs.length === 0) {
    return {
      tempDir: null,
      outputs: [],
      cleanup: async () => {},
    };
  }

  throwIfAborted(options.signal);

  const tempRootBase = options.tempDir ?? os.tmpdir();
  const tempDir = await fs.mkdtemp(path.join(tempRootBase, TEMP_DIR_PREFIX));

  try {
    const ffmpegBinary = options.ffmpegPath ?? 'ffmpeg';
    const results: MonoSplitCandidate[] = [];

    for (const channelPlan of plan.outputs) {
      throwIfAborted(options.signal);
      const outputPath = toFileSystemPath(tempDir, channelPlan.relativePath);
      await ensureParentDirectory(outputPath);
      await runChannelExtraction(
        ffmpegBinary,
        options.sourceAbsolutePath,
        outputPath,
        channelPlan,
        options.signal,
      );
      throwIfAborted(options.signal);
      results.push(await buildCandidate(options, channelPlan, outputPath));
    }

    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (options.signal) {
        options.signal.removeEventListener('abort', abortHandler);
      }
      await removeDirectory(tempDir);
    };

    const abortHandler = () => {
      void cleanup().catch(() => {
        // Swallow cleanup errors during abort to avoid unhandled rejections.
      });
    };

    if (options.signal) {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    return {
      tempDir,
      outputs: results,
      cleanup,
    };
  } catch (error) {
    await removeDirectory(tempDir);
    throw error;
  }
}
