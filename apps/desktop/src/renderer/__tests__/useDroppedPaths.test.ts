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
});
