import { Locale, translationConfig } from './config'

interface TranslationCache {
  [key: string]: {
    translation: string
    timestamp: number
  }
}

interface TranslationRequest {
  text: string
  targetLanguage: string
  context?: string
}

class TranslationService {
  private cache: TranslationCache = {}
  private requestQueue: TranslationRequest[] = []
  private isProcessing = false

  private getCacheKey(text: string, targetLanguage: string, context?: string): string {
    return `${text}:${targetLanguage}:${context || ''}`
  }

  private isTranslationCached(key: string): boolean {
    const cached = this.cache[key]
    if (!cached) return false
    
    const isExpired = Date.now() - cached.timestamp > translationConfig.cacheExpiry
    if (isExpired) {
      delete this.cache[key]
      return false
    }
    
    return true
  }

  private async translateWithOpenAI(texts: string[], targetLanguage: string, context?: string): Promise<string[]> {
    if (!translationConfig.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const systemPrompt = `You are a professional translator specializing in software localization. 
    Translate the following texts to ${targetLanguage}.
    ${context ? `Context: This is for a ${context}` : ''}
    
    Important guidelines:
    - Maintain the tone and style appropriate for a social media management platform
    - Keep technical terms and proper nouns intact when appropriate
    - Preserve any placeholder variables like {count}, {name}, etc.
    - Return only the translations, one per line, in the same order as input
    - Do not add explanations or extra content`

    const userPrompt = texts.join('\n')

    try {
      const response = await fetch(translationConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${translationConfig.apiKey}`
        },
        body: JSON.stringify({
          model: translationConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const translatedText = data.choices[0]?.message?.content
      
      if (!translatedText) {
        throw new Error('No translation received from API')
      }

      return translatedText.split('\n').filter(line => line.trim())
    } catch (error) {
      console.error('Translation API error:', error)
      throw error
    }
  }

  async translateText(text: string, targetLanguage: Locale, context?: string): Promise<string> {
    // Return original text for English
    if (targetLanguage === 'en') {
      return text
    }

    const cacheKey = this.getCacheKey(text, targetLanguage, context)
    
    // Check cache first
    if (this.isTranslationCached(cacheKey)) {
      return this.cache[cacheKey].translation
    }

    try {
      const translations = await this.translateWithOpenAI([text], targetLanguage, context)
      const translation = translations[0] || text

      // Cache the translation
      this.cache[cacheKey] = {
        translation,
        timestamp: Date.now()
      }

      return translation
    } catch (error) {
      console.error(`Translation failed for "${text}" to ${targetLanguage}:`, error)
      return text // Fallback to original text
    }
  }

  async translateBatch(texts: string[], targetLanguage: Locale, context?: string): Promise<Record<string, string>> {
    if (targetLanguage === 'en') {
      return texts.reduce((acc, text) => ({ ...acc, [text]: text }), {})
    }

    const result: Record<string, string> = {}
    const textsToTranslate: string[] = []
    const indices: number[] = []

    // Check cache and prepare texts for translation
    texts.forEach((text, index) => {
      const cacheKey = this.getCacheKey(text, targetLanguage, context)
      if (this.isTranslationCached(cacheKey)) {
        result[text] = this.cache[cacheKey].translation
      } else {
        textsToTranslate.push(text)
        indices.push(index)
      }
    })

    // Translate uncached texts in batches
    if (textsToTranslate.length > 0) {
      try {
        for (let i = 0; i < textsToTranslate.length; i += translationConfig.batchSize) {
          const batch = textsToTranslate.slice(i, i + translationConfig.batchSize)
          const translations = await this.translateWithOpenAI(batch, targetLanguage, context)
          
          batch.forEach((text, batchIndex) => {
            const translation = translations[batchIndex] || text
            const cacheKey = this.getCacheKey(text, targetLanguage, context)
            
            // Cache the translation
            this.cache[cacheKey] = {
              translation,
              timestamp: Date.now()
            }
            
            result[text] = translation
          })

          // Small delay between batches to respect rate limits
          if (i + translationConfig.batchSize < textsToTranslate.length) {
            await new Promise(resolve => setTimeout(resolve, translationConfig.retryDelay))
          }
        }
      } catch (error) {
        console.error('Batch translation failed:', error)
        // Add untranslated texts as fallbacks
        textsToTranslate.forEach(text => {
          if (!result[text]) {
            result[text] = text
          }
        })
      }
    }

    return result
  }

  async translateDictionary(dictionary: Record<string, any>, targetLanguage: Locale): Promise<Record<string, any>> {
    if (targetLanguage === 'en') {
      return dictionary
    }

    const flattenedTexts: string[] = []
    const paths: string[] = []

    // Flatten the dictionary to extract all text values
    const flatten = (obj: any, prefix = '') => {
      for (const key in obj) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'string') {
          flattenedTexts.push(obj[key])
          paths.push(path)
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          flatten(obj[key], path)
        }
      }
    }

    flatten(dictionary)

    // Translate all texts
    const translations = await this.translateBatch(flattenedTexts, targetLanguage, 'user interface')

    // Rebuild the dictionary with translations
    const result = JSON.parse(JSON.stringify(dictionary))
    
    paths.forEach((path, index) => {
      const originalText = flattenedTexts[index]
      const translatedText = translations[originalText] || originalText
      
      // Set the translated text at the correct path
      const pathParts = path.split('.')
      let current = result
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]]
      }
      
      current[pathParts[pathParts.length - 1]] = translatedText
    })

    return result
  }

  clearCache(): void {
    this.cache = {}
  }

  getCacheStats(): { size: number; entries: number } {
    const entries = Object.keys(this.cache).length
    const size = JSON.stringify(this.cache).length
    return { size, entries }
  }
}

export const translationService = new TranslationService()
export default translationService