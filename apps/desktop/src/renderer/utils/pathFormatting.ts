function stripTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

function splitIntoSegments(path: string): string[] {
  const parts = path.split(/[\\/]+/);
  if (parts.length === 0) {
    return parts;
  }

  if (parts[0] === '') {
    return parts.slice(1);
  }

  return parts;
}

function buildPathFromSegments(
  prefix: string,
  segments: string[],
  separator: '\\' | '/'
): string {
  if (segments.length === 0) {
    return prefix || (separator === '\\' ? '' : prefix);
  }

  const joined = segments.join(separator);
  return prefix ? `${prefix}${joined}` : joined;
}

export function computeCommonAncestor(paths: string[]): string | null {
  const normalized = paths
    .map((rawPath) => rawPath.trim())
    .filter((rawPath) => rawPath.length > 0)
    .map((rawPath) => stripTrailingSeparators(rawPath))
    .filter((rawPath) => rawPath.length > 0);

  if (normalized.length === 0) {
    return null;
  }

  const firstPath = normalized[0];
  const separator: '\\' | '/' = firstPath.includes('\\') ? '\\' : '/';
  const prefix = firstPath.startsWith('\\')
    ? '\\'
    : firstPath.startsWith('//')
      ? '//'
      : firstPath.startsWith('/') && separator === '/'
        ? '/'
        : '';
  const isLikelyWindows = prefix === '\\' || /^[A-Za-z]:/.test(firstPath);

  const segmentLists = normalized.map((path) => splitIntoSegments(path));

  let commonSegments = segmentLists[0].slice();

  for (let index = 1; index < segmentLists.length; index += 1) {
    const nextSegments = segmentLists[index];
    const limit = Math.min(commonSegments.length, nextSegments.length);
    let matchIndex = 0;

    while (matchIndex < limit) {
      const left = commonSegments[matchIndex];
      const right = nextSegments[matchIndex];
      const segmentsMatch = isLikelyWindows
        ? left.toLowerCase() === right.toLowerCase()
        : left === right;
      if (!segmentsMatch) {
        break;
      }
      matchIndex += 1;
    }

    commonSegments = commonSegments.slice(0, matchIndex);

    if (commonSegments.length === 0) {
      break;
    }
  }

  if (commonSegments.length === 0) {
    const fallbackSegments = segmentLists[0].slice(0, Math.max(segmentLists[0].length - 1, 0));
    return buildPathFromSegments(prefix, fallbackSegments, separator) || null;
  }

  if (normalized.length === 1 && commonSegments.length > 0) {
    commonSegments = commonSegments.slice(0, commonSegments.length - 1);
  }

  if (commonSegments.length === 0) {
    return buildPathFromSegments(prefix, segmentLists[0].slice(0, 1), separator) || null;
  }

  return buildPathFromSegments(prefix, commonSegments, separator);
}

export function stripDirectorySeparators(path: string): string {
  return stripTrailingSeparators(path);
}
