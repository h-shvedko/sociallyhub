'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle, Eye, Palette, Shield, Type, Upload, Zap } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ImageAnalysis {
  colorAnalysis?: {
    dominantColors: string[]
    colorHarmony: string
    vibrance: number
    contrast: number
  }
  compositionAnalysis?: {
    rule: string
    balance: number
    focusPoints: Array<{ x: number; y: number; confidence: number }>
  }
  aestheticScore: number
  brandConsistency?: {
    overallScore: number
    colorMatch: number
    styleMatch: number
  }
  safetyAnalysis?: {
    overallScore: number
    appropriateContent: boolean
    issues: string[]
  }
  textOverlayAnalysis?: {
    hasText: boolean
    readabilityScore: number
    suggestions: string[]
  }
  tags: string[]
}

interface ImageAnalyzerProps {
  imageUrl?: string
  selectedPlatforms: string[]
  workspaceId: string
  onAnalysisComplete?: (analysis: ImageAnalysis) => void
}

export function ImageAnalyzer({ imageUrl, selectedPlatforms, workspaceId, onAnalysisComplete }: ImageAnalyzerProps) {
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisType, setAnalysisType] = useState<'basic' | 'detailed' | 'brand'>('basic')

  // Helper function to upload blob URLs to get a real URL
  const uploadBlobIfNeeded = async (url: string): Promise<string> => {
    if (!url.startsWith('blob:')) {
      return url // Not a blob URL, return as-is
    }

    try {
      // Fetch the blob data
      const response = await fetch(url)
      const blob = await response.blob()
      
      // Create FormData for upload
      const formData = new FormData()
      formData.append('file', blob, 'image.jpg')
      formData.append('workspaceId', workspaceId)

      // Upload to our media API
      const uploadResponse = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const uploadResult = await uploadResponse.json()
      if (uploadResult.url) {
        return uploadResult.url // Return the uploaded image URL
      }

      throw new Error('No uploaded asset returned')
    } catch (error) {
      console.error('Error uploading blob:', error)
      throw new Error('Failed to process image for analysis')
    }
  }

  const handleAnalyze = async () => {
    if (!imageUrl) {
      setError('Please upload an image first')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      // Convert blob URL to real URL if needed
      const processedImageUrl = await uploadBlobIfNeeded(imageUrl)

      const response = await fetch('/api/ai/images/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: processedImageUrl,
          platform: selectedPlatforms[0], // Use first selected platform
          analysisType
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze image')
      }

      const data = await response.json()
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis)
        onAnalysisComplete?.(data.analysis)
      } else {
        throw new Error(data.error || 'Analysis failed')
      }
    } catch (err) {
      console.error('Image analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze image')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default'
    if (score >= 60) return 'secondary'
    return 'destructive'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Image Analysis
        </CardTitle>
        <CardDescription>
          AI-powered analysis of your image for visual optimization and brand consistency
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="analysis-type">Analysis Type</Label>
            <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic Analysis</SelectItem>
                <SelectItem value="detailed">Detailed Analysis</SelectItem>
                <SelectItem value="brand">Brand Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleAnalyze} 
            disabled={!imageUrl || isAnalyzing}
            className="mt-6"
          >
            {isAnalyzing ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Analyze Image
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!imageUrl && (
          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>Upload an image to start analysis</AlertDescription>
          </Alert>
        )}

        {analysis && (
          <div className="space-y-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="composition">Composition</TabsTrigger>
                <TabsTrigger value="brand">Brand</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(analysis.aestheticScore)}`}>
                        {Math.round(analysis.aestheticScore)}
                      </div>
                      <div className="text-sm text-muted-foreground">Aesthetic Score</div>
                      <Progress value={analysis.aestheticScore} className="mt-2" />
                    </CardContent>
                  </Card>
                  
                  {analysis.brandConsistency && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(analysis.brandConsistency.overallScore)}`}>
                          {Math.round(analysis.brandConsistency.overallScore)}
                        </div>
                        <div className="text-sm text-muted-foreground">Brand Consistency</div>
                        <Progress value={analysis.brandConsistency.overallScore} className="mt-2" />
                      </CardContent>
                    </Card>
                  )}
                  
                  {analysis.safetyAnalysis && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(analysis.safetyAnalysis.overallScore)}`}>
                          {Math.round(analysis.safetyAnalysis.overallScore)}
                        </div>
                        <div className="text-sm text-muted-foreground">Safety Score</div>
                        <Progress value={analysis.safetyAnalysis.overallScore} className="mt-2" />
                      </CardContent>
                    </Card>
                  )}
                  
                  {analysis.textOverlayAnalysis && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(analysis.textOverlayAnalysis.readabilityScore)}`}>
                          {Math.round(analysis.textOverlayAnalysis.readabilityScore)}
                        </div>
                        <div className="text-sm text-muted-foreground">Text Readability</div>
                        <Progress value={analysis.textOverlayAnalysis.readabilityScore} className="mt-2" />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {analysis.tags && analysis.tags.length > 0 && (
                  <div className="space-y-2">
                    <Label>Content Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {analysis.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="colors" className="space-y-4">
                {analysis.colorAnalysis && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Dominant Colors</Label>
                      <div className="flex flex-wrap gap-2">
                        {analysis.colorAnalysis.dominantColors.map((color, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded border"
                              style={{ backgroundColor: color }}
                            />
                            <code className="text-sm">{color}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Color Harmony</Label>
                        <Badge variant="outline" className="ml-2">
                          {analysis.colorAnalysis.colorHarmony}
                        </Badge>
                      </div>
                      <div>
                        <Label>Vibrance</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={analysis.colorAnalysis.vibrance} className="flex-1" />
                          <span className="text-sm font-medium">
                            {Math.round(analysis.colorAnalysis.vibrance)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="composition" className="space-y-4">
                {analysis.compositionAnalysis && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Composition Rule</Label>
                        <Badge variant="outline" className="ml-2">
                          {analysis.compositionAnalysis.rule}
                        </Badge>
                      </div>
                      <div>
                        <Label>Balance Score</Label>
                        <div className="flex items-center gap-2">
                          <Progress value={analysis.compositionAnalysis.balance} className="flex-1" />
                          <span className="text-sm font-medium">
                            {Math.round(analysis.compositionAnalysis.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {analysis.compositionAnalysis.focusPoints && (
                      <div>
                        <Label>Focus Points</Label>
                        <div className="text-sm text-muted-foreground">
                          {analysis.compositionAnalysis.focusPoints.length} key areas of interest detected
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="brand" className="space-y-4">
                {analysis.brandConsistency && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <Label>Color Match</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={analysis.brandConsistency.colorMatch} className="flex-1" />
                            <Badge variant={getScoreBadgeVariant(analysis.brandConsistency.colorMatch)}>
                              {Math.round(analysis.brandConsistency.colorMatch)}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <Label>Style Match</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={analysis.brandConsistency.styleMatch} className="flex-1" />
                            <Badge variant={getScoreBadgeVariant(analysis.brandConsistency.styleMatch)}>
                              {Math.round(analysis.brandConsistency.styleMatch)}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
                
                {analysis.safetyAnalysis && analysis.safetyAnalysis.issues.length > 0 && (
                  <Alert variant="destructive">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Safety concerns detected: {analysis.safetyAnalysis.issues.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
                
                {analysis.textOverlayAnalysis?.suggestions && analysis.textOverlayAnalysis.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        Text Optimization Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1">
                        {analysis.textOverlayAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  )
}