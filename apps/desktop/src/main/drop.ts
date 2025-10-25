import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ResolveDroppedPathsRequest,
  ResolveDroppedPathsResponse
} from '../shared/drop';

function uniqueNormalizedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of paths) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const resolved = path.resolve(trimmed);
    if (seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    results.push(resolved);
  }

  return results;
}

export async function resolveDroppedPaths(
  request: ResolveDroppedPathsRequest
): Promise<ResolveDroppedPathsResponse> {
  const { paths, candidate, hasDirectoryEntry } = request;
  const uniquePaths = uniqueNormalizedPaths(paths);

  const orderedCandidates = candidate
    ? [path.resolve(candidate), ...uniquePaths]
    : uniquePaths;

  for (const entry of orderedCandidates) {
    try {
      const stats = await fs.stat(entry);
      if (stats.isDirectory()) {
        return { status: 'success', folderPath: entry };
      }
    } catch (error) {
      // Ignore inaccessible paths and keep checking fallbacks.
      console.warn('Failed to inspect dropped path', entry, error);
    }
  }

  if (orderedCandidates.length === 0) {
    return { status: 'error', reason: hasDirectoryEntry ? 'unknown' : 'empty' };
  }

  if (hasDirectoryEntry) {
    return { status: 'error', reason: 'not_found' };
  }

  return { status: 'error', reason: 'not_directory' };
}
