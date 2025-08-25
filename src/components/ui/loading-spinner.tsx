"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "circular" | "dots" | "pulse"
  className?: string
}

export function LoadingSpinner({ 
  size = "md", 
  variant = "circular",
  className 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  }

  if (variant === "circular") {
    return (
      <div className={cn("animate-spin", sizeClasses[size], className)}>
        <svg
          className="w-full h-full text-primary"
          viewBox="0 0 50 50"
          fill="none"
          stroke="currentColor"
        >
          <circle
            className="spinner-material"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    )
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex space-x-1", className)}>
        <div 
          className={cn(
            "rounded-full bg-primary animate-bounce",
            size === "sm" ? "w-1 h-1" : 
            size === "md" ? "w-2 h-2" :
            size === "lg" ? "w-3 h-3" : "w-4 h-4"
          )}
          style={{ animationDelay: "0ms" }}
        />
        <div 
          className={cn(
            "rounded-full bg-primary animate-bounce",
            size === "sm" ? "w-1 h-1" : 
            size === "md" ? "w-2 h-2" :
            size === "lg" ? "w-3 h-3" : "w-4 h-4"
          )}
          style={{ animationDelay: "150ms" }}
        />
        <div 
          className={cn(
            "rounded-full bg-primary animate-bounce",
            size === "sm" ? "w-1 h-1" : 
            size === "md" ? "w-2 h-2" :
            size === "lg" ? "w-3 h-3" : "w-4 h-4"
          )}
          style={{ animationDelay: "300ms" }}
        />
      </div>
    )
  }

  if (variant === "pulse") {
    return (
      <div 
        className={cn(
          "rounded-full bg-primary animate-pulse-slow opacity-75",
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return null
}

interface LoadingStateProps {
  loading: boolean
  children: React.ReactNode
  loadingText?: string
  spinner?: {
    size?: "sm" | "md" | "lg" | "xl"
    variant?: "circular" | "dots" | "pulse"
  }
  className?: string
}

export function LoadingState({ 
  loading, 
  children, 
  loadingText = "Loading...",
  spinner = {},
  className 
}: LoadingStateProps) {
  if (loading) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center space-y-4 p-8",
        "animate-fade-in",
        className
      )}>
        <LoadingSpinner {...spinner} />
        {loadingText && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {loadingText}
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}

export function ButtonLoading({ 
  loading, 
  children, 
  loadingText,
  className,
  ...props 
}: {
  loading: boolean
  children: React.ReactNode
  loadingText?: string
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-all duration-200",
        className
      )}
      disabled={loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" className="mr-2" />
          {loadingText && (
            <span className="text-sm">{loadingText}</span>
          )}
        </div>
      )}
      <div className={cn(loading && "opacity-0")}>
        {children}
      </div>
    </button>
  )
}