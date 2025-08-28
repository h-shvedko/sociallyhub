export const defaultLocale = 'en' as const
export const locales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar'] as const

export type Locale = typeof locales[number]

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية'
}

export const rtlLocales: Locale[] = ['ar']

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr'
}

export const translationConfig = {
  apiUrl: process.env.TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 50,
  cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
}