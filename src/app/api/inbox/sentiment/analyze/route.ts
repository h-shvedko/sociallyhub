import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { withLogging } from '@/lib/middleware/logging'

// Simple sentiment analysis using keyword matching
// In production, you might want to use a service like AWS Comprehend or Google Cloud Natural Language
function analyzeSentiment(text: string): { sentiment: string; confidence: number } {
  const positiveKeywords = [
    'love', 'great', 'awesome', 'amazing', 'excellent', 'fantastic', 'wonderful',
    'perfect', 'good', 'nice', 'happy', 'pleased', 'satisfied', 'thank', 'thanks',
    'helpful', 'best', 'brilliant', 'outstanding', 'superb', 'magnificent'
  ]

  const negativeKeywords = [
    'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disappointing',
    'frustrated', 'angry', 'upset', 'annoying', 'useless', 'broken', 'failed',
    'problem', 'issue', 'bug', 'error', 'complaint', 'disappointed', 'sucks'
  ]

  const neutralKeywords = [
    'okay', 'ok', 'fine', 'maybe', 'perhaps', 'question', 'ask', 'help',
    'how', 'what', 'when', 'where', 'why', 'info', 'information'
  ]

  const lowerText = text.toLowerCase()
  let positiveScore = 0
  let negativeScore = 0
  let neutralScore = 0

  // Count keyword occurrences
  positiveKeywords.forEach(keyword => {
    const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length
    positiveScore += matches
  })

  negativeKeywords.forEach(keyword => {
    const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length
    negativeScore += matches
  })

  neutralKeywords.forEach(keyword => {
    const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length
    neutralScore += matches
  })

  // Determine sentiment based on scores
  const totalScore = positiveScore + negativeScore + neutralScore
  
  if (totalScore === 0) {
    return { sentiment: 'neutral', confidence: 0.5 }
  }

  const positiveRatio = positiveScore / totalScore
  const negativeRatio = negativeScore / totalScore
  const neutralRatio = neutralScore / totalScore

  let sentiment = 'neutral'
  let confidence = 0.5

  if (positiveRatio > negativeRatio && positiveRatio > neutralRatio) {
    sentiment = 'positive'
    confidence = Math.min(0.9, 0.5 + (positiveRatio * 0.4))
  } else if (negativeRatio > positiveRatio && negativeRatio > neutralRatio) {
    sentiment = 'negative'
    confidence = Math.min(0.9, 0.5 + (negativeRatio * 0.4))
  } else {
    sentiment = 'neutral'
    confidence = Math.max(0.3, 0.9 - Math.max(positiveRatio, negativeRatio) * 0.6)
  }

  return { sentiment, confidence }
}

export async function POST(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { text } = body

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required for analysis' }, { status: 400 })
    }

    try {
      const analysis = analyzeSentiment(text.trim())
      
      return NextResponse.json({
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        text: text.trim()
      })

    } catch (error) {
      console.error('Sentiment analysis error:', error)
      return NextResponse.json({
        error: 'Failed to analyze sentiment',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }, 'sentiment-analyze')(request)
}