import en from './locales/en.json';

type LocaleData = typeof en;
export type LocaleKey = 'en';
export type TranslationKey = keyof LocaleData;

const locales: Record<LocaleKey, LocaleData> = {
  en
};

export interface TranslatorOptions {
  fallbackLocale?: LocaleKey;
}

export function createTranslator(locale: LocaleKey, options: TranslatorOptions = {}) {
  const fallback = options.fallbackLocale ?? 'en';

  return (key: TranslationKey): string => {
    const catalog = locales[locale] ?? locales[fallback];
    return catalog[key] ?? locales[fallback][key];
  };
}

export function listAvailableLocales(): LocaleKey[] {
  return Object.keys(locales) as LocaleKey[];
}
