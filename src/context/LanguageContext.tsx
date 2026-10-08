import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { en } from '@/i18n/en';
import { bg } from '@/i18n/bg';

type Language = 'en' | 'bg';
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, any>> = { en, bg };

const LanguageContext = createContext<LanguageContextType | null>(null);

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved === 'bg' ? 'bg' : 'en') as Language;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem('app-language', lang);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(translations[language], key) || getNestedValue(translations.en, key) || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{{${k}}}`, String(v));
      });
    }
    return value;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

const fallbackT = (key: string) => {
  return getNestedValue(translations.en, key) || key;
};

const fallbackContext: LanguageContextType = {
  language: 'en',
  setLanguage: () => {},
  t: fallbackT,
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return ctx || fallbackContext;
}
