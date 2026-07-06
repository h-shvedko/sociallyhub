import { Locale } from './config'

// ADR-0017 (Decision D3): dictionaries are now served STATICALLY only. The
// previous implementation called translationService.translateDictionary() at
// request time, machine-translating en.json through the OpenAI API for every
// non-en locale — unreviewed MT presented as localization, and silently English
// when OPENAI_API_KEY was unset. That runtime call was removed. Only reviewed
// static dictionaries under ./dictionaries/ are loaded; today only en.json
// exists, so every non-en locale falls back to English (no network, no OpenAI).
// To add a real locale: generate a draft (npm run i18n:generate), have a human
// review it, commit dictionaries/<locale>.json, register it below, and add the
// locale to `enabledLocales` in config.ts.
const dictionaries: Partial<Record<Locale, () => Promise<Dictionary>>> = {
  en: () => import('./dictionaries/en.json').then(module => module.default)
}

interface Dictionary {
  [key: string]: any
}

let dictionaryCache: Map<Locale, Dictionary> = new Map()

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  // Check cache first
  if (dictionaryCache.has(locale)) {
    return dictionaryCache.get(locale)!
  }

  try {
    // Load a reviewed static dictionary if one exists for this locale.
    const loader = dictionaries[locale]
    if (loader) {
      const dictionary = await loader()
      dictionaryCache.set(locale, dictionary)
      return dictionary
    }

    // No reviewed dictionary for this locale — fall back to English.
    // (No runtime machine-translation: honest English beats fabricated MT.)
    const fallbackDictionary = await dictionaries.en!()
    dictionaryCache.set(locale, fallbackDictionary)
    return fallbackDictionary
  } catch (error) {
    console.error(`Failed to load dictionary for locale ${locale}:`, error)

    // Last-resort fallback to English.
    const fallbackDictionary = await dictionaries.en!()
    return fallbackDictionary
  }
}

export function clearDictionaryCache(): void {
  dictionaryCache.clear()
}

export function getDictionaryCacheStats(): { locales: Locale[], totalSize: number } {
  const locales = Array.from(dictionaryCache.keys())
  const totalSize = JSON.stringify(Object.fromEntries(dictionaryCache)).length
  return { locales, totalSize }
}
