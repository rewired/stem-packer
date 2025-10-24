import { describe, expect, it } from 'vitest';
import { INFO_TXT_LABELS } from '../../main/info-labels';
import { createTranslator, listAvailableLocales } from '@stem-packer/i18n';

describe('i18n setup', () => {
  it('provides english translations', () => {
    const t = createTranslator('en');
    expect(t('app_title')).toBe('StemPacker');
  });

  it('provides german translations', () => {
    const t = createTranslator('de');
    expect(t('button_choose_folder')).toBe('Ordner auswählen');
  });

  it('supports parameter interpolation', () => {
    const t = createTranslator('de');
    expect(t('toast_ignored_count', { count: 3 })).toBe('3 Dateien ignoriert');
  });
});

describe('INFO.txt localization policy', () => {
  it('keeps INFO.txt labels fixed to English', () => {
    const locales = listAvailableLocales();

    for (const locale of locales) {
      const translator = createTranslator(locale);

      expect(INFO_TXT_LABELS).toEqual({
        title: 'Title',
        artist: 'Artist',
        album: 'Album',
        bpm: 'BPM',
        key: 'Key',
        license: 'License',
        attribution: 'Attribution'
      });

      expect(translator('heading_welcome')).not.toBe(INFO_TXT_LABELS.title);
    }
  });
});
