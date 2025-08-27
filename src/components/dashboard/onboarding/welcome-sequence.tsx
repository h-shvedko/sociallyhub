'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  WelcomeSequence as WelcomeSequenceType,
  WelcomeStep,
  WelcomeStepType,
  PersonalizationData,
  ExperienceLevel
} from '@/types/onboarding'
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Star,
  Target,
  User,
  Building2,
  Briefcase,
  Heart,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react'

interface WelcomeSequenceProps {
  sequence: WelcomeSequenceType
  onStepComplete?: (stepId: string) => void
  onSequenceComplete?: (personalizationData: PersonalizationData) => void
  onSkip?: () => void
}

export function WelcomeSequence({
  sequence,
  onStepComplete,
  onSequenceComplete,
  onSkip
}: WelcomeSequenceProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>(sequence.completedSteps || [])
  const [personalization, setPersonalization] = useState<PersonalizationData>(
    sequence.personalizations || {}
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<NodeJS.Timeout | null>(null)

  const currentStep = sequence.steps[currentStepIndex]
  const isLastStep = currentStepIndex === sequence.steps.length - 1
  const progress = ((currentStepIndex + 1) / sequence.steps.length) * 100

  useEffect(() => {
    if (isPlaying && currentStep?.duration && currentStep.duration > 0) {
      const timer = setTimeout(() => {
        handleNext()
      }, currentStep.duration * 1000)
      setAutoAdvanceTimer(timer)
      return () => clearTimeout(timer)
    }
  }, [currentStepIndex, isPlaying])

  const handleNext = () => {
    if (currentStep) {
      const newCompletedSteps = [...completedSteps, currentStep.id]
      setCompletedSteps(newCompletedSteps)
      onStepComplete?.(currentStep.id)
    }

    if (isLastStep) {
      onSequenceComplete?.(personalization)
    } else {
      setCurrentStepIndex(prev => Math.min(prev + 1, sequence.steps.length - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStepIndex(prev => Math.max(prev - 1, 0))
  }

  const handlePersonalizationChange = (field: keyof PersonalizationData, value: any) => {
    setPersonalization(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const toggleAutoPlay = () => {
    setIsPlaying(!isPlaying)
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer)
      setAutoAdvanceTimer(null)
    }
  }

  const renderStepContent = () => {
    if (!currentStep) return null

    switch (currentStep.type) {
      case WelcomeStepType.INTRO:
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {currentStep.title}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {currentStep.content}
              </p>
            </div>
          </div>
        )

      case WelcomeStepType.VIDEO:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
              <p className="text-muted-foreground">{currentStep.content}</p>
            </div>
            {currentStep.mediaUrl && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <video
                  src={currentStep.mediaUrl}
                  controls
                  className="w-full h-full object-cover"
                  poster="/placeholder-video-thumbnail.jpg"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        )

      case WelcomeStepType.FEATURE_HIGHLIGHT:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{currentStep.content}</p>
            </div>
            {currentStep.mediaUrl && (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img
                  src={currentStep.mediaUrl}
                  alt="Feature highlight"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="text-center p-4">
                <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-medium">Team Collaboration</h3>
                <p className="text-sm text-muted-foreground">Work together seamlessly</p>
              </Card>
              <Card className="text-center p-4">
                <Zap className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-medium">Automation</h3>
                <p className="text-sm text-muted-foreground">Save time with smart tools</p>
              </Card>
              <Card className="text-center p-4">
                <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-medium">Analytics</h3>
                <p className="text-sm text-muted-foreground">Data-driven insights</p>
              </Card>
            </div>
          </div>
        )

      case WelcomeStepType.TESTIMONIAL:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
            </div>
            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-lg italic mb-4">
                  "{currentStep.content}"
                </blockquote>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-medium">Sarah Johnson</div>
                    <div className="text-sm text-muted-foreground">Marketing Director</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case WelcomeStepType.GOAL_SETTING:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{currentStep.content}</p>
            </div>
            
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-lg">What are your main goals?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    'Increase brand awareness',
                    'Drive website traffic',
                    'Generate more leads',
                    'Improve engagement',
                    'Build community',
                    'Boost sales',
                    'Save time',
                    'Better analytics'
                  ].map((goal) => (
                    <Button
                      key={goal}
                      variant={personalization.goals?.includes(goal) ? "default" : "outline"}
                      className="justify-start h-auto p-3"
                      onClick={() => {
                        const currentGoals = personalization.goals || []
                        const newGoals = currentGoals.includes(goal)
                          ? currentGoals.filter(g => g !== goal)
                          : [...currentGoals, goal]
                        handlePersonalizationChange('goals', newGoals)
                      }}
                    >
                      {personalization.goals?.includes(goal) && (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {goal}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case WelcomeStepType.PERSONALIZATION:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center mb-4">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">{currentStep.title}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{currentStep.content}</p>
            </div>

            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      value={personalization.name || ''}
                      onChange={(e) => handlePersonalizationChange('name', e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={personalization.company || ''}
                      onChange={(e) => handlePersonalizationChange('company', e.target.value)}
                      placeholder="Your company name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Your Role</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: 'Marketing Manager', icon: TrendingUp },
                      { value: 'Social Media Manager', icon: Users },
                      { value: 'Content Creator', icon: Sparkles },
                      { value: 'Business Owner', icon: Building2 },
                      { value: 'Freelancer', icon: User },
                      { value: 'Agency Owner', icon: Briefcase },
                      { value: 'Student', icon: Target },
                      { value: 'Other', icon: Heart }
                    ].map(({ value, icon: Icon }) => (
                      <Button
                        key={value}
                        variant={personalization.role === value ? "default" : "outline"}
                        className="h-auto p-3 flex flex-col items-center space-y-1"
                        onClick={() => handlePersonalizationChange('role', value)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{value}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <div className="flex space-x-2">
                    {Object.values(ExperienceLevel).map((level) => (
                      <Button
                        key={level}
                        variant={personalization.experience === level ? "default" : "outline"}
                        onClick={() => handlePersonalizationChange('experience', level)}
                        className="flex-1"
                      >
                        {level.charAt(0) + level.slice(1).toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Interests</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Photography',
                      'Design',
                      'Writing',
                      'Video',
                      'Analytics',
                      'Strategy',
                      'E-commerce',
                      'B2B',
                      'Influencer Marketing',
                      'Paid Ads'
                    ].map((interest) => (
                      <Button
                        key={interest}
                        variant={personalization.interests?.includes(interest) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const currentInterests = personalization.interests || []
                          const newInterests = currentInterests.includes(interest)
                            ? currentInterests.filter(i => i !== interest)
                            : [...currentInterests, interest]
                          handlePersonalizationChange('interests', newInterests)
                        }}
                      >
                        {interest}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">{currentStep.title}</h2>
            <p className="text-muted-foreground">{currentStep.content}</p>
          </div>
        )
    }
  }

  if (!currentStep) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-white/50 backdrop-blur-sm">
                Step {currentStepIndex + 1} of {sequence.steps.length}
              </Badge>
              {currentStep.duration && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAutoPlay}
                  className="bg-white/50 backdrop-blur-sm"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={onSkip}>
            Skip Tour
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 bg-white/50 backdrop-blur-sm" />
        </div>

        {/* Main Content */}
        <div className="mb-8">
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-8 md:p-12">
              {renderStepContent()}
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="bg-white/50 backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {sequence.steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-blue-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="space-x-2">
            {currentStep.actionUrl && currentStep.actionLabel && (
              <Button
                variant="outline"
                onClick={() => window.open(currentStep.actionUrl, '_blank')}
                className="bg-white/50 backdrop-blur-sm"
              >
                {currentStep.actionLabel}
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isLastStep ? 'Complete' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              {isLastStep && <CheckCircle className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}