'use client'

import React from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  ProgressIndicator,
  ProgressType,
  ProgressSize,
  OnboardingStep,
  OnboardingStepStatus
} from '@/types/onboarding'
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  ChevronRight
} from 'lucide-react'

interface ProgressIndicatorProps {
  indicator: ProgressIndicator
  className?: string
}

interface OnboardingProgressProps {
  steps: OnboardingStep[]
  currentStepId?: string
  completionPercentage: number
  className?: string
}

interface StepProgressProps {
  steps: OnboardingStep[]
  currentStepId?: string
  onStepClick?: (stepId: string) => void
  className?: string
}

interface CircularProgressProps {
  value: number
  maxValue: number
  size?: ProgressSize
  color?: string
  showPercentage?: boolean
  label?: string
  className?: string
}

interface ChecklistProgressProps {
  items: Array<{
    id: string
    label: string
    completed: boolean
    required?: boolean
  }>
  onItemToggle?: (itemId: string) => void
  className?: string
}

// Basic Progress Indicator Component
export function ProgressIndicatorComponent({
  indicator,
  className = ''
}: ProgressIndicatorProps) {
  const percentage = indicator.maxValue > 0 ? (indicator.currentValue / indicator.maxValue) * 100 : 0

  const getSizeClasses = () => {
    switch (indicator.size) {
      case ProgressSize.SMALL:
        return 'h-1'
      case ProgressSize.MEDIUM:
        return 'h-2'
      case ProgressSize.LARGE:
        return 'h-4'
      default:
        return 'h-2'
    }
  }

  const renderByType = () => {
    switch (indicator.type) {
      case ProgressType.LINEAR:
        return (
          <div className={`space-y-2 ${className}`}>
            {indicator.label && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{indicator.label}</span>
                {indicator.showPercentage && (
                  <span className="text-muted-foreground">
                    {Math.round(percentage)}%
                  </span>
                )}
              </div>
            )}
            <Progress
              value={percentage}
              className={getSizeClasses()}
              style={{ 
                color: indicator.color,
                ...(indicator.animated && { transition: 'all 0.3s ease-in-out' })
              }}
            />
            {indicator.showSteps && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{indicator.currentValue}</span>
                <span>{indicator.maxValue}</span>
              </div>
            )}
          </div>
        )

      case ProgressType.CIRCULAR:
        return (
          <CircularProgressComponent
            value={indicator.currentValue}
            maxValue={indicator.maxValue}
            size={indicator.size}
            color={indicator.color}
            showPercentage={indicator.showPercentage}
            label={indicator.label}
            className={className}
          />
        )

      default:
        return null
    }
  }

  return renderByType()
}

// Circular Progress Component
export function CircularProgressComponent({
  value,
  maxValue,
  size = ProgressSize.MEDIUM,
  color = '#3b82f6',
  showPercentage = true,
  label,
  className = ''
}: CircularProgressProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
  
  const getSizeDimensions = () => {
    switch (size) {
      case ProgressSize.SMALL:
        return { size: 60, strokeWidth: 4, fontSize: 'text-xs' }
      case ProgressSize.MEDIUM:
        return { size: 80, strokeWidth: 6, fontSize: 'text-sm' }
      case ProgressSize.LARGE:
        return { size: 120, strokeWidth: 8, fontSize: 'text-base' }
      default:
        return { size: 80, strokeWidth: 6, fontSize: 'text-sm' }
    }
  }

  const { size: circleSize, strokeWidth, fontSize } = getSizeDimensions()
  const radius = (circleSize - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <div className="relative" style={{ width: circleSize, height: circleSize }}>
        <svg
          width={circleSize}
          height={circleSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-300 ease-in-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <span className={`font-bold ${fontSize}`} style={{ color }}>
              {Math.round(percentage)}%
            </span>
          )}
          {!showPercentage && (
            <span className={`font-bold ${fontSize}`} style={{ color }}>
              {value}/{maxValue}
            </span>
          )}
        </div>
      </div>
      
      {label && (
        <span className="text-sm text-center text-muted-foreground max-w-24">
          {label}
        </span>
      )}
    </div>
  )
}

// Step Progress Component
export function StepProgressComponent({
  steps,
  currentStepId,
  onStepClick,
  className = ''
}: StepProgressProps) {
  const getStatusIcon = (status: OnboardingStepStatus, isActive: boolean) => {
    const iconClass = `h-4 w-4 ${isActive ? 'text-blue-600' : ''}`
    
    switch (status) {
      case OnboardingStepStatus.COMPLETED:
        return <CheckCircle className={`${iconClass} text-green-600`} />
      case OnboardingStepStatus.IN_PROGRESS:
        return <Play className={`${iconClass} text-blue-600`} />
      case OnboardingStepStatus.BLOCKED:
        return <XCircle className={`${iconClass} text-red-600`} />
      case OnboardingStepStatus.SKIPPED:
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />
      default:
        return <Circle className={`${iconClass} text-gray-400`} />
    }
  }

  const getStatusColor = (status: OnboardingStepStatus) => {
    switch (status) {
      case OnboardingStepStatus.COMPLETED:
        return 'border-green-500 bg-green-50 dark:bg-green-900/20'
      case OnboardingStepStatus.IN_PROGRESS:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case OnboardingStepStatus.BLOCKED:
        return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case OnboardingStepStatus.SKIPPED:
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-800'
    }
  }

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order)

  return (
    <div className={`space-y-3 ${className}`}>
      {sortedSteps.map((step, index) => {
        const isActive = step.id === currentStepId
        const isClickable = !!onStepClick && (
          step.status === OnboardingStepStatus.COMPLETED ||
          step.status === OnboardingStepStatus.IN_PROGRESS ||
          isActive
        )

        return (
          <div key={step.id} className="relative">
            <div
              className={`
                flex items-center p-3 rounded-lg border transition-all duration-200
                ${getStatusColor(step.status)}
                ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                ${isClickable ? 'cursor-pointer hover:shadow-sm' : ''}
              `}
              onClick={() => isClickable && onStepClick?.(step.id)}
            >
              {/* Step number/status icon */}
              <div className="flex-shrink-0 mr-3">
                {getStatusIcon(step.status, isActive)}
              </div>

              {/* Step content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`font-medium ${isActive ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                    {step.title}
                  </h4>
                  <div className="flex items-center space-x-2">
                    {step.required && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                    {step.estimatedTime > 0 && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {step.estimatedTime}min
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </p>

                {/* Completion info */}
                {step.completedAt && (
                  <div className="flex items-center text-xs text-green-600 mt-2">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed {new Date(step.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Arrow for clickable steps */}
              {isClickable && (
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
              )}
            </div>

            {/* Connection line */}
            {index < sortedSteps.length - 1 && (
              <div className="absolute left-5 top-12 w-0.5 h-6 bg-gray-300 dark:bg-gray-600" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Onboarding Progress Overview
export function OnboardingProgressOverview({
  steps,
  currentStepId,
  completionPercentage,
  className = ''
}: OnboardingProgressProps) {
  const completedSteps = steps.filter(step => step.status === OnboardingStepStatus.COMPLETED)
  const totalSteps = steps.length
  const currentStep = steps.find(step => step.id === currentStepId)

  const getNextSteps = () => {
    return steps
      .filter(step => 
        step.status === OnboardingStepStatus.NOT_STARTED && 
        (!step.dependencies || step.dependencies.every(depId => 
          steps.find(s => s.id === depId)?.status === OnboardingStepStatus.COMPLETED
        ))
      )
      .sort((a, b) => a.order - b.order)
      .slice(0, 3)
  }

  const nextSteps = getNextSteps()
  const totalEstimatedTime = steps.reduce((total, step) => total + step.estimatedTime, 0)
  const remainingTime = steps
    .filter(step => step.status !== OnboardingStepStatus.COMPLETED)
    .reduce((total, step) => total + step.estimatedTime, 0)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Onboarding Progress</h3>
              <p className="text-sm text-muted-foreground">
                {completedSteps.length} of {totalSteps} steps completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(completionPercentage)}%
              </div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>

          <div className="space-y-4">
            <Progress value={completionPercentage} className="h-2" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-green-600">
                  {completedSteps.length}
                </div>
                <div className="text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-600">
                  {steps.filter(s => s.status === OnboardingStepStatus.IN_PROGRESS).length}
                </div>
                <div className="text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-600">
                  {steps.filter(s => s.status === OnboardingStepStatus.NOT_STARTED).length}
                </div>
                <div className="text-muted-foreground">Remaining</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600">
                  {remainingTime}min
                </div>
                <div className="text-muted-foreground">Time Left</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step */}
      {currentStep && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Current Step</h3>
            <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Play className="h-5 w-5 text-blue-600 mr-3" />
              <div className="flex-grow">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  {currentStep.title}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {currentStep.description}
                </p>
              </div>
              {currentStep.estimatedTime > 0 && (
                <div className="text-sm text-blue-600">
                  {currentStep.estimatedTime}min
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Coming Up Next</h3>
            <div className="space-y-3">
              {nextSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <Circle className="h-4 w-4 text-gray-400 mr-3" />
                  <div className="flex-grow">
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                  {step.estimatedTime > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {step.estimatedTime}min
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Checklist Progress Component
export function ChecklistProgressComponent({
  items,
  onItemToggle,
  className = ''
}: ChecklistProgressProps) {
  const completedItems = items.filter(item => item.completed)
  const completionPercentage = items.length > 0 ? (completedItems.length / items.length) * 100 : 0

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Setup Checklist</h3>
        <Badge variant="outline">
          {completedItems.length}/{items.length} Complete
        </Badge>
      </div>

      <Progress value={completionPercentage} className="h-2" />

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              flex items-center p-3 rounded-lg border transition-all duration-200
              ${item.completed 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }
              ${onItemToggle ? 'cursor-pointer hover:shadow-sm' : ''}
            `}
            onClick={() => onItemToggle?.(item.id)}
          >
            <div className="flex-shrink-0 mr-3">
              {item.completed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-grow">
              <span className={`font-medium ${item.completed ? 'line-through text-green-800 dark:text-green-200' : ''}`}>
                {item.label}
              </span>
              {item.required && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Required
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}