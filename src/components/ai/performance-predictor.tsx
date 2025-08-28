"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share,
  AlertCircle,
  Target,
  Award,
  RefreshCw,
  Lightbulb
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PerformancePredictorProps {
  content: string
  selectedPlatforms: string[]
  postId?: string
  className?: string
}

interface PerformancePrediction {
  engagementRate: number
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  confidence: number
}

interface PredictionResult {
  prediction: PerformancePrediction
  comparison?: {
    engagementRateChange: number
    reachChange?: number
    likesChange?: number
  }
  recommendations: string[]
}

export function PerformancePredictor({ 
  content, 
  selectedPlatforms, 
  postId, 
  className 
}: PerformancePredictorProps) {
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("")

  // Set default platform when platforms change
  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(selectedPlatform)) {
      setSelectedPlatform(selectedPlatforms[0])
    }
  }, [selectedPlatforms, selectedPlatform])

  // Auto-predict when content changes (debounced)
  useEffect(() => {
    if (!content.trim() || selectedPlatforms.length === 0) {
      setPredictions({})
      return
    }

    const timeoutId = setTimeout(() => {
      predictPerformance()
    }, 2000) // Debounce by 2 seconds

    return () => clearTimeout(timeoutId)
  }, [content, selectedPlatforms])

  const predictPerformance = async () => {
    if (!content.trim() || selectedPlatforms.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      // Predict for all selected platforms
      const predictionPromises = selectedPlatforms.map(async (platform) => {
        const response = await fetch('/api/ai/performance/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            platform,
            postId
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to predict performance for ${platform}`)
        }

        const result = await response.json()
        return { platform, result: result.data }
      })

      const results = await Promise.all(predictionPromises)
      
      const newPredictions: Record<string, PredictionResult> = {}
      results.forEach(({ platform, result }) => {
        newPredictions[platform] = result
      })
      
      setPredictions(newPredictions)
      
      // Set first platform as selected if none selected
      if (!selectedPlatform && results.length > 0) {
        setSelectedPlatform(results[0].platform)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return Math.round(num).toString()
  }

  const getChangeColor = (change: number) => {
    if (change > 10) return "text-green-600 bg-green-50"
    if (change > 0) return "text-green-600 bg-green-50"
    if (change < -10) return "text-red-600 bg-red-50"
    if (change < 0) return "text-red-600 bg-red-50"
    return "text-gray-600 bg-gray-50"
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600"
    if (confidence >= 0.6) return "text-blue-600"
    if (confidence >= 0.4) return "text-yellow-600"
    return "text-orange-600"
  }

  if (!content.trim() || selectedPlatforms.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-500" />
            Performance Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Add content and select platforms to predict post performance
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentPrediction = selectedPlatform ? predictions[selectedPlatform] : null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-500" />
            Performance Prediction
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={predictPerformance}
            disabled={isLoading || !content.trim()}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Predict
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Platform Selector */}
        {selectedPlatforms.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map((platform) => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPlatform(platform)}
                className="text-xs"
              >
                {platform}
                {predictions[platform] && (
                  <Badge 
                    variant="secondary" 
                    className={cn("ml-2 text-xs", getConfidenceColor(predictions[platform].prediction.confidence))}
                  >
                    {Math.round(predictions[platform].prediction.confidence * 100)}%
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="mr-2 h-4 w-4" />
            <span className="text-sm text-muted-foreground">Analyzing performance...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Prediction Results */}
        {currentPrediction && !isLoading && (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Eye className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-blue-900">
                  {formatNumber(currentPrediction.prediction.reach)}
                </div>
                <div className="text-xs text-blue-600">Estimated Reach</div>
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Heart className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-green-900">
                  {formatNumber(currentPrediction.prediction.likes)}
                </div>
                <div className="text-xs text-green-600">Likes</div>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <MessageCircle className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-purple-900">
                  {formatNumber(currentPrediction.prediction.comments)}
                </div>
                <div className="text-xs text-purple-600">Comments</div>
              </div>

              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <Share className="h-5 w-5 text-orange-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-orange-900">
                  {formatNumber(currentPrediction.prediction.shares)}
                </div>
                <div className="text-xs text-orange-600">Shares</div>
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">Predicted Engagement Rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-indigo-900">
                    {currentPrediction.prediction.engagementRate.toFixed(1)}%
                  </span>
                  {currentPrediction.comparison?.engagementRateChange !== undefined && (
                    <Badge className={cn("text-xs", getChangeColor(currentPrediction.comparison.engagementRateChange))}>
                      {currentPrediction.comparison.engagementRateChange > 0 ? '+' : ''}
                      {currentPrediction.comparison.engagementRateChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>
              <Progress 
                value={Math.min(currentPrediction.prediction.engagementRate * 10, 100)} 
                className="h-3" 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>5%</span>
                <span>10%+</span>
              </div>
            </div>

            {/* Confidence Score */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Prediction Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", getConfidenceColor(currentPrediction.prediction.confidence))}>
                  {Math.round(currentPrediction.prediction.confidence * 100)}%
                </span>
                <Badge variant="outline" className="text-xs">
                  {currentPrediction.prediction.confidence >= 0.8 ? 'High' :
                   currentPrediction.prediction.confidence >= 0.6 ? 'Good' :
                   currentPrediction.prediction.confidence >= 0.4 ? 'Fair' : 'Low'}
                </Badge>
              </div>
            </div>

            {/* Historical Comparison */}
            {currentPrediction.comparison && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Compared to Your Average
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-2 bg-white border rounded">
                    <span className="text-xs text-muted-foreground">Engagement</span>
                    <Badge className={cn("text-xs", getChangeColor(currentPrediction.comparison.engagementRateChange))}>
                      {currentPrediction.comparison.engagementRateChange > 0 ? '+' : ''}
                      {currentPrediction.comparison.engagementRateChange.toFixed(1)}%
                    </Badge>
                  </div>
                  {currentPrediction.comparison.reachChange !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-white border rounded">
                      <span className="text-xs text-muted-foreground">Reach</span>
                      <Badge className={cn("text-xs", getChangeColor(currentPrediction.comparison.reachChange))}>
                        {currentPrediction.comparison.reachChange > 0 ? '+' : ''}
                        {currentPrediction.comparison.reachChange.toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                  {currentPrediction.comparison.likesChange !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-white border rounded">
                      <span className="text-xs text-muted-foreground">Likes</span>
                      <Badge className={cn("text-xs", getChangeColor(currentPrediction.comparison.likesChange))}>
                        {currentPrediction.comparison.likesChange > 0 ? '+' : ''}
                        {currentPrediction.comparison.likesChange.toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {currentPrediction.recommendations && currentPrediction.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h4 className="text-sm font-medium">Optimization Tips</h4>
                </div>
                
                <div className="space-y-2">
                  {currentPrediction.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State with Action */}
        {Object.keys(predictions).length === 0 && !isLoading && content.trim() && (
          <div className="text-center py-6">
            <Button
              variant="outline"
              size="sm"
              onClick={predictPerformance}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Predict Performance
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}