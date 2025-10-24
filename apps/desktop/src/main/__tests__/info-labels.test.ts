import { describe, expect, it } from 'vitest';
import { INFO_TXT_LABELS } from '../info-labels';

describe('INFO.txt labels', () => {
  it('remain fixed English strings', () => {
    expect(INFO_TXT_LABELS).toEqual({
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
      bpm: 'BPM',
      key: 'Key',
      license: 'License',
      attribution: 'Attribution'
    });
  });
});
