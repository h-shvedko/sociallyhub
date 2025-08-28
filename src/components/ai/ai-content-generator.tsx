"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { 
  Wand2, 
  Copy, 
  Check, 
  RefreshCw, 
  Sparkles,
  AlertCircle 
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AIContentGeneratorProps {
  onContentGenerated: (content: string) => void
  selectedPlatforms: string[]
  initialPrompt?: string
  className?: string
}

interface GeneratedSuggestion {
  id: string
  content: string
  platform?: string
  confidence?: number
  used: boolean
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
  { value: "promotional", label: "Promotional" },
  { value: "conversational", label: "Conversational" },
  { value: "formal", label: "Formal" }
]

export function AIContentGenerator({ 
  onContentGenerated, 
  selectedPlatforms,
  initialPrompt = "",
  className 
}: AIContentGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [selectedTone, setSelectedTone] = useState<string>("")
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<GeneratedSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const generateContent = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      // Generate content for primary platform if multiple selected
      const primaryPlatform = selectedPlatforms[0]
      
      const response = await fetch('/api/ai/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          platform: primaryPlatform,
          tone: selectedTone || undefined,
          includeHashtags,
          includeEmojis,
          maxLength: getMaxLength(primaryPlatform)
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate content')
      }

      const result = await response.json()
      
      if (result.success) {
        const newSuggestion: GeneratedSuggestion = {
          id: result.data.suggestionId,
          content: result.data.content,
          platform: primaryPlatform,
          confidence: 0.8, // Could come from API
          used: false
        }
        
        setSuggestions(prev => [newSuggestion, ...prev.slice(0, 4)]) // Keep max 5 suggestions
      } else {
        throw new Error(result.error || 'Failed to generate content')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const useContent = (suggestion: GeneratedSuggestion) => {
    onContentGenerated(suggestion.content)
    
    // Mark as used
    setSuggestions(prev => 
      prev.map(s => 
        s.id === suggestion.id ? { ...s, used: true } : s
      )
    )

    // Track usage
    fetch('/api/ai/content/generate', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        suggestionId: suggestion.id,
        used: true
      })
    }).catch(console.error)
  }

  const getMaxLength = (platform: string): number => {
    const limits: Record<string, number> = {
      TWITTER: 280,
      FACEBOOK: 500,
      INSTAGRAM: 300,
      LINKEDIN: 400,
      YOUTUBE: 500,
      TIKTOK: 150
    }
    return limits[platform] || 400
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Content Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">What would you like to post about?</label>
          <Textarea
            placeholder="Describe what you want to post about... (e.g., 'Announce our new product launch with key features and benefits')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tone</label>
            <Select value={selectedTone} onValueChange={setSelectedTone}>
              <SelectTrigger>
                <SelectValue placeholder="Select tone (optional)" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Options</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="rounded"
                />
                Hashtags
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeEmojis}
                  onChange={(e) => setIncludeEmojis(e.target.checked)}
                  className="rounded"
                />
                Emojis
              </label>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateContent}
          disabled={!prompt.trim() || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Generated Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">AI Suggestions</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateContent}
                disabled={isGenerating || !prompt.trim()}
                className="text-xs"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Regenerate
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={cn(
                    "p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors",
                    suggestion.used && "bg-green-50 border-green-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {suggestion.content}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {suggestion.platform && (
                          <Badge variant="outline" className="text-xs">
                            {suggestion.platform}
                          </Badge>
                        )}
                        {suggestion.confidence && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                        )}
                        {suggestion.used && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Used
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(suggestion.content, suggestion.id)}
                        className="h-8 w-8 p-0"
                      >
                        {copiedId === suggestion.id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => useContent(suggestion)}
                        disabled={suggestion.used}
                        className="h-8 px-3 text-xs"
                      >
                        {suggestion.used ? "Used" : "Use"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}