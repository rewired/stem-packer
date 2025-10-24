import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn<
  (binary: string, args: string[], options: { signal?: AbortSignal }) => Promise<{ stdout?: string; stderr?: string }>
>();

vi.mock('node:child_process/promises', () => ({
  execFile: (...args: Parameters<typeof execFileMock>) => execFileMock(...args),
}));

import { executeMultichannelSplit } from '../multichannelSplitExecutor.js';
import type { ExecuteMultichannelSplitOptions, MultichannelSplitPlan } from '../types.js';

function createPlan(relativePath: string): MultichannelSplitPlan {
  return {
    shouldSplit: true,
    needsSevenZipOnly: false,
    outputs: [
      {
        channelIndex: 0,
        channelLabel: 'L',
        channelMapSource: 'mask',
        relativePath: relativePath.replace(/\.([^.]+)$/i, '_L.$1'),
        estimatedSizeBytes: 0,
      },
      {
        channelIndex: 1,
        channelLabel: 'R',
        channelMapSource: 'mask',
        relativePath: relativePath.replace(/\.([^.]+)$/i, '_R.$1'),
        estimatedSizeBytes: 0,
      },
    ],
  };
}

describe('executeMultichannelSplit', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates mono temps using channel labels and cleans up when requested', async () => {
    execFileMock.mockImplementation(async (_binary, args, _options) => {
      void _options;
      const outputPath = args.at(-1) as string;
      await fs.writeFile(outputPath, 'mono-channel');
      return { stdout: '', stderr: '' };
    });

    const plan = createPlan('mixdown.wav');
    const options: ExecuteMultichannelSplitOptions = {
      sourceAbsolutePath: '/fake/mixdown.wav',
      sourceRelativePath: 'mixdown.wav',
      plan,
    };

    const result = await executeMultichannelSplit(options);

    expect(execFileMock).toHaveBeenCalledTimes(2);
    const [firstCall] = execFileMock.mock.calls;
    expect(firstCall[0]).toBe('ffmpeg');
    expect(firstCall[1]).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      options.sourceAbsolutePath,
      '-map_channel',
      '0.0.0',
      '-c',
      'copy',
      expect.stringMatching(/mixdown_L\.wav$/),
    ]);

    expect(result.outputs).toHaveLength(2);
    const basenames = result.outputs.map((output) => path.basename(output.absolutePath));
    expect(basenames).toEqual(['mixdown_L.wav', 'mixdown_R.wav']);
    expect(result.outputs.map((output) => output.relativePath)).toEqual([
      'mixdown_L.wav',
      'mixdown_R.wav',
    ]);
    expect(result.outputs.map((output) => output.channelLabel)).toEqual(['L', 'R']);
    expect(result.outputs.map((output) => output.channelMapSource)).toEqual(['mask', 'mask']);
    expect(result.outputs.map((output) => output.channelIndex)).toEqual([0, 1]);
    expect(result.outputs.every((output) => output.derivedFrom === 'mixdown.wav')).toBe(true);

    const tempRoot = path.dirname(result.outputs[0]!.absolutePath);
    await result.cleanup();
    await expect(fs.access(tempRoot)).rejects.toThrow();
  });

  it('removes staged temps when extraction is aborted', async () => {
    const controller = new AbortController();

    execFileMock.mockImplementation(async (_binary, _args, _options) => {
      void _binary;
      void _args;
      void _options;
      controller.abort();
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    });

    const plan = createPlan('mixdown.wav');

    await expect(
      executeMultichannelSplit({
        sourceAbsolutePath: '/fake/mixdown.wav',
        sourceRelativePath: 'mixdown.wav',
        plan,
        signal: controller.signal,
      }),
    ).rejects.toHaveProperty('name', 'AbortError');

    const [[, args]] = execFileMock.mock.calls;
    const outputPath = args.at(-1) as string;
    const tempRoot = path.dirname(outputPath);
    await expect(fs.access(tempRoot)).rejects.toThrow();
  });
});
