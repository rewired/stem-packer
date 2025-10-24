import { describe, expect, it } from 'vitest';
import { createTranslator } from '@stem-packer/i18n';

describe('i18n setup', () => {
  it('provides english translations', () => {
    const t = createTranslator('en');
    expect(t('app_title')).toBe('StemPacker');
  });
});
