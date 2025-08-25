"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  const [displayChildren, setDisplayChildren] = React.useState(children)
  const prevPathname = React.useRef(pathname)

  React.useEffect(() => {
    if (pathname !== prevPathname.current) {
      setIsTransitioning(true)
      
      // Start exit transition
      setTimeout(() => {
        setDisplayChildren(children)
        setIsTransitioning(false)
        prevPathname.current = pathname
      }, 150)
    }
  }, [pathname, children])

  return (
    <div 
      className={cn(
        "transition-all duration-300 ease-in-out",
        isTransitioning ? "page-exit-active" : "page-enter-active",
        className
      )}
    >
      {displayChildren}
    </div>
  )
}

interface FadeTransitionProps {
  show: boolean
  children: React.ReactNode
  className?: string
  duration?: number
}

export function FadeTransition({ 
  show, 
  children, 
  className,
  duration = 300 
}: FadeTransitionProps) {
  const [shouldRender, setShouldRender] = React.useState(show)

  React.useEffect(() => {
    if (show) {
      setShouldRender(true)
    }
  }, [show])

  const onAnimationEnd = React.useCallback(() => {
    if (!show) {
      setShouldRender(false)
    }
  }, [show])

  if (!shouldRender) return null

  return (
    <div
      className={cn(
        "transition-opacity ease-in-out",
        show ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms` 
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  )
}

interface SlideTransitionProps {
  show: boolean
  children: React.ReactNode
  direction?: "up" | "down" | "left" | "right"
  className?: string
  duration?: number
}

export function SlideTransition({
  show,
  children,
  direction = "up",
  className,
  duration = 300
}: SlideTransitionProps) {
  const [shouldRender, setShouldRender] = React.useState(show)

  React.useEffect(() => {
    if (show) {
      setShouldRender(true)
    }
  }, [show])

  const onAnimationEnd = React.useCallback(() => {
    if (!show) {
      setShouldRender(false)
    }
  }, [show])

  if (!shouldRender) return null

  const transformClasses = {
    up: show ? "translate-y-0" : "translate-y-4",
    down: show ? "translate-y-0" : "-translate-y-4", 
    left: show ? "translate-x-0" : "translate-x-4",
    right: show ? "translate-x-0" : "-translate-x-4"
  }

  return (
    <div
      className={cn(
        "transition-all ease-out",
        "transform",
        show ? "opacity-100" : "opacity-0",
        transformClasses[direction],
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms` 
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  )
}

interface ScaleTransitionProps {
  show: boolean
  children: React.ReactNode
  className?: string
  duration?: number
}

export function ScaleTransition({
  show,
  children,
  className,
  duration = 200
}: ScaleTransitionProps) {
  const [shouldRender, setShouldRender] = React.useState(show)

  React.useEffect(() => {
    if (show) {
      setShouldRender(true)
    }
  }, [show])

  const onAnimationEnd = React.useCallback(() => {
    if (!show) {
      setShouldRender(false)
    }
  }, [show])

  if (!shouldRender) return null

  return (
    <div
      className={cn(
        "transition-all ease-out",
        "transform origin-center",
        show ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms` 
      }}
      onTransitionEnd={onAnimationEnd}
    >
      {children}
    </div>
  )
}

export function StaggeredFadeIn({ 
  children,
  delay = 0,
  stagger = 100,
  className 
}: {
  children: React.ReactNode[]
  delay?: number
  stagger?: number 
  className?: string
}) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className="animate-fade-in"
          style={{
            animationDelay: `${delay + index * stagger}ms`,
            animationFillMode: "both"
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}