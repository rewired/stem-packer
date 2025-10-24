import picomatch from 'picomatch';
import { PackCandidate } from './types.js';

const DEFAULT_IGNORES = [
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/~*',
  '**/*.tmp',
  '**/*.bak',
  '**/.git/**',
  '**/*.cue',
  '**/*.m3u*',
];

export function filterIgnored(
  files: PackCandidate[],
  customGlobs: string[] | undefined,
): PackCandidate[] {
  const globs = [...DEFAULT_IGNORES, ...(customGlobs ?? [])];
  const matchers = globs.map((pattern) => picomatch(pattern, { dot: true }));
  if (matchers.length === 0) {
    return files;
  }
  return files.filter((file) => !matchers.some((match) => match(file.relativePath)));
}
