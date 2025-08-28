'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Settings, Zap, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react'

interface OptimizationResult {
  platform: string
  success: boolean
  optimizedImageUrl?: string
  originalSize?: number
  optimizedSize?: number
  compressionRatio?: number
  qualityScore?: number
  performanceImpact?: {
    loadTimeImprovement: number
    sizeReduction: number
    qualityRetention: number
  }
  error?: string
}

interface ImageOptimizerProps {
  imageUrl?: string
  selectedPlatforms: string[]
  onOptimizationComplete?: (results: OptimizationResult[]) => void
}

const OPTIMIZATION_OPTIONS = [
  { id: 'resize', label: 'Smart Resize', description: 'Resize for optimal platform dimensions' },
  { id: 'crop', label: 'Smart Crop', description: 'Crop to highlight key content areas' },
  { id: 'filter', label: 'Enhancement Filters', description: 'Apply color and contrast optimization' },
  { id: 'watermark', label: 'Brand Watermark', description: 'Add subtle brand watermark' },
  { id: 'quality', label: 'Quality Optimization', description: 'Balance quality and file size' }
]

const PLATFORM_INFO = {
  TWITTER: { name: 'Twitter/X', color: 'bg-black' },
  FACEBOOK: { name: 'Facebook', color: 'bg-blue-600' },
  INSTAGRAM: { name: 'Instagram', color: 'bg-gradient-to-br from-purple-600 to-pink-500' },
  LINKEDIN: { name: 'LinkedIn', color: 'bg-blue-700' },
  YOUTUBE: { name: 'YouTube', color: 'bg-red-600' },
  TIKTOK: { name: 'TikTok', color: 'bg-black' }
}

export function ImageOptimizer({ imageUrl, selectedPlatforms, onOptimizationComplete }: ImageOptimizerProps) {
  const [results, setResults] = useState<OptimizationResult[]>([])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOptimizations, setSelectedOptimizations] = useState<string[]>(['resize', 'quality'])

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
      formData.append('files', blob, 'image.jpg')

      // Upload to our media API
      const uploadResponse = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const uploadResult = await uploadResponse.json()
      if (uploadResult.assets && uploadResult.assets[0]) {
        return uploadResult.assets[0].url // Return the uploaded image URL
      }
      
      throw new Error('No uploaded asset returned')
    } catch (error) {
      console.error('Error uploading blob:', error)
      throw new Error('Failed to process image for optimization')
    }
  }

  const handleOptimize = async () => {
    if (!imageUrl) {
      setError('Please upload an image first')
      return
    }

    if (selectedPlatforms.length === 0) {
      setError('Please select at least one platform')
      return
    }

    setIsOptimizing(true)
    setError(null)
    setResults([])

    try {
      // Convert blob URL to real URL if needed
      const processedImageUrl = await uploadBlobIfNeeded(imageUrl)

      const response = await fetch('/api/ai/images/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: processedImageUrl,
          platforms: selectedPlatforms,
          optimizations: selectedOptimizations
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to optimize image')
      }

      const data = await response.json()
      
      if (data.success && data.results) {
        setResults(data.results)
        onOptimizationComplete?.(data.results)
      } else {
        throw new Error(data.error || 'Optimization failed')
      }
    } catch (err) {
      console.error('Image optimization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to optimize image')
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleOptimizationToggle = (optimizationId: string) => {
    setSelectedOptimizations(prev => 
      prev.includes(optimizationId) 
        ? prev.filter(id => id !== optimizationId)
        : [...prev, optimizationId]
    )
  }

  const handleDownload = async (result: OptimizationResult) => {
    if (!result.optimizedImageUrl) return

    try {
      const response = await fetch(result.optimizedImageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `optimized-${result.platform.toLowerCase()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Image Optimization
        </CardTitle>
        <CardDescription>
          Optimize your image for different social media platforms with AI-powered enhancements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Optimization Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <Label className="text-sm font-medium">Optimization Options</Label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {OPTIMIZATION_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={option.id}
                  checked={selectedOptimizations.includes(option.id)}
                  onCheckedChange={() => handleOptimizationToggle(option.id)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor={option.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleOptimize} 
          disabled={!imageUrl || selectedPlatforms.length === 0 || isOptimizing || selectedOptimizations.length === 0}
          className="w-full"
          size="lg"
        >
          {isOptimizing ? (
            <>
              <Zap className="h-4 w-4 mr-2 animate-spin" />
              Optimizing for {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Optimize for {selectedPlatforms.length} Platform{selectedPlatforms.length > 1 ? 's' : ''}
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Optimization Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Optimization Results</h3>
            
            <Tabs defaultValue={results[0]?.platform} className="w-full">
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {results.map((result) => (
                  <TabsTrigger key={result.platform} value={result.platform}>
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-3 h-3 rounded-full ${
                          PLATFORM_INFO[result.platform as keyof typeof PLATFORM_INFO]?.color || 'bg-gray-500'
                        }`}
                      />
                      {PLATFORM_INFO[result.platform as keyof typeof PLATFORM_INFO]?.name || result.platform}
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {results.map((result) => (
                <TabsContent key={result.platform} value={result.platform} className="space-y-4">
                  {result.success ? (
                    <div className="space-y-4">
                      {/* Performance Metrics */}
                      {result.performanceImpact && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className={`text-2xl font-bold ${getPerformanceColor(result.performanceImpact.loadTimeImprovement)}`}>
                                {Math.round(result.performanceImpact.loadTimeImprovement)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Load Time Improvement</div>
                              <Progress value={result.performanceImpact.loadTimeImprovement} className="mt-2" />
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className={`text-2xl font-bold ${getPerformanceColor(result.performanceImpact.sizeReduction)}`}>
                                {Math.round(result.performanceImpact.sizeReduction)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Size Reduction</div>
                              <Progress value={result.performanceImpact.sizeReduction} className="mt-2" />
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardContent className="p-4 text-center">
                              <div className={`text-2xl font-bold ${getPerformanceColor(result.performanceImpact.qualityRetention)}`}>
                                {Math.round(result.performanceImpact.qualityRetention)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Quality Retention</div>
                              <Progress value={result.performanceImpact.qualityRetention} className="mt-2" />
                            </CardContent>
                          </Card>
                        </div>
                      )}
                      
                      {/* File Size Comparison */}
                      {result.originalSize && result.optimizedSize && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-muted-foreground">Original Size</div>
                                <div className="font-medium">{formatFileSize(result.originalSize)}</div>
                              </div>
                              <div className="text-2xl">→</div>
                              <div>
                                <div className="text-sm text-muted-foreground">Optimized Size</div>
                                <div className="font-medium text-green-600">{formatFileSize(result.optimizedSize)}</div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground">Compression</div>
                                <div className="font-medium">
                                  {Math.round(((result.originalSize - result.optimizedSize) / result.originalSize) * 100)}%
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Quality Score */}
                      {result.qualityScore && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-muted-foreground">Quality Score</div>
                                <div className={`text-xl font-bold ${getPerformanceColor(result.qualityScore)}`}>
                                  {Math.round(result.qualityScore)}/100
                                </div>
                              </div>
                              <Progress value={result.qualityScore} className="w-1/2" />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Download Button */}
                      {result.optimizedImageUrl && (
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleDownload(result)}
                            variant="outline"
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Optimized Image
                          </Button>
                          <Button
                            onClick={() => window.open(result.optimizedImageUrl, '_blank')}
                            variant="outline"
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Optimization failed for {result.platform}: {result.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* No Image Uploaded */}
        {!imageUrl && (
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>Upload an image to start optimization</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}