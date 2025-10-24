import { describe, expect, it } from 'vitest';
import { planMultichannelSplit } from '../multichannelSplitPlanner.js';
import type { PlanMultichannelSplitOptions } from '../types.js';

const MB = 1024 * 1024;

describe('planMultichannelSplit', () => {
  it('plans mono outputs for a 5.1 WAV when it exceeds the target size', () => {
    const options: PlanMultichannelSplitOptions = {
      relativePath: 'sessions/mixdown.wav',
      bytes: 120 * MB,
      format: 'wav',
      channels: 6,
      channelLabels: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'],
      targetSizeMB: 50
    };

    const plan = planMultichannelSplit(options);

    expect(plan.shouldSplit).toBe(true);
    expect(plan.needsSevenZipOnly).toBe(false);
    expect(plan.outputs).toHaveLength(6);
    expect(plan.outputs.map((entry) => entry.relativePath)).toEqual([
      'sessions/mixdown_L.wav',
      'sessions/mixdown_R.wav',
      'sessions/mixdown_C.wav',
      'sessions/mixdown_LFE.wav',
      'sessions/mixdown_Ls.wav',
      'sessions/mixdown_Rs.wav'
    ]);

    const expectedSize = Math.ceil(options.bytes / options.channels) + 4096;
    for (const entry of plan.outputs) {
      expect(entry.estimatedSizeBytes).toBe(expectedSize);
    }
  });

  it('flags 7z-only when any 7.1 mono estimate still exceeds the target', () => {
    const options: PlanMultichannelSplitOptions = {
      relativePath: 'sessions/immersive.flac',
      bytes: 96 * MB,
      format: 'flac',
      channels: 8,
      channelLabels: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs', 'Lb', 'Rb'],
      targetSizeMB: 8
    };

    const plan = planMultichannelSplit(options);

    expect(plan.shouldSplit).toBe(true);
    expect(plan.needsSevenZipOnly).toBe(true);
    expect(plan.outputs).toHaveLength(8);
    expect(plan.outputs[0].relativePath).toBe('sessions/immersive_L.flac');
    expect(plan.outputs.at(-1)?.relativePath).toBe('sessions/immersive_Rb.flac');

    const expectedSize = Math.ceil(options.bytes / options.channels) + 4096;
    expect(plan.outputs.every((entry) => entry.estimatedSizeBytes === expectedSize)).toBe(true);
  });
});
