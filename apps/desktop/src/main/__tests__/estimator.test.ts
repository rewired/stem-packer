import { describe, expect, it } from 'vitest';
import { estimateArchiveCount } from '../estimator';
import { DEFAULT_PREFERENCES, type AudioFileItem } from '../../shared/preferences';

const MB = 1024 * 1024;

function makeFile(partial: Partial<AudioFileItem>): AudioFileItem {
  return {
    name: partial.name ?? 'file.wav',
    relativePath: partial.relativePath ?? partial.name ?? 'file.wav',
    extension: partial.extension ?? '.wav',
    sizeBytes: partial.sizeBytes ?? 1 * MB,
    fullPath: partial.fullPath ?? `/tmp/${partial.name ?? 'file.wav'}`,
    channels: partial.channels
  };
}

describe('estimateArchiveCount', () => {
  it('produces deterministic results regardless of input ordering', () => {
    const preferences = { ...DEFAULT_PREFERENCES, targetSizeMB: 8 };

    const ordered = [
      makeFile({ name: 'a.wav', relativePath: 'a.wav', sizeBytes: 3 * MB }),
      makeFile({ name: 'b.wav', relativePath: 'b.wav', sizeBytes: 5 * MB }),
      makeFile({ name: 'c.wav', relativePath: 'c.wav', sizeBytes: 2 * MB })
    ];

    const shuffled = [...ordered].reverse();

    const estimateA = estimateArchiveCount(ordered, preferences);
    const estimateB = estimateArchiveCount(shuffled, preferences);

    expect(estimateA.totalBytes).toBe(estimateB.totalBytes);
    expect(estimateA.zipArchiveCount).toBe(estimateB.zipArchiveCount);
    expect(estimateA.sevenZipVolumeCount).toBe(estimateB.sevenZipVolumeCount);
    expect(estimateA.splitCount).toBe(0);
    expect(estimateB.splitCount).toBe(0);
  });

  it('accounts for multichannel mono splits when enabled', () => {
    const baseFile = makeFile({
      name: 'mix.wav',
      relativePath: 'mix.wav',
      sizeBytes: 12 * MB,
      channels: 2
    });

    const withoutSplit = estimateArchiveCount([baseFile], {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 8,
      auto_split_multichannel_to_mono: false
    });

    const withSplit = estimateArchiveCount([baseFile], {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 8,
      auto_split_multichannel_to_mono: true
    });

    expect(withoutSplit.splitCount).toBe(0);
    expect(withSplit.splitCount).toBe(2);
    expect(withSplit.totalBytes).toBeGreaterThan(withoutSplit.totalBytes);
    expect(withSplit.zipArchiveCount).toBeGreaterThanOrEqual(withoutSplit.zipArchiveCount);
    expect(withSplit.sevenZipVolumeCount).toBeGreaterThanOrEqual(withoutSplit.sevenZipVolumeCount);
  });
});
