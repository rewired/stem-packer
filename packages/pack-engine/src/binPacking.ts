import { PackCandidate, ZipBinPlan } from './types.js';

export interface BinPackingOptions {
  archiveBaseName: string;
  targetSizeBytes: number;
  metadataOverheadBytes: number;
}

interface WorkingBin {
  files: PackCandidate[];
  usedBytes: number;
}

const ARCHIVE_PAD_WIDTH = 2;

export function buildZipPlan(
  files: PackCandidate[],
  options: BinPackingOptions,
): ZipBinPlan[] {
  const { archiveBaseName, targetSizeBytes, metadataOverheadBytes } = options;
  if (targetSizeBytes <= metadataOverheadBytes) {
    throw new Error('Target size must exceed metadata overhead.');
  }

  const capacityBytes = targetSizeBytes - metadataOverheadBytes;
  const sorted = [...files].sort((a, b) => {
    if (b.size === a.size) {
      return a.relativePath.localeCompare(b.relativePath, 'en');
    }
    return b.size - a.size;
  });

  const bins: WorkingBin[] = [];

  for (const file of sorted) {
    if (file.size > capacityBytes) {
      throw new Error(
        `File ${file.relativePath} exceeds target size (${file.size} > ${capacityBytes}).`,
      );
    }

    let bestFitIndex = -1;
    let smallestRemainder = Number.POSITIVE_INFINITY;

    for (let i = 0; i < bins.length; i += 1) {
      const bin = bins[i];
      const remainder = capacityBytes - (bin.usedBytes + file.size);
      if (remainder >= 0 && remainder < smallestRemainder) {
        bestFitIndex = i;
        smallestRemainder = remainder;
      }
    }

    if (bestFitIndex >= 0) {
      const bin = bins[bestFitIndex];
      bin.files.push(file);
      bin.usedBytes += file.size;
    } else {
      bins.push({ files: [file], usedBytes: file.size });
    }
  }

  return bins.map((bin, index) => ({
    archiveName: `${archiveBaseName}-${String(index + 1).padStart(ARCHIVE_PAD_WIDTH, '0')}.zip`,
    files: [...bin.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en')),
  }));
}
