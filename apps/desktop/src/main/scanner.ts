import fs from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import path from 'node:path';
import {
  AUDIO_EXTENSIONS,
  type AudioFileItem,
  type Preferences,
  type ScanResult
} from '../shared/preferences';
import { createIgnoreMatcher, normalizeToPosixPath } from './ignore';
import { estimateArchiveCount } from './estimator';

const audioExtensions = new Set(AUDIO_EXTENSIONS.map((extension) => extension.toLowerCase()));

function normalizeExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export async function scanAudioFiles(
  folderPath: string,
  preferences: Preferences
): Promise<ScanResult> {
  const files: AudioFileItem[] = [];
  let ignoredCount = 0;
  const stack: string[] = [folderPath];
  const shouldIgnore = createIgnoreMatcher(preferences.ignore_enabled, preferences.ignore_globs);

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    let dirEntries: Dirent[];
    try {
      dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error('Failed to read directory', currentDir, error);
      continue;
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(currentDir, entry.name);
      const relative = path.relative(folderPath, fullPath);
      const posixRelative = normalizeToPosixPath(relative);
      const isDirectory = entry.isDirectory();

      if (posixRelative && shouldIgnore(posixRelative, isDirectory)) {
        ignoredCount += 1;
        continue;
      }

      if (isDirectory) {
        stack.push(fullPath);
        continue;
      }

      const extension = normalizeExtension(entry.name);
      if (!audioExtensions.has(extension)) {
        continue;
      }

      let stats: Stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (error) {
        console.error('Failed to stat file', fullPath, error);
        continue;
      }

      files.push({
        name: entry.name,
        relativePath: posixRelative,
        extension,
        sizeBytes: stats.size,
        fullPath
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const { monoSplitTooLargeFiles } = estimateArchiveCount(files, preferences);

  return {
    folderPath,
    files,
    ignoredCount,
    monoSplitTooLargeFiles
  };
}
