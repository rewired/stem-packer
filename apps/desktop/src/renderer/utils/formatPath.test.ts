import { describe, expect, it } from 'vitest';

import { middleEllipsis } from './formatPath';

describe('middleEllipsis', () => {
  it('returns the original path when shorter than the maximum', () => {
    expect(middleEllipsis('/short/path', 48)).toBe('/short/path');
  });

  it('keeps unix root and last segment with an ellipsis', () => {
    const path = '/Users/example/projects/stem-packer/apps/desktop/src/renderer/components';
    expect(middleEllipsis(path, 32)).toBe('/…/components');
  });

  it('keeps windows drive and last segment', () => {
    const path =
      'C:/Users/example/Documents/StemPacker/very/long/folder/path/SelectionInfoBar.tsx';
    expect(middleEllipsis(path, 40)).toBe('C:/…/SelectionInfoBar.tsx');
  });

  it('keeps relative prefix and last segment', () => {
    const path = 'project/src/renderer/components/SelectionInfoBar.tsx';
    expect(middleEllipsis(path, 36)).toBe('project/…/SelectionInfoBar.tsx');
  });

  it('supports UNC shares', () => {
    const path = String.raw`\\server\share\projects\stem-packer\packages\ui\dist`;
    expect(middleEllipsis(path, 42)).toBe(String.raw`\\server\share\…\dist`);
  });

  it('truncates the last segment when necessary', () => {
    const path = 'C:/exports/folder-with-an-extraordinarily-long-name';
    const formatted = middleEllipsis(path, 30);
    expect(formatted).toBe('C:/…/extraordinarily-long-name');
    expect(formatted.length).toBeLessThanOrEqual(30);
  });
});
