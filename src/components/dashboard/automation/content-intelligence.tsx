'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  TrendingUp, 
  Target, 
  Lightbulb,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Sparkles,
  RefreshCw
} from 'lucide-react'

interface ContentIntelligenceProps {
  workspaceId: string
}

interface ContentSuggestion {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'engagement' | 'content' | 'timing' | 'hashtags'
}

interface Trend {
  topic: string
  relevance: string
  actionable: string
}

interface ContentGap {
  area: string
  opportunity: string
  recommendation: string
}

interface ContentIntelligenceData {
  enabled: boolean
  suggestions: ContentSuggestion[]
  trends: Trend[]
  gaps: ContentGap[]
  lastAnalyzed?: string
  message?: string
}

export function ContentIntelligence({ workspaceId }: ContentIntelligenceProps) {
  const [data, setData] = useState<ContentIntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    fetchContentIntelligence()
  }, [workspaceId])

  const fetchContentIntelligence = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/automation/content-intelligence?workspaceId=${workspaceId}`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching content intelligence:', error)
    } finally {
      setLoading(false)
    }
  }

  const enableContentIntelligence = async () => {
    try {
      setEnabling(true)
      const response = await fetch('/api/automation/content-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action: 'enable' })
      })
      
      if (response.ok) {
        await fetchContentIntelligence()
      }
    } catch (error) {
      console.error('Error enabling content intelligence:', error)
    } finally {
      setEnabling(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'engagement': return TrendingUp
      case 'content': return Bot
      case 'timing': return Clock
      case 'hashtags': return Target
      default: return Lightbulb
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data?.enabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Content Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Bot className="w-16 h-16 mx-auto text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI-Powered Content Intelligence
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Enable AI analysis of your content performance to get personalized suggestions, 
                trend insights, and content gap recommendations powered by OpenAI.
              </p>
              {data?.message && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">{data.message}</p>
                </div>
              )}
              <Button 
                onClick={enableContentIntelligence}
                disabled={enabling}
                className="flex items-center gap-2"
              >
                {enabling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enable Content Intelligence
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-500" />
            Content Intelligence Dashboard
          </h2>
          {data.lastAnalyzed && (
            <p className="text-sm text-gray-600 mt-1">
              Last analyzed: {new Date(data.lastAnalyzed).toLocaleString()}
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={fetchContentIntelligence}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Analysis
        </Button>
      </div>

      {/* Content Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            AI Content Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.suggestions.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No suggestions available. Publish more content to get AI insights.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.suggestions.map((suggestion, index) => {
                const Icon = getCategoryIcon(suggestion.category)
                return (
                  <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <Badge className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{suggestion.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Topics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Trending Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.trends.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No trending topics identified yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {data.trends.map((trend, index) => (
                <div key={index} className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-1">{trend.topic}</h4>
                  <p className="text-sm text-green-700 mb-2">{trend.relevance}</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-800">{trend.actionable}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Content Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.gaps.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No content gaps identified.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.gaps.map((gap, index) => (
                <div key={index} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-1">{gap.area}</h4>
                  <p className="text-sm text-orange-700 mb-2">{gap.opportunity}</p>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-800">{gap.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}