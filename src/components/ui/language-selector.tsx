'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe, Check, Loader2 } from 'lucide-react'
import { useLocale } from '@/contexts/locale-context'
import { useDictionary } from '@/hooks/use-dictionary'
import { enabledLocales, isEnabledLocale, localeNames, defaultLocale, Locale } from '@/lib/i18n'

interface LanguageSelectorProps {
  variant?: 'button' | 'compact'
  showFlag?: boolean
  className?: string
}

const getFlag = (locale: Locale): string => {
  const flags: Record<Locale, string> = {
    en: '🇺🇸',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹',
    pt: '🇵🇹',
    ru: '🇷🇺',
    zh: '🇨🇳',
    ja: '🇯🇵',
    ko: '🇰🇷',
    ar: '🇸🇦'
  }
  return flags[locale] || '🌐'
}

export function LanguageSelector({ 
  variant = 'button', 
  showFlag = true, 
  className = '' 
}: LanguageSelectorProps) {
  const { locale, setLocale, isLoading: localeLoading } = useLocale()
  const { isLoading: dictionaryLoading, t } = useDictionary()

  const isLoading = localeLoading || dictionaryLoading

  // ADR-0017 (Decision D3): only locales in `enabledLocales` ship today (just
  // 'en' — the others were served via unreviewed runtime machine-translation,
  // now cut). If a stale/persisted locale isn't enabled, treat it as English.
  const effectiveLocale: Locale = isEnabledLocale(locale) ? locale : defaultLocale

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`px-2 ${className}`} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {showFlag && <span className="mr-1">{getFlag(effectiveLocale)}</span>}
                <span className="uppercase text-xs font-medium">{effectiveLocale}</span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {enabledLocales.map((loc) => (
            <DropdownMenuItem
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center">
                {showFlag && <span className="mr-2">{getFlag(loc)}</span>}
                <span>{localeNames[loc]}</span>
              </div>
              {effectiveLocale === loc && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <>
              <Globe className="h-4 w-4 mr-2" />
              {showFlag && <span className="mr-2">{getFlag(effectiveLocale)}</span>}
              <span>{localeNames[effectiveLocale]}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1 text-sm font-medium text-muted-foreground border-b mb-1">
          {t('settings.language', 'Language')}
        </div>
        {enabledLocales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className="flex items-center justify-between cursor-pointer py-2"
          >
            <div className="flex items-center">
              {showFlag && <span className="mr-3">{getFlag(loc)}</span>}
              <div className="flex flex-col">
                <span className="font-medium">{localeNames[loc]}</span>
                <span className="text-xs text-muted-foreground uppercase">{loc}</span>
              </div>
            </div>
            <div className="flex items-center">
              {effectiveLocale === loc && <Check className="h-4 w-4" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}