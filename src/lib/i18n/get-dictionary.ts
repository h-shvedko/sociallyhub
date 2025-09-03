import { Locale } from './config'
import translationService from './translation-service'

const dictionaries = {
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
    // For English, load the base dictionary
    if (locale === 'en') {
      const dictionary = await dictionaries.en()
      dictionaryCache.set(locale, dictionary)
      return dictionary
    }

    // For other languages, load English first then translate
    const baseDictionary = await dictionaries.en()
    const translatedDictionary = await translationService.translateDictionary(baseDictionary, locale)
    
    // Cache the translated dictionary
    dictionaryCache.set(locale, translatedDictionary)
    return translatedDictionary
  } catch (error) {
    console.error(`Failed to load dictionary for locale ${locale}:`, error)
    
    // Fallback to English dictionary
    const fallbackDictionary = await dictionaries.en()
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