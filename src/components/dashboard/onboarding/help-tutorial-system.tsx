'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  HelpContent,
  HelpContentType,
  HelpCategory,
  DifficultyLevel,
  Tutorial,
  TutorialStep,
  TutorialResource,
  ResourceType,
  CompletionTracking
} from '@/types/onboarding'
import {
  Search,
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  Star,
  Clock,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  Download,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Grid,
  List,
  Lightbulb,
  Users,
  BarChart3,
  Settings,
  Zap,
  MessageCircle,
  Target,
  Code,
  Image,
  Link2,
  BookmarkPlus
} from 'lucide-react'

interface HelpTutorialSystemProps {
  helpContent?: HelpContent[]
  tutorials?: Tutorial[]
  onContentView?: (contentId: string) => void
  onTutorialStart?: (tutorialId: string) => void
  onTutorialComplete?: (tutorialId: string) => void
  className?: string
}

interface TutorialPlayerProps {
  tutorial: Tutorial
  onComplete?: () => void
  onClose?: () => void
}

interface HelpContentItemProps {
  content: HelpContent
  onView?: () => void
  compact?: boolean
}

interface TutorialCardProps {
  tutorial: Tutorial
  onStart?: () => void
  compact?: boolean
}

interface SearchFiltersProps {
  categories: HelpCategory[]
  contentTypes: HelpContentType[]
  difficultyLevels: DifficultyLevel[]
  selectedCategory?: HelpCategory
  selectedType?: HelpContentType
  selectedDifficulty?: DifficultyLevel
  onCategoryChange: (category?: HelpCategory) => void
  onTypeChange: (type?: HelpContentType) => void
  onDifficultyChange: (difficulty?: DifficultyLevel) => void
}

// Mock data for demonstration
const mockHelpContent: HelpContent[] = [
  {
    id: '1',
    title: 'Getting Started with SociallyHub',
    type: HelpContentType.GUIDE,
    content: 'Learn the basics of using SociallyHub to manage your social media presence effectively.',
    category: HelpCategory.GETTING_STARTED,
    tags: ['basics', 'introduction', 'setup'],
    difficulty: DifficultyLevel.BEGINNER,
    estimatedReadTime: 5,
    lastUpdated: new Date('2024-01-15'),
    relatedTopics: ['account-setup', 'social-connections'],
    feedback: {
      helpful: 127,
      notHelpful: 3,
      averageRating: 4.8,
      comments: []
    }
  },
  {
    id: '2',
    title: 'Advanced Content Scheduling',
    type: HelpContentType.TUTORIAL,
    content: 'Master advanced scheduling features including bulk uploads, recurring posts, and optimal timing.',
    mediaUrl: '/tutorial-video-scheduling.mp4',
    category: HelpCategory.CONTENT_CREATION,
    tags: ['scheduling', 'automation', 'bulk-upload'],
    difficulty: DifficultyLevel.ADVANCED,
    estimatedReadTime: 12,
    lastUpdated: new Date('2024-01-20'),
    relatedTopics: ['content-calendar', 'automation'],
    feedback: {
      helpful: 89,
      notHelpful: 2,
      averageRating: 4.9,
      comments: []
    }
  },
  {
    id: '3',
    title: 'Understanding Analytics Reports',
    type: HelpContentType.ARTICLE,
    content: 'Deep dive into analytics reports, KPIs, and how to use data to improve your social media strategy.',
    category: HelpCategory.ANALYTICS,
    tags: ['analytics', 'reports', 'kpi', 'metrics'],
    difficulty: DifficultyLevel.INTERMEDIATE,
    estimatedReadTime: 8,
    lastUpdated: new Date('2024-01-18'),
    relatedTopics: ['performance-tracking', 'reporting'],
    feedback: {
      helpful: 156,
      notHelpful: 7,
      averageRating: 4.6,
      comments: []
    }
  }
]

const mockTutorials: Tutorial[] = [
  {
    id: 't1',
    title: 'Complete Onboarding Tutorial',
    description: 'Walk through all the essential features of SociallyHub from setup to publishing your first post.',
    category: HelpCategory.GETTING_STARTED,
    difficulty: DifficultyLevel.BEGINNER,
    estimatedTime: 15,
    steps: [
      {
        id: 'step1',
        title: 'Welcome to SociallyHub',
        content: 'Let\'s start by exploring the main dashboard and understanding the key areas.',
        mediaUrl: '/tutorial-step1.mp4',
        tips: ['Take your time to explore', 'Click around to get familiar']
      },
      {
        id: 'step2',
        title: 'Connect Your Social Accounts',
        content: 'Connect your first social media account to start managing your content.',
        action: {
          type: 'navigate',
          description: 'Click on the Connect Accounts button',
          target: '#connect-accounts',
          expectedResult: 'Social accounts page opens'
        },
        tips: ['Start with your most important platform', 'You can add more accounts later']
      }
    ],
    prerequisites: [],
    resources: [
      {
        id: 'r1',
        name: 'Quick Start Guide',
        type: ResourceType.DOCUMENT,
        url: '/quick-start.pdf',
        description: 'Printable quick reference guide'
      }
    ],
    completionTracking: {
      totalSteps: 2,
      completedSteps: 0,
      progress: []
    }
  }
]

// Help Content Item Component
const HelpContentItem: React.FC<HelpContentItemProps> = ({ content, onView, compact = false }) => {
  const getTypeIcon = (type: HelpContentType) => {
    switch (type) {
      case HelpContentType.VIDEO:
        return Video
      case HelpContentType.TUTORIAL:
        return Play
      case HelpContentType.GUIDE:
        return BookOpen
      case HelpContentType.FAQ:
        return HelpCircle
      case HelpContentType.TROUBLESHOOTING:
        return Settings
      default:
        return FileText
    }
  }

  const getDifficultyColor = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case DifficultyLevel.BEGINNER:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case DifficultyLevel.INTERMEDIATE:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case DifficultyLevel.ADVANCED:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
  }

  const TypeIcon = getTypeIcon(content.type)

  if (compact) {
    return (
      <div className="flex items-center p-3 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={onView}>
        <TypeIcon className="h-4 w-4 text-muted-foreground mr-3 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <h4 className="font-medium text-sm truncate">{content.title}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <Badge variant="outline" className={`text-xs ${getDifficultyColor(content.difficulty)}`}>
              {content.difficulty}
            </Badge>
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {content.estimatedReadTime}min
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <TypeIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-grow">
              <CardTitle className="text-base">{content.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{content.content}</p>
            </div>
          </div>
          <Badge variant="outline" className={getDifficultyColor(content.difficulty)}>
            {content.difficulty}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {content.estimatedReadTime}min read
            </div>
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1" />
              {content.feedback?.averageRating?.toFixed(1)}
            </div>
            <div className="flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" />
              {content.feedback?.helpful}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {content.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Tutorial Card Component
const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial, onStart, compact = false }) => {
  const progress = (tutorial.completionTracking.completedSteps / tutorial.completionTracking.totalSteps) * 100

  if (compact) {
    return (
      <div className="flex items-center p-3 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={onStart}>
        <Play className="h-4 w-4 text-muted-foreground mr-3 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <h4 className="font-medium text-sm truncate">{tutorial.title}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {tutorial.estimatedTime}min
            </div>
            {progress > 0 && (
              <Badge variant="outline" className="text-xs">
                {Math.round(progress)}% complete
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
            <Play className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-grow">
            <CardTitle className="text-base">{tutorial.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{tutorial.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {tutorial.estimatedTime}min
            </div>
            <div className="flex items-center">
              <Target className="h-4 w-4 mr-1" />
              {tutorial.steps.length} steps
            </div>
          </div>
          
          <Button onClick={onStart} size="sm">
            {progress > 0 ? 'Continue' : 'Start Tutorial'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Search Filters Component
const SearchFilters: React.FC<SearchFiltersProps> = ({
  categories,
  contentTypes,
  difficultyLevels,
  selectedCategory,
  selectedType,
  selectedDifficulty,
  onCategoryChange,
  onTypeChange,
  onDifficultyChange
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Category</label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(undefined)}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(category)}
            >
              {category.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Content Type</label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedType ? "default" : "outline"}
            size="sm"
            onClick={() => onTypeChange(undefined)}
          >
            All
          </Button>
          {contentTypes.map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onTypeChange(type)}
            >
              {type.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Difficulty</label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedDifficulty ? "default" : "outline"}
            size="sm"
            onClick={() => onDifficultyChange(undefined)}
          >
            All
          </Button>
          {difficultyLevels.map((difficulty) => (
            <Button
              key={difficulty}
              variant={selectedDifficulty === difficulty ? "default" : "outline"}
              size="sm"
              onClick={() => onDifficultyChange(difficulty)}
            >
              {difficulty}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Tutorial Player Component
const TutorialPlayer: React.FC<TutorialPlayerProps> = ({ tutorial, onComplete, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  const currentStep = tutorial.steps[currentStepIndex]
  const isLastStep = currentStepIndex === tutorial.steps.length - 1
  const progress = ((currentStepIndex + 1) / tutorial.steps.length) * 100

  const handleNext = () => {
    const stepId = currentStep.id
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId])
    }

    if (isLastStep) {
      onComplete?.()
    } else {
      setCurrentStepIndex(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">{tutorial.title}</h2>
              <p className="text-sm text-muted-foreground">{tutorial.description}</p>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{currentStepIndex + 1} of {tutorial.steps.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">{currentStep.title}</h3>
            <p className="text-muted-foreground">{currentStep.content}</p>
          </div>

          {currentStep.mediaUrl && (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <video
                src={currentStep.mediaUrl}
                controls
                className="w-full h-full rounded-lg"
                poster="/tutorial-thumbnail.jpg"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {currentStep.codeExample && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Code className="h-4 w-4 mr-2" />
                  Code Example
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{currentStep.codeExample}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          {currentStep.tips && currentStep.tips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentStep.tips.map((tip, index) => (
                    <li key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span className="text-sm">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-muted/30">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center space-x-2">
              {tutorial.steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index <= currentStepIndex ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  Complete
                  <CheckCircle className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Help & Tutorial System Component
export function HelpTutorialSystem({
  helpContent = mockHelpContent,
  tutorials = mockTutorials,
  onContentView,
  onTutorialStart,
  onTutorialComplete,
  className = ''
}: HelpTutorialSystemProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory>()
  const [selectedType, setSelectedType] = useState<HelpContentType>()
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const categories = Object.values(HelpCategory)
  const contentTypes = Object.values(HelpContentType)
  const difficultyLevels = Object.values(DifficultyLevel)

  const filteredContent = helpContent.filter(content => {
    const matchesSearch = !searchQuery || 
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = !selectedCategory || content.category === selectedCategory
    const matchesType = !selectedType || content.type === selectedType
    const matchesDifficulty = !selectedDifficulty || content.difficulty === selectedDifficulty

    return matchesSearch && matchesCategory && matchesType && matchesDifficulty
  })

  const filteredTutorials = tutorials.filter(tutorial => {
    const matchesSearch = !searchQuery || 
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = !selectedCategory || tutorial.category === selectedCategory
    const matchesDifficulty = !selectedDifficulty || tutorial.difficulty === selectedDifficulty

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const handleTutorialStart = (tutorial: Tutorial) => {
    setActiveTutorial(tutorial)
    onTutorialStart?.(tutorial.id)
  }

  const handleTutorialComplete = () => {
    if (activeTutorial) {
      onTutorialComplete?.(activeTutorial.id)
    }
    setActiveTutorial(null)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Help & Tutorials</h1>
          <p className="text-muted-foreground">Find answers and learn new skills</p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search help articles and tutorials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showFilters && (
              <>
                <Separator />
                <SearchFilters
                  categories={categories}
                  contentTypes={contentTypes}
                  difficultyLevels={difficultyLevels}
                  selectedCategory={selectedCategory}
                  selectedType={selectedType}
                  selectedDifficulty={selectedDifficulty}
                  onCategoryChange={setSelectedCategory}
                  onTypeChange={setSelectedType}
                  onDifficultyChange={setSelectedDifficulty}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Content</TabsTrigger>
          <TabsTrigger value="articles">Help Articles</TabsTrigger>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-6">
            {/* Quick Start Tutorials */}
            {filteredTutorials.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Quick Start Tutorials</h2>
                <div className={
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "space-y-3"
                }>
                  {filteredTutorials.map((tutorial) => (
                    <TutorialCard
                      key={tutorial.id}
                      tutorial={tutorial}
                      onStart={() => handleTutorialStart(tutorial)}
                      compact={viewMode === 'list'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Help Articles */}
            {filteredContent.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Help Articles</h2>
                <div className={
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    : "space-y-3"
                }>
                  {filteredContent.map((content) => (
                    <HelpContentItem
                      key={content.id}
                      content={content}
                      onView={() => onContentView?.(content.id)}
                      compact={viewMode === 'list'}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredContent.length === 0 && filteredTutorials.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No results found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or filters
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="articles">
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-3"
          }>
            {filteredContent.map((content) => (
              <HelpContentItem
                key={content.id}
                content={content}
                onView={() => onContentView?.(content.id)}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tutorials">
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-3"
          }>
            {filteredTutorials.map((tutorial) => (
              <TutorialCard
                key={tutorial.id}
                tutorial={tutorial}
                onStart={() => handleTutorialStart(tutorial)}
                compact={viewMode === 'list'}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tutorial Player */}
      {activeTutorial && (
        <TutorialPlayer
          tutorial={activeTutorial}
          onComplete={handleTutorialComplete}
          onClose={() => setActiveTutorial(null)}
        />
      )}
    </div>
  )
}