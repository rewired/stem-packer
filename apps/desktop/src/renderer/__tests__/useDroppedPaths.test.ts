import { describe, expect, it } from 'vitest';
import { resolveDroppedFolder } from '../hooks/useDroppedPaths';

describe('useDroppedPaths helpers', () => {
  it('returns the common ancestor when multiple nested files are provided', () => {
    const folder = resolveDroppedFolder([
      '/input/session/Sub1/Stems 1.wav',
      '/input/session/Sub2/Nested/Stems 2.wav'
    ]);
    expect(folder).toBe('/input/session');
  });

  it('prefers explicit directory hints', () => {
    const folder = resolveDroppedFolder(['C:/Projects/Stems/', 'C:/Projects/Stems/song.wav']);
    expect(folder).toBe('C:/Projects/Stems');
  });

  it('returns a single POSIX directory without computing an ancestor', () => {
    const folder = resolveDroppedFolder(['/input/session/']);
    expect(folder).toBe('/input/session');
  });

  it('returns a single Windows directory without computing an ancestor', () => {
    const folder = resolveDroppedFolder(['C:\\Projects\\Stems\\']);
    expect(folder).toBe('C:\\Projects\\Stems');
  });
});
