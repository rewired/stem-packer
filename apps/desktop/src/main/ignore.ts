import picomatch from 'picomatch';

export type IgnoreMatcher = (relativePath: string, isDirectory?: boolean) => boolean;

export function normalizeToPosixPath(input: string): string {
  if (input.length === 0) {
    return input;
  }
  return input.replace(/\\/g, '/');
}

export function createIgnoreMatcher(
  enabled: boolean,
  globs: string[]
): IgnoreMatcher {
  if (!enabled) {
    return () => false;
  }

  const patterns = globs.map((glob) => glob.trim()).filter((glob) => glob.length > 0);
  if (patterns.length === 0) {
    return () => false;
  }

  const matcher = picomatch(patterns, { dot: true });

  return (relativePath: string, isDirectory = false) => {
    if (!relativePath) {
      return false;
    }

    const normalized = normalizeToPosixPath(relativePath);
    if (matcher(normalized)) {
      return true;
    }

    if (isDirectory) {
      const withTrailingSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
      if (matcher(withTrailingSlash)) {
        return true;
      }
      return matcher(`${withTrailingSlash}__stem_packer_dir__`);
    }

    return false;
  };
}
