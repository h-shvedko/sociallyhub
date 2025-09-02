'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationLoader() {
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  
  useEffect(() => {
    // Listen for link clicks and navigation events
    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      
      if (link && link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
        const url = new URL(link.href)
        const currentUrl = new URL(window.location.href)
        
        // Only show loader for internal navigation
        if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
          setLoading(true)
          // Auto-hide loader after 5 seconds if navigation takes too long
          setTimeout(() => setLoading(false), 5000)
        }
      }
    }

    // Listen for programmatic navigation
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      setLoading(true)
      setTimeout(() => setLoading(false), 5000)
      return originalPushState.apply(history, args)
    }

    history.replaceState = function(...args) {
      setLoading(true)
      setTimeout(() => setLoading(false), 5000)
      return originalReplaceState.apply(history, args)
    }

    // Listen for back/forward navigation
    const handlePopstate = () => {
      setLoading(true)
      setTimeout(() => setLoading(false), 5000)
    }

    // Add event listeners
    document.addEventListener('click', handleLinkClick, true)
    window.addEventListener('popstate', handlePopstate)

    return () => {
      document.removeEventListener('click', handleLinkClick, true)
      window.removeEventListener('popstate', handlePopstate)
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
    }
  }, [])

  useEffect(() => {
    // Hide loader when pathname changes (navigation complete)
    const timer = setTimeout(() => {
      setLoading(false)
    }, 100) // Small delay to ensure page is ready

    return () => clearTimeout(timer)
  }, [pathname])

  if (!loading) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999
      }}
    >
      <div className="bg-white rounded-lg p-6 shadow-2xl min-w-[200px]">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-gray-700 font-medium">Loading page...</p>
        </div>
      </div>
    </div>
  )
}