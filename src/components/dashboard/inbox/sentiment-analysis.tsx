'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { 
  Smile, 
  Frown, 
  Meh, 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InboxMessage {
  id: string
  workspaceId: string
  socialAccountId: string
  type: 'COMMENT' | 'MENTION' | 'DIRECT_MESSAGE' | 'REVIEW' | 'REPLY'
  providerThreadId?: string
  providerItemId: string
  content: string
  authorName?: string
  authorHandle?: string
  authorAvatar?: string
  sentiment?: string
  status: 'OPEN' | 'ASSIGNED' | 'SNOOZED' | 'CLOSED'
  assigneeId?: string
  tags: string[]
  internalNotes?: string
  slaBreachedAt?: string
  createdAt: string
  updatedAt: string
  socialAccount: {
    id: string
    provider: string
    handle: string
    displayName: string
  }
  assignee?: {
    id: string
    name: string
    image?: string
  }
  conversation?: {
    threadData: any
  }
}

interface SentimentAnalysisProps {
  message: InboxMessage
}

interface SentimentResult {
  sentiment: string
  confidence: number
  text: string
}

interface SentimentInsights {
  keywords: {
    positive: string[]
    negative: string[]
    neutral: string[]
  }
  emotions: {
    joy: number
    anger: number
    fear: number
    surprise: number
    sadness: number
  }
  urgency: 'low' | 'medium' | 'high'
  recommendedAction: string
}

export function SentimentAnalysis({ message }: SentimentAnalysisProps) {
  const [analysis, setAnalysis] = useState<SentimentResult | null>(null)
  const [insights, setInsights] = useState<SentimentInsights | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [customText, setCustomText] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (message.content && !analysis) {
      analyzeMessage(message.content)
    }
  }, [message.content])

  const analyzeMessage = async (text: string = message.content) => {
    try {
      setIsAnalyzing(true)
      
      const response = await fetch('/api/inbox/sentiment/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      })

      if (response.ok) {
        const result = await response.json()
        setAnalysis(result)
        generateInsights(text, result)
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateInsights = (text: string, sentimentResult: SentimentResult) => {
    // Generate enhanced insights based on text analysis
    const words = text.toLowerCase().split(/\s+/)
    
    const positiveKeywords = ['love', 'great', 'amazing', 'excellent', 'perfect', 'happy', 'thank', 'awesome']
    const negativeKeywords = ['hate', 'terrible', 'awful', 'bad', 'worst', 'angry', 'frustrated', 'disappointed']
    const urgentKeywords = ['urgent', 'emergency', 'immediately', 'asap', 'critical', 'important']
    
    const foundPositive = words.filter(word => positiveKeywords.includes(word))
    const foundNegative = words.filter(word => negativeKeywords.includes(word))
    const foundUrgent = words.filter(word => urgentKeywords.includes(word))
    
    // Simple emotion scoring
    const emotions = {
      joy: foundPositive.length * 0.3,
      anger: foundNegative.includes('angry') || foundNegative.includes('hate') ? 0.8 : 0.1,
      fear: words.includes('worried') || words.includes('scared') ? 0.6 : 0.1,
      surprise: words.includes('surprised') || words.includes('unexpected') ? 0.7 : 0.1,
      sadness: foundNegative.includes('sad') || foundNegative.includes('disappointed') ? 0.7 : 0.1
    }
    
    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'low'
    if (foundUrgent.length > 0 || sentimentResult.sentiment === 'negative') {
      urgency = sentimentResult.sentiment === 'negative' ? 'high' : 'medium'
    }
    
    // Recommend action based on sentiment and urgency
    let recommendedAction = 'Monitor and respond within normal timeframe'
    if (sentimentResult.sentiment === 'negative' && urgency === 'high') {
      recommendedAction = 'Immediate response required - escalate to management if needed'
    } else if (sentimentResult.sentiment === 'negative') {
      recommendedAction = 'Respond within 2 hours with empathy and solution'
    } else if (sentimentResult.sentiment === 'positive') {
      recommendedAction = 'Thank the customer and consider for testimonial'
    }
    
    setInsights({
      keywords: {
        positive: foundPositive,
        negative: foundNegative,
        neutral: words.filter(word => 
          !positiveKeywords.includes(word) && 
          !negativeKeywords.includes(word) &&
          word.length > 3
        ).slice(0, 5)
      },
      emotions,
      urgency,
      recommendedAction
    })
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return Smile
      case 'negative': return Frown
      case 'neutral': return Meh
      default: return Meh
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100 border-green-200'
      case 'negative': return 'text-red-600 bg-red-100 border-red-200'
      case 'neutral': return 'text-gray-600 bg-gray-100 border-gray-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.6) return 'Medium'
    return 'Low'
  }

  const SentimentIcon = analysis ? getSentimentIcon(analysis.sentiment) : Brain

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Sentiment Analysis
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeMessage()}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis ? (
          <>
            {/* Main Sentiment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SentimentIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Overall Sentiment</span>
                </div>
                <Badge className={cn("text-xs", getSentimentColor(analysis.sentiment))}>
                  {analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Confidence</span>
                  <span className="font-medium">
                    {Math.round(analysis.confidence * 100)}% ({getConfidenceLevel(analysis.confidence)})
                  </span>
                </div>
                <Progress value={analysis.confidence * 100} className="h-2" />
              </div>
            </div>

            {/* Urgency & Action */}
            {insights && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Urgency Level
                  </span>
                  <Badge className={cn("text-xs", getUrgencyColor(insights.urgency))}>
                    {insights.urgency.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs font-medium text-blue-800 mb-1">
                    Recommended Action
                  </div>
                  <div className="text-xs text-blue-700">
                    {insights.recommendedAction}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Analysis Toggle */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Analysis
                <Eye className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {/* Advanced Analysis */}
            {showAdvanced && insights && (
              <div className="space-y-4 pt-2 border-t">
                {/* Emotions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Emotional Breakdown
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(insights.emotions).map(([emotion, score]) => (
                      <div key={emotion} className="flex items-center justify-between">
                        <span className="text-xs capitalize">{emotion}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={score * 100} className="w-12 h-1" />
                          <span className="text-xs text-muted-foreground w-8">
                            {Math.round(score * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keywords */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Phrases</h4>
                  <div className="space-y-2">
                    {insights.keywords.positive.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-green-600 font-medium">Positive:</div>
                        <div className="flex flex-wrap gap-1">
                          {insights.keywords.positive.map((word, index) => (
                            <Badge key={index} variant="outline" className="text-xs text-green-700 border-green-200">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {insights.keywords.negative.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-red-600 font-medium">Negative:</div>
                        <div className="flex flex-wrap gap-1">
                          {insights.keywords.negative.map((word, index) => (
                            <Badge key={index} variant="outline" className="text-xs text-red-700 border-red-200">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {insights.keywords.neutral.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600 font-medium">Key Terms:</div>
                        <div className="flex flex-wrap gap-1">
                          {insights.keywords.neutral.map((word, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-4">
              {isAnalyzing ? 'Analyzing sentiment...' : 'Click to analyze sentiment'}
            </div>
            {!isAnalyzing && (
              <Button onClick={() => analyzeMessage()}>
                <Zap className="h-4 w-4 mr-2" />
                Analyze Message
              </Button>
            )}
          </div>
        )}

        {/* Custom Text Analysis */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-medium">Analyze Custom Text</h4>
          <Textarea
            placeholder="Enter text to analyze..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="min-h-[60px] text-xs"
          />
          <Button
            onClick={() => customText.trim() && analyzeMessage(customText.trim())}
            disabled={!customText.trim() || isAnalyzing}
            size="sm"
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-3 w-3 mr-2" />
                Analyze Text
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}