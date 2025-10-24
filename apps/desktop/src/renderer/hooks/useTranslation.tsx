import { createContext, useContext, type ReactNode } from 'react';
import { createTranslator, type LocaleKey, type TranslationKey } from '@stem-packer/i18n';

type Translator = ReturnType<typeof createTranslator>;

interface TranslationContextValue {
  locale: LocaleKey;
  t: Translator;
}

const TranslationContext = createContext<TranslationContextValue>({
  locale: 'en',
  t: createTranslator('en')
});

export function TranslationProvider({
  locale,
  children
}: {
  locale: LocaleKey;
  children: ReactNode;
}) {
  const translator = createTranslator(locale);

  return (
    <TranslationContext.Provider value={{ locale, t: translator }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  return ctx;
}

export type { LocaleKey, TranslationKey };
