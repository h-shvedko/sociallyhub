import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import translationService from '@/lib/i18n/translation-service'
import { isValidLocale, Locale } from '@/lib/i18n'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { text, texts, targetLanguage, context } = body

    if (!targetLanguage || !isValidLocale(targetLanguage)) {
      return NextResponse.json(
        { error: 'Invalid target language' },
        { status: 400 }
      )
    }

    const locale = targetLanguage as Locale

    if (texts && Array.isArray(texts)) {
      // Batch translation
      const translations = await translationService.translateBatch(
        texts,
        locale,
        context
      )
      return NextResponse.json({ translations })
    } else if (text && typeof text === 'string') {
      // Single text translation
      const translation = await translationService.translateText(
        text,
        locale,
        context
      )
      return NextResponse.json({ translation })
    } else {
      return NextResponse.json(
        { error: 'Missing text or texts parameter' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Translation API error:', error)
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'cache-stats') {
      const stats = translationService.getCacheStats()
      return NextResponse.json({ cacheStats: stats })
    } else if (action === 'clear-cache') {
      translationService.clearCache()
      return NextResponse.json({ message: 'Cache cleared successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Translation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}