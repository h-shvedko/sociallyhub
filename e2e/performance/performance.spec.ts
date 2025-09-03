import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

test.use({ storageState: 'e2e/auth.json' })

test.describe('Performance Tests', () => {
  test('landing page performance should meet thresholds', async ({ page }) => {
    // Start performance monitoring
    await page.goto('/', { waitUntil: 'networkidle' })
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0]
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: fcp ? fcp.startTime : null,
        largestContentfulPaint: lcp ? lcp.startTime : null,
        domNodes: document.querySelectorAll('*').length,
        totalSize: navigation.transferSize || 0,
      }
    })
    
    // Performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(1500) // < 1.5s
    expect(metrics.loadComplete).toBeLessThan(3000) // < 3s
    expect(metrics.firstContentfulPaint).toBeLessThan(1200) // < 1.2s
    expect(metrics.largestContentfulPaint).toBeLessThan(2500) // < 2.5s
    expect(metrics.domNodes).toBeLessThan(1500) // Not too many DOM nodes
    
    console.log('Landing Page Performance:', metrics)
  })

  test('dashboard performance should meet thresholds', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: fcp ? fcp.startTime : null,
        memoryUsage: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        } : null,
      }
    })
    
    expect(metrics.domContentLoaded).toBeLessThan(2000) // < 2s for dashboard
    expect(metrics.loadComplete).toBeLessThan(4000) // < 4s for dashboard
    expect(metrics.firstContentfulPaint).toBeLessThan(1500) // < 1.5s
    
    console.log('Dashboard Performance:', metrics)
  })

  test('API response times should be acceptable', async ({ page }) => {
    const apiCalls: { url: string; duration: number }[] = []
    
    // Monitor API calls
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const request = response.request()
        const timing = response.timing()
        apiCalls.push({
          url: response.url(),
          duration: timing.responseEnd - timing.requestStart
        })
      }
    })
    
    await page.goto('/dashboard/posts', { waitUntil: 'networkidle' })
    
    // Check API response times
    for (const call of apiCalls) {
      expect(call.duration).toBeLessThan(2000) // < 2s per API call
      console.log(`API Call: ${call.url} - ${call.duration}ms`)
    }
    
    expect(apiCalls.length).toBeGreaterThan(0) // Ensure API calls were made
  })

  test('bundle size should be reasonable', async ({ page }) => {
    const resourceSizes: { type: string; size: number; url: string }[] = []
    
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/_next/static/') || url.includes('.js') || url.includes('.css')) {
        const headers = response.headers()
        const contentLength = headers['content-length']
        
        if (contentLength) {
          resourceSizes.push({
            type: url.includes('.js') ? 'js' : url.includes('.css') ? 'css' : 'other',
            size: parseInt(contentLength),
            url
          })
        }
      }
    })
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    
    // Calculate totals
    const totalJS = resourceSizes.filter(r => r.type === 'js').reduce((sum, r) => sum + r.size, 0)
    const totalCSS = resourceSizes.filter(r => r.type === 'css').reduce((sum, r) => sum + r.size, 0)
    
    // Thresholds (in bytes)
    expect(totalJS).toBeLessThan(1024 * 1024) // < 1MB total JS
    expect(totalCSS).toBeLessThan(200 * 1024) // < 200KB total CSS
    
    // Individual file size limits
    resourceSizes.forEach(resource => {
      if (resource.type === 'js') {
        expect(resource.size).toBeLessThan(500 * 1024) // < 500KB per JS file
      }
    })
    
    console.log('Bundle Sizes:', {
      totalJS: `${Math.round(totalJS / 1024)}KB`,
      totalCSS: `${Math.round(totalCSS / 1024)}KB`,
      files: resourceSizes.length
    })
  })

  test('page should handle large datasets without performance degradation', async ({ page }) => {
    // Mock large dataset response
    await page.route('**/api/posts*', route => {
      const largePosts = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        text: `Post content ${i}`,
        status: 'published',
        platforms: ['twitter', 'facebook'],
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        author: { id: `user-${i}`, name: `User ${i}` }
      }))
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            posts: largePosts,
            pagination: { page: 1, limit: 100, total: 100, totalPages: 1 }
          }
        })
      })
    })
    
    const startTime = performance.now()
    await page.goto('/dashboard/posts', { waitUntil: 'networkidle' })
    const loadTime = performance.now() - startTime
    
    // Should handle 100 posts within reasonable time
    expect(loadTime).toBeLessThan(5000) // < 5s
    
    // Check if all posts are rendered
    const postElements = page.locator('[data-testid="post-item"]')
    const postCount = await postElements.count()
    expect(postCount).toBe(100)
    
    // Test scrolling performance
    const scrollStart = performance.now()
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    })
    await page.waitForTimeout(1000)
    const scrollTime = performance.now() - scrollStart
    
    expect(scrollTime).toBeLessThan(2000) // Smooth scrolling < 2s
  })

  test('memory usage should be stable', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      } : null
    })
    
    if (!initialMemory) {
      test.skip('Memory API not available')
    }
    
    // Navigate through different pages multiple times
    const pages = ['/dashboard/posts', '/dashboard/analytics', '/dashboard/calendar', '/dashboard']
    
    for (let i = 0; i < 5; i++) {
      for (const pagePath of pages) {
        await page.goto(pagePath, { waitUntil: 'networkidle' })
        await page.waitForTimeout(500)
      }
    }
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      }
    })
    
    // Memory should not increase by more than 50%
    const memoryIncrease = (finalMemory.used - initialMemory!.used) / initialMemory!.used
    expect(memoryIncrease).toBeLessThan(0.5) // < 50% increase
    
    console.log('Memory Usage:', {
      initial: `${Math.round(initialMemory!.used / 1024 / 1024)}MB`,
      final: `${Math.round(finalMemory.used / 1024 / 1024)}MB`,
      increase: `${Math.round(memoryIncrease * 100)}%`
    })
  })

  test('lighthouse performance audit', async ({ page }) => {
    // This would require lighthouse integration
    // For now, we'll do basic performance checks
    await page.goto('/dashboard')
    
    const performanceScore = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
      
      // Simple performance score calculation (0-100)
      let score = 100
      
      // Deduct points for slow metrics
      if (fcp && fcp.startTime > 1500) score -= 20
      if (navigation.loadEventEnd - navigation.loadEventStart > 3000) score -= 30
      if (navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart > 2000) score -= 20
      
      return Math.max(0, score)
    })
    
    expect(performanceScore).toBeGreaterThan(70) // Performance score > 70
    
    console.log(`Performance Score: ${performanceScore}/100`)
  })

  test('image optimization should be effective', async ({ page }) => {
    const imageRequests: { url: string; size: number; format: string }[] = []
    
    page.on('response', async response => {
      const url = response.url()
      const contentType = response.headers()['content-type'] || ''
      
      if (contentType.startsWith('image/')) {
        const headers = response.headers()
        const contentLength = headers['content-length']
        
        imageRequests.push({
          url,
          size: contentLength ? parseInt(contentLength) : 0,
          format: contentType
        })
      }
    })
    
    await page.goto('/', { waitUntil: 'networkidle' })
    
    // Check image optimization
    for (const image of imageRequests) {
      // Images should be reasonably sized
      expect(image.size).toBeLessThan(500 * 1024) // < 500KB per image
      
      // Should prefer modern formats
      const isModernFormat = ['image/webp', 'image/avif'].includes(image.format)
      const isOptimized = image.url.includes('_next/image') || isModernFormat
      
      if (!isOptimized) {
        console.warn(`Unoptimized image: ${image.url} (${image.format})`)
      }
    }
    
    console.log(`Image Analysis: ${imageRequests.length} images loaded`)
  })
})

test.describe('Load Testing', () => {
  test('concurrent user simulation', async ({ page, context }) => {
    // Simulate multiple concurrent operations
    const operations = [
      page.goto('/dashboard/posts'),
      page.goto('/dashboard/analytics'),
      page.goto('/dashboard/calendar'),
    ]
    
    const startTime = performance.now()
    await Promise.all(operations)
    const totalTime = performance.now() - startTime
    
    // All operations should complete within reasonable time
    expect(totalTime).toBeLessThan(10000) // < 10s for all operations
  })

  test('stress test with rapid navigation', async ({ page }) => {
    const routes = ['/dashboard', '/dashboard/posts', '/dashboard/analytics', '/dashboard/calendar']
    
    const startTime = performance.now()
    
    // Rapidly navigate between pages
    for (let i = 0; i < 10; i++) {
      const route = routes[i % routes.length]
      await page.goto(route, { waitUntil: 'domcontentloaded' })
    }
    
    const totalTime = performance.now() - startTime
    const averageTime = totalTime / 10
    
    expect(averageTime).toBeLessThan(2000) // < 2s average per navigation
    
    console.log(`Stress Test: ${10} navigations in ${Math.round(totalTime)}ms (${Math.round(averageTime)}ms avg)`)
  })
})