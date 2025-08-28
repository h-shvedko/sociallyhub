"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  MessageSquare, 
  Smile, 
  Frown, 
  Meh, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Lightbulb
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ToneAnalyzerProps {
  content: string
  postId?: string
  className?: string
}

interface ToneAnalysis {
  tone: string
  confidence: number
  sentiment: number // -1 to 1
  formality: number // 0 to 1
  energy: number // 0 to 1
}

interface AnalysisResult {
  analysis: ToneAnalysis
  recommendations: string[]
}

const TONE_COLORS: Record<string, string> = {
  professional: "bg-blue-100 text-blue-800",
  casual: "bg-green-100 text-green-800",
  humorous: "bg-yellow-100 text-yellow-800",
  inspirational: "bg-purple-100 text-purple-800",
  educational: "bg-indigo-100 text-indigo-800",
  promotional: "bg-orange-100 text-orange-800",
  conversational: "bg-teal-100 text-teal-800",
  formal: "bg-gray-100 text-gray-800"
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "Business-focused and polished",
  casual: "Relaxed and friendly",
  humorous: "Playful and entertaining",
  inspirational: "Motivating and uplifting",
  educational: "Informative and instructive",
  promotional: "Sales-focused and persuasive",
  conversational: "Natural and engaging",
  formal: "Structured and official"
}

export function ToneAnalyzer({ content, postId, className }: ToneAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-analyze when content changes (debounced)
  useEffect(() => {
    if (!content.trim()) {
      setAnalysis(null)
      return
    }

    const timeoutId = setTimeout(() => {
      analyzeTone()
    }, 1500) // Debounce by 1.5 seconds

    return () => clearTimeout(timeoutId)
  }, [content])

  const analyzeTone = async () => {
    if (!content.trim()) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/tone/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          postId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze tone')
      }

      const result = await response.json()
      
      if (result.success) {
        setAnalysis({
          analysis: result.data.analysis,
          recommendations: result.data.recommendations || []
        })
      } else {
        throw new Error(result.error || 'Failed to analyze tone')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.3) return <Smile className="h-4 w-4 text-green-600" />
    if (sentiment < -0.3) return <Frown className="h-4 w-4 text-red-600" />
    return <Meh className="h-4 w-4 text-yellow-600" />
  }

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.5) return "Very Positive"
    if (sentiment > 0.2) return "Positive"
    if (sentiment > -0.2) return "Neutral"
    if (sentiment > -0.5) return "Negative"
    return "Very Negative"
  }

  const getScoreColor = (score: number, reverse: boolean = false) => {
    const adjustedScore = reverse ? 1 - score : score
    if (adjustedScore >= 0.8) return "text-green-600"
    if (adjustedScore >= 0.6) return "text-blue-600"
    if (adjustedScore >= 0.4) return "text-yellow-600"
    return "text-orange-600"
  }

  if (!content.trim()) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            Tone Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Add content to analyze its tone and get improvement suggestions
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-500" />
            Tone Analysis
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={analyzeTone}
            disabled={isAnalyzing || !content.trim()}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isAnalyzing && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="mr-2 h-4 w-4" />
            <span className="text-sm text-muted-foreground">Analyzing tone...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !isAnalyzing && (
          <div className="space-y-4">
            {/* Primary Tone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Detected Tone</h4>
                <Badge className={cn("text-xs", TONE_COLORS[analysis.analysis.tone.toLowerCase()] || TONE_COLORS.casual)}>
                  {analysis.analysis.confidence && `${Math.round(analysis.analysis.confidence * 100)}% confident`}
                </Badge>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold capitalize">
                    {analysis.analysis.tone.toLowerCase()}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Primary
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {TONE_DESCRIPTIONS[analysis.analysis.tone.toLowerCase()] || "Tone analysis complete"}
                </p>
              </div>
            </div>

            {/* Tone Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sentiment */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getSentimentIcon(analysis.analysis.sentiment)}
                  <span className="text-sm font-medium">Sentiment</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {getSentimentLabel(analysis.analysis.sentiment)}
                    </span>
                    <span className="text-xs font-medium">
                      {analysis.analysis.sentiment > 0 ? '+' : ''}{(analysis.analysis.sentiment * 100).toFixed(0)}
                    </span>
                  </div>
                  <Progress 
                    value={((analysis.analysis.sentiment + 1) / 2) * 100} 
                    className="h-2" 
                  />
                </div>
              </div>

              {/* Formality */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Formality</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {analysis.analysis.formality > 0.7 ? 'Very Formal' : 
                       analysis.analysis.formality > 0.4 ? 'Balanced' : 'Casual'}
                    </span>
                    <span className="text-xs font-medium">
                      {Math.round(analysis.analysis.formality * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={analysis.analysis.formality * 100} 
                    className="h-2" 
                  />
                </div>
              </div>

              {/* Energy */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Energy</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {analysis.analysis.energy > 0.7 ? 'High Energy' : 
                       analysis.analysis.energy > 0.4 ? 'Moderate' : 'Low Energy'}
                    </span>
                    <span className="text-xs font-medium">
                      {Math.round(analysis.analysis.energy * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={analysis.analysis.energy * 100} 
                    className="h-2" 
                  />
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h4 className="text-sm font-medium">Recommendations</h4>
                </div>
                
                <div className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Summary */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-800 font-medium mb-1">Tone Analysis Complete</p>
                  <p className="text-blue-700">
                    Your content has a <strong>{analysis.analysis.tone.toLowerCase()}</strong> tone with{' '}
                    <strong>{getSentimentLabel(analysis.analysis.sentiment).toLowerCase()}</strong> sentiment.{' '}
                    {analysis.analysis.formality > 0.6 ? 'The language is quite formal.' : 
                     analysis.analysis.formality < 0.3 ? 'The language is very casual.' : 
                     'The formality level is well-balanced.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}