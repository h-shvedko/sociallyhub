'use client'

import { useState, useEffect } from 'react'
import { getDictionary } from '@/lib/i18n'
import { useLocale } from '@/contexts/locale-context'

interface Dictionary {
  [key: string]: any
}

export function useDictionary() {
  const { locale } = useLocale()
  const [dictionary, setDictionary] = useState<Dictionary>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDictionary = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const dict = await getDictionary(locale)
        
        if (isMounted) {
          setDictionary(dict)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load dictionary')
          console.error('Dictionary loading error:', err)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDictionary()

    return () => {
      isMounted = false
    }
  }, [locale])

  // Helper function to get nested dictionary values
  const t = (key: string, fallback?: string): string => {
    try {
      const keys = key.split('.')
      let current = dictionary
      
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k]
        } else {
          return fallback || key
        }
      }
      
      return typeof current === 'string' ? current : fallback || key
    } catch (err) {
      return fallback || key
    }
  }

  // Helper function for interpolation
  const tc = (key: string, values: Record<string, string | number>, fallback?: string): string => {
    const template = t(key, fallback)
    return template.replace(/{(\w+)}/g, (match, variable) => {
      return values[variable]?.toString() || match
    })
  }

  return {
    dictionary,
    isLoading,
    error,
    t,
    tc,
    locale
  }
}