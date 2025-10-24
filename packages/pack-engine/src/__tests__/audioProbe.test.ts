import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn();

vi.mock('node:child_process/promises', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import { channelMaskToLabels, probeAudio } from '../audioProbe.js';

describe('channelMaskToLabels', () => {
  it('returns fallback labels when mask is missing', () => {
    expect(channelMaskToLabels(undefined, 3)).toEqual(['ch01', 'ch02', 'ch03']);
  });

  it('maps stereo mask to canonical labels', () => {
    expect(channelMaskToLabels(0x3, 2)).toEqual(['L', 'R']);
  });

  it('maps 5.1 mask to surround labels', () => {
    expect(channelMaskToLabels(0x3f, 6)).toEqual(['L', 'R', 'C', 'LFE', 'Ls', 'Rs']);
  });

  it('falls back to generic labels when count mismatches mask bits', () => {
    expect(channelMaskToLabels(0x3, 3)).toEqual(['ch01', 'ch02', 'ch03']);
  });
});

describe('probeAudio', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('parses ffprobe json for wav format', async () => {
    execFileMock.mockResolvedValue({
      stdout: JSON.stringify({
        format: {
          format_name: 'wav',
          size: '1024',
        },
        streams: [
          {
            codec_type: 'audio',
            channels: 2,
            channel_mask: 0x3,
          },
        ],
      }),
      stderr: '',
    });

    const result = await probeAudio('/fake/path.wav');

    expect(execFileMock).toHaveBeenCalledWith(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '/fake/path.wav'],
      { env: undefined, encoding: 'utf8' },
    );
    expect(result).toEqual({
      format: 'wav',
      bytes: 1024,
      channels: 2,
      channelMask: 0x3,
      channelLabels: ['L', 'R'],
    });
  });

  it('handles AIFF probe with tag-based channel mask', async () => {
    execFileMock.mockResolvedValue({
      stdout: JSON.stringify({
        format: {
          format_name: 'aiff,pcm_s16be',
          size: '2048',
        },
        streams: [
          {
            codec_type: 'audio',
            channels: 6,
            tags: {
              WAVEFORMATEXTENSIBLE_CHANNEL_MASK: '0x3f',
            },
          },
        ],
      }),
      stderr: '',
    });

    const result = await probeAudio('/fake/path.aiff', { ffprobePath: '/usr/bin/ffprobe' });

    expect(execFileMock).toHaveBeenCalledWith(
      '/usr/bin/ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '/fake/path.aiff'],
      { env: undefined, encoding: 'utf8' },
    );
    expect(result).toEqual({
      format: 'aiff',
      bytes: 2048,
      channels: 6,
      channelMask: 0x3f,
      channelLabels: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'],
    });
  });

  it('throws when ffprobe output lacks audio stream', async () => {
    execFileMock.mockResolvedValue({
      stdout: JSON.stringify({
        format: {
          format_name: 'flac',
          size: '4096',
        },
        streams: [],
      }),
      stderr: '',
    });

    await expect(probeAudio('/fake/path.flac')).rejects.toThrow('No audio stream found in probe output');
  });
});
