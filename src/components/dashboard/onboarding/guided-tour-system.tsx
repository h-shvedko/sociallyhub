'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  GuidedTour,
  TourStep,
  TourCategory,
  TooltipPlacement,
  ActionType,
  ValidationType,
  TourSettings
} from '@/types/onboarding'
import {
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Target,
  Lightbulb,
  HelpCircle,
  Zap,
  Users,
  BarChart3,
  Settings,
  Star
} from 'lucide-react'

interface GuidedTourSystemProps {
  tour: GuidedTour
  onComplete?: () => void
  onSkip?: () => void
  onStepChange?: (stepIndex: number) => void
  className?: string
}

interface TooltipProps {
  step: TourStep
  position: { top: number; left: number; width: number; height: number }
  placement: TooltipPlacement
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onClose: () => void
  showNext: boolean
  showPrev: boolean
  showSkip: boolean
  currentStepIndex: number
  totalSteps: number
  isLastStep: boolean
}

const Tooltip: React.FC<TooltipProps> = ({
  step,
  position,
  placement,
  onNext,
  onPrevious,
  onSkip,
  onClose,
  showNext,
  showPrev,
  showSkip,
  currentStepIndex,
  totalSteps,
  isLastStep
}) => {
  const getTooltipPosition = () => {
    const padding = 16
    const tooltipOffset = 12

    switch (placement) {
      case TooltipPlacement.TOP:
        return {
          top: position.top - tooltipOffset,
          left: position.left + position.width / 2,
          transform: 'translate(-50%, -100%)',
        }
      case TooltipPlacement.BOTTOM:
        return {
          top: position.top + position.height + tooltipOffset,
          left: position.left + position.width / 2,
          transform: 'translate(-50%, 0)',
        }
      case TooltipPlacement.LEFT:
        return {
          top: position.top + position.height / 2,
          left: position.left - tooltipOffset,
          transform: 'translate(-100%, -50%)',
        }
      case TooltipPlacement.RIGHT:
        return {
          top: position.top + position.height / 2,
          left: position.left + position.width + tooltipOffset,
          transform: 'translate(0, -50%)',
        }
      case TooltipPlacement.CENTER:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
      default:
        return {
          top: position.top + position.height + tooltipOffset,
          left: position.left + position.width / 2,
          transform: 'translate(-50%, 0)',
        }
    }
  }

  const tooltipStyle = getTooltipPosition()

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-0 h-0 border-solid'
    
    switch (placement) {
      case TooltipPlacement.TOP:
        return `${baseClasses} border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white top-full left-1/2 transform -translate-x-1/2`
      case TooltipPlacement.BOTTOM:
        return `${baseClasses} border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white bottom-full left-1/2 transform -translate-x-1/2`
      case TooltipPlacement.LEFT:
        return `${baseClasses} border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white left-full top-1/2 transform -translate-y-1/2`
      case TooltipPlacement.RIGHT:
        return `${baseClasses} border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white right-full top-1/2 transform -translate-y-1/2`
      default:
        return ''
    }
  }

  return (
    <Card
      className="absolute z-[9999] w-80 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
      style={tooltipStyle}
    >
      {placement !== TooltipPlacement.CENTER && (
        <div className={getArrowClasses()} />
      )}
      
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline" className="text-xs">
            Step {currentStepIndex + 1} of {totalSteps}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.content}
            </p>
          </div>

          {/* Progress */}
          <div className="w-full">
            <Progress
              value={((currentStepIndex + 1) / totalSteps) * 100}
              className="h-1"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              {showPrev && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrevious}
                  disabled={currentStepIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {showSkip && (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Skip Tour
                </Button>
              )}
              {showNext && (
                <Button
                  size="sm"
                  onClick={onNext}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLastStep ? (
                    <>
                      Finish
                      <CheckCircle className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function GuidedTourSystem({
  tour,
  onComplete,
  onSkip,
  onStepChange,
  className = ''
}: GuidedTourSystemProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(tour.currentStepIndex || 0)
  const [isActive, setIsActive] = useState(tour.isActive)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [elementPosition, setElementPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [isValidated, setIsValidated] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const currentStep = tour.steps[currentStepIndex]
  const isLastStep = currentStepIndex === tour.steps.length - 1

  const getCategoryIcon = (category: TourCategory) => {
    switch (category) {
      case TourCategory.GETTING_STARTED:
        return Star
      case TourCategory.CONTENT_CREATION:
        return Lightbulb
      case TourCategory.ANALYTICS:
        return BarChart3
      case TourCategory.TEAM_MANAGEMENT:
        return Users
      case TourCategory.ADVANCED_FEATURES:
        return Zap
      default:
        return HelpCircle
    }
  }

  const findTargetElement = useCallback((selector: string): HTMLElement | null => {
    if (!selector) return null
    
    try {
      return document.querySelector(selector) as HTMLElement
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`)
      return null
    }
  }, [])

  const updateElementPosition = useCallback(() => {
    if (!targetElement) return

    const rect = targetElement.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    setElementPosition({
      top: rect.top + scrollTop,
      left: rect.left + scrollLeft,
      width: rect.width,
      height: rect.height
    })
  }, [targetElement])

  const performStepAction = useCallback(async (step: TourStep) => {
    if (!step.action) return

    const target = step.action.target ? findTargetElement(step.action.target) : null

    try {
      switch (step.action.type) {
        case ActionType.CLICK:
          if (target) {
            target.click()
          }
          break
        case ActionType.NAVIGATE:
          if (step.action.value) {
            window.location.href = step.action.value
          }
          break
        case ActionType.FORM_FILL:
          if (target && target instanceof HTMLInputElement) {
            target.value = step.action.value || ''
            target.dispatchEvent(new Event('input', { bubbles: true }))
          }
          break
        case ActionType.WAIT:
          await new Promise(resolve => setTimeout(resolve, step.action.value || 1000))
          break
        case ActionType.CUSTOM:
          // Handle custom actions
          if (typeof window !== 'undefined' && (window as any).customTourActions) {
            await (window as any).customTourActions[step.action.value]?.()
          }
          break
      }
    } catch (error) {
      console.error('Error performing step action:', error)
    }
  }, [findTargetElement])

  const validateStep = useCallback(async (step: TourStep): Promise<boolean> => {
    if (!step.validation) return true

    const target = step.validation.target ? findTargetElement(step.validation.target) : null
    const timeout = step.validation.timeout || 5000

    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const checkValidation = () => {
        if (Date.now() - startTime > timeout) {
          resolve(false)
          return
        }

        try {
          switch (step.validation!.type) {
            case ValidationType.ELEMENT_EXISTS:
              resolve(!!target)
              return
            case ValidationType.ELEMENT_VISIBLE:
              if (target) {
                const rect = target.getBoundingClientRect()
                const isVisible = rect.width > 0 && rect.height > 0 && 
                  getComputedStyle(target).visibility !== 'hidden'
                resolve(isVisible)
                return
              }
              break
            case ValidationType.FORM_COMPLETED:
              if (target instanceof HTMLFormElement) {
                const formData = new FormData(target)
                const hasRequiredFields = Array.from(target.querySelectorAll('[required]'))
                  .every(field => {
                    if (field instanceof HTMLInputElement) {
                      return field.value.trim() !== ''
                    }
                    return true
                  })
                resolve(hasRequiredFields)
                return
              }
              break
            case ValidationType.API_CALL:
              // This would need to be implemented based on specific requirements
              resolve(true)
              return
          }
        } catch (error) {
          console.error('Validation error:', error)
        }

        setTimeout(checkValidation, 100)
      }

      checkValidation()
    })
  }, [findTargetElement])

  const handleNext = useCallback(async () => {
    if (currentStep) {
      // Perform action if specified
      if (currentStep.action) {
        await performStepAction(currentStep)
      }

      // Validate step if specified
      if (currentStep.validation) {
        const isValid = await validateStep(currentStep)
        if (!isValid) {
          console.warn(`Step validation failed for: ${currentStep.title}`)
          // You might want to show an error message here
          return
        }
      }
    }

    if (isLastStep) {
      setIsActive(false)
      onComplete?.()
    } else {
      const nextIndex = currentStepIndex + 1
      setCurrentStepIndex(nextIndex)
      onStepChange?.(nextIndex)
    }
  }, [currentStep, currentStepIndex, isLastStep, onComplete, onStepChange, performStepAction, validateStep])

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1
      setCurrentStepIndex(prevIndex)
      onStepChange?.(prevIndex)
    }
  }, [currentStepIndex, onStepChange])

  const handleSkip = useCallback(() => {
    setIsActive(false)
    onSkip?.()
  }, [onSkip])

  const handleClose = useCallback(() => {
    setIsActive(false)
  }, [])

  // Update target element when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return

    const element = currentStep.element ? findTargetElement(currentStep.element) : null
    setTargetElement(element)
  }, [currentStep, isActive, findTargetElement])

  // Update element position
  useEffect(() => {
    updateElementPosition()
  }, [updateElementPosition])

  // Handle window resize and scroll
  useEffect(() => {
    if (!isActive) return

    const handleResize = () => updateElementPosition()
    const handleScroll = () => updateElementPosition()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isActive, updateElementPosition])

  // Handle keyboard events
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          handleClose()
          break
        case 'ArrowRight':
        case 'Enter':
        case ' ':
          event.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          event.preventDefault()
          handlePrevious()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleNext, handlePrevious, handleClose])

  if (!isActive || !currentStep) {
    return null
  }

  const CategoryIcon = getCategoryIcon(tour.category)

  return createPortal(
    <>
      {/* Overlay */}
      {tour.settings.overlay && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 z-[9998]"
          style={{ pointerEvents: 'none' }}
        >
          {/* Spotlight Effect */}
          {targetElement && tour.settings.overlay && (
            <div
              className="absolute border-4 border-blue-500 rounded-lg shadow-lg"
              style={{
                top: elementPosition.top - tour.settings.spotlightPadding,
                left: elementPosition.left - tour.settings.spotlightPadding,
                width: elementPosition.width + (tour.settings.spotlightPadding * 2),
                height: elementPosition.height + (tour.settings.spotlightPadding * 2),
                boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.5)`,
                pointerEvents: 'none'
              }}
            />
          )}
        </div>
      )}

      {/* Tooltip */}
      <Tooltip
        step={currentStep}
        position={elementPosition}
        placement={currentStep.placement}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        onClose={handleClose}
        showNext={currentStep.showNext}
        showPrev={currentStep.showPrev}
        showSkip={currentStep.showSkip}
        currentStepIndex={currentStepIndex}
        totalSteps={tour.steps.length}
        isLastStep={isLastStep}
      />

      {/* Tour Progress (Bottom Right) */}
      {tour.settings.showProgress && (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <Card className="bg-white dark:bg-gray-800 shadow-lg">
            <CardContent className="p-4 min-w-[200px]">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <CategoryIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{tour.name}</h4>
                  <p className="text-xs text-muted-foreground">{tour.description}</p>
                </div>
              </div>
              <Progress
                value={((currentStepIndex + 1) / tour.steps.length) * 100}
                className="h-1"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {currentStepIndex + 1} of {tour.steps.length}
                </span>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentStepIndex === 0}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>,
    document.body
  )
}