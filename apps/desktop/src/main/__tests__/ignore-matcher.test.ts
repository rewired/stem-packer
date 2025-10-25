import { describe, expect, it } from 'vitest';
import { createIgnoreMatcher, normalizeToPosixPath } from '../ignore';

describe('ignore matcher', () => {
  it('does not ignore when disabled', () => {
    const matcher = createIgnoreMatcher(false, ['**/Thumbs.db']);
    expect(matcher('Thumbs.db')).toBe(false);
  });

  it('matches POSIX-style paths', () => {
    const matcher = createIgnoreMatcher(true, ['**/Thumbs.db', '**/.DS_Store', '**/~*']);
    expect(matcher('Thumbs.db')).toBe(true);
    expect(matcher('sub/.DS_Store')).toBe(true);
    expect(matcher('audio/~temp.wav')).toBe(true);
  });

  it('normalizes Windows paths before matching', () => {
    const matcher = createIgnoreMatcher(true, ['**/Thumbs.db', '**/~*']);
    expect(matcher('subdir\\Thumbs.db')).toBe(true);
    expect(matcher('cache\\~render.wav')).toBe(true);
  });

  it('skips directories that match a glob prefix', () => {
    const matcher = createIgnoreMatcher(true, ['**/.git/**']);
    expect(matcher('.git', true)).toBe(true);
    expect(matcher('nested/.git', true)).toBe(true);
  });

  it('exposes normalization helper', () => {
    expect(normalizeToPosixPath('foo\\bar/baz')).toBe('foo/bar/baz');
  });
});
