import { ar } from '../i18n/ar';
import { en } from '../i18n/en';

export type Language = 'ar' | 'en';
export type TranslationObject = typeof ar;

export function pickT(lang: Language): TranslationObject {
  return lang === 'ar' ? ar : en;
}

export function htmlLangDir(lang: Language) {
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr'
  };
}

export function buildHreflang(currentLang: Language) {
  const alternateLinks = [
    { hreflang: 'ar', href: '/' },
    { hreflang: 'en', href: '/en/' },
  ];
  
  return alternateLinks.filter(link => link.hreflang !== currentLang);
}