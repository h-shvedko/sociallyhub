'use client'

import React, { ReactNode } from 'react'
import { LocaleProvider } from '@/contexts/locale-context'
import { useDictionary } from '@/hooks/use-dictionary'

interface TranslationProviderProps {
  children: ReactNode
}

interface TranslatedTextProps {
  children: ReactNode
  loading?: ReactNode
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  return (
    <LocaleProvider>
      {children}
    </LocaleProvider>
  )
}

export function TranslatedText({ children, loading }: TranslatedTextProps) {
  const { isLoading } = useDictionary()

  if (isLoading && loading) {
    return <>{loading}</>
  }

  return <>{children}</>
}

export function withTranslation<P extends object>(
  Component: React.ComponentType<P>
) {
  return function TranslatedComponent(props: P) {
    const { isLoading } = useDictionary()

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

export default TranslationProvider