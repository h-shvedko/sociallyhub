'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, defaultLocale, isValidLocale } from '@/lib/i18n'

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  isLoading: boolean
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

interface LocaleProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load locale from localStorage on client side
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('sociallyhub-locale')
      if (savedLocale && isValidLocale(savedLocale)) {
        setLocaleState(savedLocale)
      } else {
        // Try to detect browser language
        const browserLocale = navigator.language.split('-')[0]
        if (isValidLocale(browserLocale)) {
          setLocaleState(browserLocale)
        }
      }
    }
    setIsLoading(false)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sociallyhub-locale', newLocale)
      
      // Update document attributes for proper styling
      document.documentElement.setAttribute('lang', newLocale)
      document.documentElement.setAttribute('dir', newLocale === 'ar' ? 'rtl' : 'ltr')
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isLoading }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext)
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}

export default LocaleContext