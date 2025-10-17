'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sparkles,
  RefreshCw,
  Settings,
  BarChart3,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  MoreHorizontal,
  Check,
  X,
  Eye,
  Edit,
  Plus,
  Brain,
  Lightbulb,
  Target,
  AlertTriangle,
  Info,
  Star,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'

interface FAQSuggestion {
  id: string
  question: string
  suggestedAnswer: string
  category: string
  frequency: number
  confidence: number
  source: 'support_tickets' | 'search_queries'
  keywords: string[]
  priority: 'high' | 'medium' | 'low'
}

interface AnalysisSummary {
  totalPatterns: number
  qualifyingPatterns: number
  newSuggestions: number
  duplicatesFiltered: number
  analysisDate: string
  dateRange: string
  minOccurrences: number
  confidence: {
    high: number
    medium: number
    low: number
  }
}

interface AnalysisResponse {
  success: boolean
  suggestions: FAQSuggestion[]
  summary: AnalysisSummary
  message: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface FAQAutoGenerationProps {
  categories: Category[]
  onCreateFAQ: (question: string, answer: string, categoryId: string) => void
}

export default function FAQAutoGeneration({ categories, onCreateFAQ }: FAQAutoGenerationProps) {
  const [suggestions, setSuggestions] = useState<FAQSuggestion[]>([])
  const [filteredSuggestions, setFilteredSuggestions] = useState<FAQSuggestion[]>([])
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [minConfidence, setMinConfidence] = useState(0)

  // Dialog states
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false)
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false)
  const [showBulkApprovalDialog, setShowBulkApprovalDialog] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<FAQSuggestion | null>(null)

  // Analysis configuration
  const [analysisConfig, setAnalysisConfig] = useState({
    analysisType: 'support_tickets' as 'support_tickets' | 'search_queries',
    dateRange: '30d',
    minOccurrences: 3,
    categories: [] as string[]
  })

  // Bulk selection
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())

  // Suggestion editing
  const [editingSuggestion, setEditingSuggestion] = useState<FAQSuggestion | null>(null)

  // Filter suggestions
  useEffect(() => {
    let filtered = [...suggestions]

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(suggestion =>
        suggestion.question.toLowerCase().includes(term) ||
        suggestion.suggestedAnswer.toLowerCase().includes(term) ||
        suggestion.keywords.some(keyword => keyword.toLowerCase().includes(term))
      )
    }

    // Filter by priority
    if (selectedPriority) {
      filtered = filtered.filter(suggestion => suggestion.priority === selectedPriority)
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(suggestion => suggestion.category === selectedCategory)
    }

    // Filter by source
    if (selectedSource) {
      filtered = filtered.filter(suggestion => suggestion.source === selectedSource)
    }

    // Filter by confidence
    if (minConfidence > 0) {
      filtered = filtered.filter(suggestion => suggestion.confidence >= minConfidence)
    }

    // Sort by priority and confidence
    filtered.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.confidence - a.confidence
    })

    setFilteredSuggestions(filtered)
  }, [suggestions, searchTerm, selectedPriority, selectedCategory, selectedSource, minConfidence])

  const runAnalysis = async () => {
    setAnalysisLoading(true)
    try {
      const response = await fetch('/api/admin/help/faqs/auto-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisConfig),
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data: AnalysisResponse = await response.json()
      setSuggestions(data.suggestions)
      setSummary(data.summary)
      setShowAnalysisDialog(false)
    } catch (error) {
      console.error('Error running analysis:', error)
      alert('Failed to run analysis. Please try again.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const approveSuggestion = async (suggestion: FAQSuggestion) => {
    setLoading(true)
    try {
      // Find category ID
      const category = categories.find(c => c.name === suggestion.category)
      const categoryId = category?.id || categories[0]?.id

      if (!categoryId) {
        throw new Error('No valid category found')
      }

      // Create FAQ using parent handler
      onCreateFAQ(suggestion.question, suggestion.suggestedAnswer, categoryId)

      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    } catch (error) {
      console.error('Error approving suggestion:', error)
      alert('Failed to create FAQ. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const rejectSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  const bulkApprove = async () => {
    if (selectedSuggestions.size === 0) return

    setLoading(true)
    try {
      const suggestionsToApprove = suggestions.filter(s => selectedSuggestions.has(s.id))

      for (const suggestion of suggestionsToApprove) {
        const category = categories.find(c => c.name === suggestion.category)
        const categoryId = category?.id || categories[0]?.id

        if (categoryId) {
          onCreateFAQ(suggestion.question, suggestion.suggestedAnswer, categoryId)
        }
      }

      // Remove approved suggestions
      setSuggestions(prev => prev.filter(s => !selectedSuggestions.has(s.id)))
      setSelectedSuggestions(new Set())
      setShowBulkApprovalDialog(false)
    } catch (error) {
      console.error('Error in bulk approval:', error)
      alert('Some suggestions failed to be approved. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateSuggestion = (updatedSuggestion: FAQSuggestion) => {
    setSuggestions(prev =>
      prev.map(s => s.id === updatedSuggestion.id ? updatedSuggestion : s)
    )
    setEditingSuggestion(null)
    setShowSuggestionDialog(false)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600'
    if (confidence >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI FAQ Generation</h2>
          <p className="text-muted-foreground">
            Automatically generate FAQ suggestions from support tickets and user patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAnalysisDialog(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Run Analysis
          </Button>
          {selectedSuggestions.size > 0 && (
            <Button onClick={() => setShowBulkApprovalDialog(true)} variant="outline" className="gap-2">
              <Check className="h-4 w-4" />
              Approve Selected ({selectedSuggestions.size})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Suggestions</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.newSuggestions}</div>
              <p className="text-xs text-muted-foreground">
                from {summary.qualifyingPatterns} patterns
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.confidence.high}</div>
              <p className="text-xs text-muted-foreground">
                90%+ confidence
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medium Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.confidence.medium}</div>
              <p className="text-xs text-muted-foreground">
                75-90% confidence
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duplicates Filtered</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.duplicatesFiltered}</div>
              <p className="text-xs text-muted-foreground">
                already exist
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {suggestions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suggestions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {[...new Set(suggestions.map(s => s.category))].map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All sources</SelectItem>
              <SelectItem value="support_tickets">Support Tickets</SelectItem>
              <SelectItem value="search_queries">Search Queries</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {suggestions.length === 0 ? 'No suggestions yet' : 'No suggestions match your filters'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {suggestions.length === 0
                ? 'Run an analysis to generate AI-powered FAQ suggestions'
                : 'Try adjusting your filters to see more suggestions'}
            </p>
            {suggestions.length === 0 && (
              <Button onClick={() => setShowAnalysisDialog(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Run Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Bulk selection header */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              checked={selectedSuggestions.size === filteredSuggestions.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedSuggestions(new Set(filteredSuggestions.map(s => s.id)))
                } else {
                  setSelectedSuggestions(new Set())
                }
              }}
            />
            <span className="text-sm font-medium">
              {selectedSuggestions.size > 0
                ? `${selectedSuggestions.size} selected`
                : 'Select all suggestions'}
            </span>
          </div>

          {filteredSuggestions.map((suggestion) => (
            <Card key={suggestion.id} className="relative">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedSuggestions.has(suggestion.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedSuggestions)
                      if (checked) {
                        newSelected.add(suggestion.id)
                      } else {
                        newSelected.delete(suggestion.id)
                      }
                      setSelectedSuggestions(newSelected)
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-2 pr-4">
                        {suggestion.question}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSuggestion(suggestion)
                              setShowSuggestionDialog(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingSuggestion(suggestion)
                              setShowSuggestionDialog(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => approveSuggestion(suggestion)}
                            className="text-green-600"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => rejectSuggestion(suggestion.id)}
                            className="text-red-600"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getPriorityColor(suggestion.priority)}>
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="secondary">{suggestion.category}</Badge>
                      <Badge variant="outline">
                        {suggestion.source.replace('_', ' ')}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className={`font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                          {suggestion.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {suggestion.frequency} occurrences
                      </div>
                    </div>

                    <CardDescription className="line-clamp-3">
                      {suggestion.suggestedAnswer}
                    </CardDescription>

                    {suggestion.keywords.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Keywords:</span>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.keywords.slice(0, 4).map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {suggestion.keywords.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{suggestion.keywords.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectSuggestion(suggestion.id)}
                    className="gap-2"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveSuggestion(suggestion)}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
                    <Check className="h-3 w-3" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analysis Configuration Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Configure AI Analysis
            </DialogTitle>
            <DialogDescription>
              Set up parameters for analyzing your data to generate FAQ suggestions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Analysis Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={analysisConfig.analysisType === 'support_tickets' ? 'default' : 'outline'}
                  onClick={() => setAnalysisConfig(prev => ({ ...prev, analysisType: 'support_tickets' }))}
                  className="gap-2 justify-start"
                >
                  <BarChart3 className="h-4 w-4" />
                  Support Tickets
                </Button>
                <Button
                  variant={analysisConfig.analysisType === 'search_queries' ? 'default' : 'outline'}
                  onClick={() => setAnalysisConfig(prev => ({ ...prev, analysisType: 'search_queries' }))}
                  className="gap-2 justify-start"
                >
                  <Search className="h-4 w-4" />
                  Search Queries
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select
                value={analysisConfig.dateRange}
                onValueChange={(value) => setAnalysisConfig(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minimum Occurrences</Label>
              <Input
                type="number"
                value={analysisConfig.minOccurrences}
                onChange={(e) => setAnalysisConfig(prev => ({
                  ...prev,
                  minOccurrences: parseInt(e.target.value) || 1
                }))}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Only suggest FAQs for patterns that occur at least this many times
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categories (optional)</Label>
              <Select
                value={analysisConfig.categories.join(',')}
                onValueChange={(value) => {
                  const cats = value ? value.split(',') : []
                  setAnalysisConfig(prev => ({ ...prev, categories: cats }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Analysis Preview</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Type: {analysisConfig.analysisType.replace('_', ' ')}</div>
                <div>Date range: {analysisConfig.dateRange}</div>
                <div>Minimum occurrences: {analysisConfig.minOccurrences}</div>
                <div>Categories: {analysisConfig.categories.length || 'All'}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalysisDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={runAnalysis}
              disabled={analysisLoading}
              className="gap-2"
            >
              {analysisLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Run Analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestion Details/Edit Dialog */}
      <Dialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSuggestion ? <Edit className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              {editingSuggestion ? 'Edit Suggestion' : 'Suggestion Details'}
            </DialogTitle>
          </DialogHeader>

          {(selectedSuggestion || editingSuggestion) && (
            <div className="space-y-6">
              {editingSuggestion ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Input
                      value={editingSuggestion.question}
                      onChange={(e) => setEditingSuggestion(prev => prev ? {
                        ...prev,
                        question: e.target.value
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Answer</Label>
                    <Textarea
                      value={editingSuggestion.suggestedAnswer}
                      onChange={(e) => setEditingSuggestion(prev => prev ? {
                        ...prev,
                        suggestedAnswer: e.target.value
                      } : null)}
                      rows={6}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editingSuggestion.category}
                        onValueChange={(value) => setEditingSuggestion(prev => prev ? {
                          ...prev,
                          category: value
                        } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={editingSuggestion.priority}
                        onValueChange={(value: 'high' | 'medium' | 'low') => setEditingSuggestion(prev => prev ? {
                          ...prev,
                          priority: value
                        } : null)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-6">
                  <div>
                    <Label className="text-sm font-medium">Question</Label>
                    <div className="mt-1 text-lg font-medium">{selectedSuggestion?.question}</div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Suggested Answer</Label>
                    <div className="mt-1 whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4">
                      {selectedSuggestion?.suggestedAnswer}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">Metadata</Label>
                      <div className="mt-1 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Category:</span>
                          <Badge variant="secondary">{selectedSuggestion?.category}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Priority:</span>
                          <Badge className={selectedSuggestion ? getPriorityColor(selectedSuggestion.priority) : ''}>
                            {selectedSuggestion?.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Source:</span>
                          <span>{selectedSuggestion?.source.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Frequency:</span>
                          <span>{selectedSuggestion?.frequency} occurrences</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Confidence:</span>
                          <span className={selectedSuggestion ? getConfidenceColor(selectedSuggestion.confidence) : ''}>
                            {selectedSuggestion?.confidence}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Keywords</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedSuggestion?.keywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSuggestionDialog(false)
              setEditingSuggestion(null)
              setSelectedSuggestion(null)
            }}>
              {editingSuggestion ? 'Cancel' : 'Close'}
            </Button>
            {editingSuggestion ? (
              <Button
                onClick={() => updateSuggestion(editingSuggestion)}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Save Changes
              </Button>
            ) : (
              selectedSuggestion && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingSuggestion(selectedSuggestion)
                      setSelectedSuggestion(null)
                    }}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => {
                      approveSuggestion(selectedSuggestion)
                      setShowSuggestionDialog(false)
                      setSelectedSuggestion(null)
                    }}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                </>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={showBulkApprovalDialog} onOpenChange={setShowBulkApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Selected Suggestions</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve {selectedSuggestions.size} suggestions and create them as FAQs?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2">
              {suggestions
                .filter(s => selectedSuggestions.has(s.id))
                .map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center gap-2 p-2 border rounded">
                    <Check className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{suggestion.question}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.category}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={bulkApprove}
              disabled={loading}
              className="gap-2"
            >
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Approve All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}