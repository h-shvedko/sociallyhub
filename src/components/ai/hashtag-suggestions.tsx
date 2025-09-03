"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  Hash, 
  TrendingUp, 
  Plus, 
  X, 
  Sparkles,
  AlertCircle,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HashtagSuggestionsProps {
  content: string
  selectedPlatforms: string[]
  currentHashtags: string[]
  onHashtagAdd: (hashtag: string) => void
  onHashtagRemove: (hashtag: string) => void
  className?: string
}

interface HashtagSuggestion {
  hashtag: string
  trendingScore?: number
  performanceScore?: number
  category?: string
  usageCount?: number
  confidence?: number
}

export function HashtagSuggestions({
  content,
  selectedPlatforms,
  currentHashtags,
  onHashtagAdd,
  onHashtagRemove,
  className
}: HashtagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSuggestions, setExpandedSuggestions] = useState(false)

  // Auto-generate hashtags when content changes (debounced)
  useEffect(() => {
    if (!content.trim() || selectedPlatforms.length === 0) {
      setSuggestions([])
      return
    }

    const timeoutId = setTimeout(() => {
      generateHashtags()
    }, 1000) // Debounce by 1 second

    return () => clearTimeout(timeoutId)
  }, [content, selectedPlatforms])

  const generateHashtags = async () => {
    if (!content.trim() || selectedPlatforms.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const primaryPlatform = selectedPlatforms[0]
      
      const response = await fetch('/api/ai/hashtags/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          platform: primaryPlatform,
          maxHashtags: 15
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get hashtag suggestions')
      }

      const result = await response.json()
      
      if (result.success) {
        // Transform hashtags to include mock performance data
        const hashtagsWithData: HashtagSuggestion[] = result.data.hashtags.map((tag: string, index: number) => ({
          hashtag: tag,
          trendingScore: Math.random() * 100,
          performanceScore: Math.random() * 100,
          confidence: 0.8 - (index * 0.05), // Decreasing confidence
          usageCount: Math.floor(Math.random() * 1000)
        }))
        
        setSuggestions(hashtagsWithData)
      } else {
        throw new Error(result.error || 'Failed to get suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getTrendingHashtags = async () => {
    if (selectedPlatforms.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const primaryPlatform = selectedPlatforms[0]
      
      const response = await fetch(`/api/ai/hashtags/suggest?platform=${primaryPlatform}&limit=10`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error('Failed to get trending hashtags')
      }

      const result = await response.json()
      
      if (result.success) {
        setSuggestions(result.data.hashtags)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const addHashtag = (hashtag: string) => {
    const cleanTag = hashtag.replace(/^#/, '')
    if (!currentHashtags.includes(cleanTag)) {
      onHashtagAdd(cleanTag)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50"
    if (score >= 60) return "text-yellow-600 bg-yellow-50"
    if (score >= 40) return "text-orange-600 bg-orange-50"
    return "text-red-600 bg-red-50"
  }

  const visibleSuggestions = expandedSuggestions ? suggestions : suggestions.slice(0, 8)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-500" />
            Hashtag Suggestions
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={generateHashtags}
              disabled={isLoading || !content.trim()}
              className="text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={getTrendingHashtags}
              disabled={isLoading}
              className="text-xs"
            >
              <TrendingUp className="mr-1 h-3 w-3" />
              Trending
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Hashtags */}
        {currentHashtags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Current Hashtags</h4>
            <div className="flex flex-wrap gap-2">
              {currentHashtags.map((hashtag) => (
                <Badge key={hashtag} className="flex items-center gap-1 bg-blue-100 text-blue-800">
                  #{hashtag}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                    onClick={() => onHashtagRemove(hashtag)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="mr-2 h-4 w-4" />
            <span className="text-sm text-muted-foreground">Generating suggestions...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* No Content Prompt */}
        {!content.trim() && !isLoading && suggestions.length === 0 && (
          <div className="text-center py-8">
            <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Start typing your post content to get AI-powered hashtag suggestions
            </p>
          </div>
        )}

        {/* Hashtag Suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Suggested Hashtags ({suggestions.length})
              </h4>
              {suggestions.length > 8 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedSuggestions(!expandedSuggestions)}
                  className="text-xs"
                >
                  {expandedSuggestions ? 'Show Less' : 'Show All'}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
              {visibleSuggestions.map((suggestion, index) => {
                const isAdded = currentHashtags.includes(suggestion.hashtag.replace(/^#/, ''))
                const trendingScore = suggestion.trendingScore || 0
                const performanceScore = suggestion.performanceScore || 0
                
                return (
                  <div
                    key={suggestion.hashtag}
                    className={cn(
                      "flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors",
                      isAdded && "bg-blue-50 border-blue-200"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {suggestion.hashtag}
                        </span>
                        
                        {suggestion.category && (
                          <Badge variant="outline" className="text-xs">
                            {suggestion.category}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1">
                        {trendingScore > 0 && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", getScoreColor(trendingScore))}>
                              {Math.round(trendingScore)}%
                            </span>
                          </div>
                        )}
                        
                        {suggestion.usageCount && (
                          <span className="text-xs text-muted-foreground">
                            {suggestion.usageCount.toLocaleString()} uses
                          </span>
                        )}
                        
                        {suggestion.confidence && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(suggestion.confidence * 100)}% match
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant={isAdded ? "secondary" : "default"}
                      size="sm"
                      onClick={() => isAdded ? onHashtagRemove(suggestion.hashtag.replace(/^#/, '')) : addHashtag(suggestion.hashtag)}
                      className="ml-3"
                    >
                      {isAdded ? (
                        <>
                          <X className="mr-1 h-3 w-3" />
                          Remove
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Add Popular Hashtags */}
        {selectedPlatforms.length > 0 && suggestions.length === 0 && !isLoading && content.trim() && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={generateHashtags}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate Hashtag Suggestions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}