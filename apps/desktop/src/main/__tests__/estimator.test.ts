import { describe, expect, it } from 'vitest';
import {
  estimateArchiveCount,
  predictExcessNonSplittables,
  predictMonoSplitCandidates
} from '../estimator';
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
    expect(estimateA.splitCandidateCount).toBe(0);
    expect(estimateB.splitCandidateCount).toBe(0);
    expect(estimateA.monoSplitTooLargeFiles).toHaveLength(0);
    expect(estimateB.monoSplitTooLargeFiles).toHaveLength(0);
    expect(estimateA.nonSplittableExcesses).toHaveLength(0);
    expect(estimateB.nonSplittableExcesses).toHaveLength(0);
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
    expect(withoutSplit.splitCandidateCount).toBe(1);
    expect(withSplit.splitCount).toBe(2);
    expect(withSplit.splitCandidateCount).toBe(1);
    expect(withoutSplit.monoSplitTooLargeFiles).toHaveLength(0);
    expect(withSplit.monoSplitTooLargeFiles).toHaveLength(0);
    expect(withoutSplit.nonSplittableExcesses.map((item) => item.fileId)).toEqual([
      'mix.wav'
    ]);
    expect(withSplit.nonSplittableExcesses).toHaveLength(0);
    expect(withSplit.totalBytes).toBeGreaterThan(withoutSplit.totalBytes);
    expect(withSplit.zipArchiveCount).toBeGreaterThanOrEqual(withoutSplit.zipArchiveCount);
    expect(withSplit.sevenZipVolumeCount).toBeGreaterThanOrEqual(withoutSplit.sevenZipVolumeCount);
  });

  it('records split candidates that exceed the mono target size', () => {
    const largeFile = makeFile({
      name: 'orchestra.wav',
      relativePath: 'orchestra.wav',
      sizeBytes: 40 * MB,
      channels: 2
    });

    const estimate = estimateArchiveCount([largeFile], {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 8,
      auto_split_multichannel_to_mono: true
    });

    expect(estimate.splitCandidateCount).toBe(1);
    expect(estimate.splitCount).toBe(0);
    expect(estimate.monoSplitTooLargeFiles.map((file) => file.relativePath)).toEqual([
      'orchestra.wav'
    ]);
    expect(estimate.nonSplittableExcesses.map((item) => item.fileId)).toEqual([
      'orchestra.wav'
    ]);
  });

  it('predicts which files will be split into mono assets', () => {
    const stereo = makeFile({
      name: 'mix.wav',
      relativePath: 'mix.wav',
      sizeBytes: 12 * MB,
      channels: 2
    });
    const smallStereo = makeFile({
      name: 'small.wav',
      relativePath: 'small.wav',
      sizeBytes: 2 * MB,
      channels: 2
    });

    const preferences = {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 8,
      auto_split_multichannel_to_mono: true
    };

    const result = predictMonoSplitCandidates([stereo, smallStereo], preferences);

    expect(result.map((file) => file.relativePath)).toEqual(['mix.wav']);
  });
});

describe('predictExcessNonSplittables', () => {
  it('classifies severity for files that cannot be split under the ZIP limit', () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 10,
      auto_split_multichannel_to_mono: true
    };

    const files = [
      makeFile({
        name: 'slightly-over.mp3',
        relativePath: 'slightly-over.mp3',
        extension: '.mp3',
        sizeBytes: 10 * MB + 1024
      }),
      makeFile({
        name: 'far-over.mp3',
        relativePath: 'far-over.mp3',
        extension: '.mp3',
        sizeBytes: 13 * MB
      }),
      makeFile({
        name: 'split-ok.wav',
        relativePath: 'split-ok.wav',
        extension: '.wav',
        sizeBytes: 12 * MB,
        channels: 2
      }),
      makeFile({
        name: 'split-too-large.wav',
        relativePath: 'split-too-large.wav',
        extension: '.wav',
        sizeBytes: 24 * MB,
        channels: 2
      })
    ];

    const predictions = predictExcessNonSplittables(files, preferences);

    expect(predictions).toHaveLength(3);
    expect(predictions.map((item) => [item.fileId, item.severity])).toEqual([
      ['slightly-over.mp3', 'warning'],
      ['far-over.mp3', 'critical'],
      ['split-too-large.wav', 'critical']
    ]);
  });

  it('flags lossless candidates when auto split is disabled', () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      targetSizeMB: 10,
      auto_split_multichannel_to_mono: false
    };

    const file = makeFile({
      name: 'stereo.wav',
      relativePath: 'stereo.wav',
      extension: '.wav',
      sizeBytes: 12 * MB,
      channels: 2
    });

    const predictions = predictExcessNonSplittables([file], preferences);

    expect(predictions).toHaveLength(1);
    expect(predictions[0]).toMatchObject({
      fileId: 'stereo.wav',
      severity: 'critical'
    });
  });
});
