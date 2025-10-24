import en from './locales/en.json';
import de from './locales/de.json';

const FALLBACK_LOCALE = 'en' as const;

export type LocaleKey = 'en' | 'de';

const locales = {
  en,
  de
} satisfies Record<LocaleKey, typeof en>;

export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number>;

export interface TranslatorOptions {
  fallbackLocale?: LocaleKey;
}

function formatMessage(message: string, params?: TranslationParams): string {
  if (!params) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const value = params[key];
      return value != null ? String(value) : '';
    }

    return match;
  });
}

export function createTranslator(locale: LocaleKey, options: TranslatorOptions = {}) {
  const fallback = options.fallbackLocale ?? FALLBACK_LOCALE;

  return (key: TranslationKey, params?: TranslationParams): string => {
    const catalog = locales[locale] ?? locales[fallback];
    const fallbackCatalog = locales[fallback];
    const template = catalog[key] ?? fallbackCatalog[key];

    if (!template) {
      return key;
    }

    return formatMessage(template, params);
  };
}

export function listAvailableLocales(): LocaleKey[] {
  return Object.keys(locales) as LocaleKey[];
}
