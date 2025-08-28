import { getCacheManager } from '@/lib/cache/cache-manager'
import { getQueryOptimizer } from '@/lib/database/query-optimizer'
import { prisma } from '@/lib/prisma'

// Performance metrics collection
interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
}

interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta?: number
  id: string
}

interface WebVitals {
  FCP: number // First Contentful Paint
  LCP: number // Largest Contentful Paint  
  FID: number // First Input Delay
  CLS: number // Cumulative Layout Shift
  TTFB: number // Time to First Byte
  INP: number // Interaction to Next Paint
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private vitals: Map<string, VitalMetric> = new Map()
  private observers: Map<string, PerformanceObserver> = new Map()
  private cacheManager = getCacheManager(prisma)
  private queryOptimizer = getQueryOptimizer(prisma)

  constructor() {
    this.initializeObservers()
    this.startPeriodicCollection()
  }

  // Initialize performance observers
  private initializeObservers() {
    if (typeof window === 'undefined') return

    try {
      // Observe navigation and resource timing
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordNavigationMetrics(entry as PerformanceNavigationTiming)
        })
      })
      navObserver.observe({ entryTypes: ['navigation'] })
      this.observers.set('navigation', navObserver)

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordResourceMetrics(entry)
        })
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.set('resource', resourceObserver)

      // Observe paint timing
      const paintObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordPaintMetrics(entry)
        })
      })
      paintObserver.observe({ entryTypes: ['paint'] })
      this.observers.set('paint', paintObserver)

      // Observe layout shift
      if ('PerformanceObserver' in window && 'LayoutShift' in window) {
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              this.recordMetric('CLS', entry.value, 'score')
            }
          })
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.set('layout-shift', clsObserver)
      }

      // Observe long tasks
      if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric('long-task', entry.duration, 'ms', {
              name: entry.name,
              attribution: JSON.stringify(entry.attribution || {})
            })
          })
        })
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.set('longtask', longTaskObserver)
      }

      // Observe largest contentful paint
      if ('LargestContentfulPaint' in window) {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          this.recordVital('LCP', lastEntry.startTime)
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('lcp', lcpObserver)
      }

    } catch (error) {
      console.warn('Performance observer initialization failed:', error)
    }
  }

  // Record navigation metrics
  private recordNavigationMetrics(entry: PerformanceNavigationTiming) {
    const metrics = [
      { name: 'DNS-lookup', value: entry.domainLookupEnd - entry.domainLookupStart },
      { name: 'TCP-connection', value: entry.connectEnd - entry.connectStart },
      { name: 'TLS-handshake', value: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0 },
      { name: 'TTFB', value: entry.responseStart - entry.requestStart },
      { name: 'response-time', value: entry.responseEnd - entry.responseStart },
      { name: 'DOM-processing', value: entry.domComplete - entry.domLoading },
      { name: 'page-load', value: entry.loadEventEnd - entry.navigationStart }
    ]

    metrics.forEach(metric => {
      if (metric.value > 0) {
        this.recordMetric(metric.name, metric.value, 'ms')
        this.recordVital(metric.name.toUpperCase(), metric.value)
      }
    })
  }

  // Record resource metrics
  private recordResourceMetrics(entry: PerformanceEntry) {
    const resourceEntry = entry as PerformanceResourceTiming
    
    this.recordMetric('resource-load-time', entry.duration, 'ms', {
      type: resourceEntry.initiatorType,
      name: entry.name.split('/').pop() || entry.name
    })

    // Track slow resources
    if (entry.duration > 1000) {
      this.recordMetric('slow-resource', entry.duration, 'ms', {
        url: entry.name,
        type: resourceEntry.initiatorType
      })
    }
  }

  // Record paint metrics
  private recordPaintMetrics(entry: PerformanceEntry) {
    this.recordMetric(entry.name, entry.startTime, 'ms')
    
    if (entry.name === 'first-contentful-paint') {
      this.recordVital('FCP', entry.startTime)
    }
  }

  // Record Web Vitals
  recordVital(name: string, value: number, id?: string) {
    let rating: 'good' | 'needs-improvement' | 'poor' = 'good'
    
    // Determine rating based on Web Vitals thresholds
    switch (name) {
      case 'FCP':
        rating = value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
        break
      case 'LCP':
        rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
        break
      case 'FID':
        rating = value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor'
        break
      case 'CLS':
        rating = value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
        break
      case 'TTFB':
        rating = value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
        break
      case 'INP':
        rating = value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
        break
    }

    const vital: VitalMetric = {
      name,
      value,
      rating,
      id: id || `${name}-${Date.now()}`
    }

    this.vitals.set(name, vital)
    
    // Also record as regular metric
    this.recordMetric(`web-vital-${name.toLowerCase()}`, value, name === 'CLS' ? 'score' : 'ms')
  }

  // Record custom performance metric
  recordMetric(
    name: string, 
    value: number, 
    unit: string = 'ms',
    tags: Record<string, string> = {},
    type: PerformanceMetric['type'] = 'gauge'
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
      type
    }

    this.metrics.push(metric)

    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && value > 1000 && unit === 'ms') {
      console.warn(`[Performance] Slow ${name}: ${Math.round(value)}ms`)
    }
  }

  // Start timer for measuring operation duration
  startTimer(name: string, tags: Record<string, string> = {}) {
    const startTime = performance.now()
    
    return {
      end: (additionalTags: Record<string, string> = {}) => {
        const duration = performance.now() - startTime
        this.recordMetric(name, duration, 'ms', { ...tags, ...additionalTags }, 'timer')
        return duration
      }
    }
  }

  // Measure async operation performance
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const timer = this.startTimer(name, tags)
    try {
      const result = await operation()
      timer.end({ status: 'success' })
      return result
    } catch (error) {
      timer.end({ status: 'error' })
      throw error
    }
  }

  // Get system performance info
  async getSystemMetrics() {
    const metrics: Record<string, any> = {}

    try {
      // Browser API metrics
      if (typeof window !== 'undefined') {
        // Memory usage (if available)
        if ('memory' in performance) {
          const memInfo = (performance as any).memory
          metrics.memory = {
            used: memInfo.usedJSHeapSize,
            total: memInfo.totalJSHeapSize,
            limit: memInfo.jsHeapSizeLimit
          }
        }

        // Connection info
        if ('connection' in navigator) {
          const conn = (navigator as any).connection
          metrics.connection = {
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData
          }
        }

        // Device info
        metrics.device = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        }
      }

      // Server-side metrics (Node.js)
      if (typeof process !== 'undefined') {
        const memUsage = process.memoryUsage()
        const cpuUsage = process.cpuUsage()
        
        metrics.server = {
          memory: {
            rss: memUsage.rss,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: process.uptime(),
          version: process.version
        }
      }

      return metrics
    } catch (error) {
      console.error('System metrics collection failed:', error)
      return {}
    }
  }

  // Get application performance summary
  async getPerformanceSummary() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    
    // Filter recent metrics
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo)
    
    // Group metrics by name
    const groupedMetrics = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = []
      }
      acc[metric.name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>)

    // Calculate statistics
    const summary = Object.entries(groupedMetrics).map(([name, values]) => {
      const sorted = values.sort((a, b) => a - b)
      return {
        name,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      }
    })

    // Get Web Vitals
    const webVitals = Array.from(this.vitals.values())

    // Get system metrics
    const systemMetrics = await this.getSystemMetrics()

    // Get cache and database stats
    const cacheStats = await this.cacheManager.getStats()
    const queryStats = this.queryOptimizer.getQueryStats()

    return {
      timestamp: now,
      metrics: summary,
      webVitals,
      systemMetrics,
      cacheStats,
      queryStats,
      totalMetrics: this.metrics.length
    }
  }

  // Export metrics in Prometheus format
  exportPrometheusMetrics(): string {
    let output = ''

    // Group metrics by name and type
    const metricGroups = this.metrics.reduce((acc, metric) => {
      const key = `${metric.name}_${metric.type}`
      if (!acc[key]) {
        acc[key] = { type: metric.type, name: metric.name, metrics: [] }
      }
      acc[key].metrics.push(metric)
      return acc
    }, {} as Record<string, { type: string; name: string; metrics: PerformanceMetric[] }>)

    // Generate Prometheus format
    Object.values(metricGroups).forEach(group => {
      output += `# TYPE ${group.name} ${group.type}\n`
      
      group.metrics.forEach(metric => {
        const labels = metric.tags 
          ? Object.entries(metric.tags).map(([k, v]) => `${k}="${v}"`).join(',')
          : ''
        
        output += `${group.name}${labels ? `{${labels}}` : ''} ${metric.value}\n`
      })
    })

    return output
  }

  // Periodic metrics collection
  private startPeriodicCollection() {
    if (typeof window !== 'undefined') {
      setInterval(async () => {
        try {
          const systemMetrics = await this.getSystemMetrics()
          
          // Record memory usage if available
          if (systemMetrics.memory) {
            this.recordMetric('memory-used', systemMetrics.memory.used, 'bytes')
            this.recordMetric('memory-total', systemMetrics.memory.total, 'bytes')
          }

          // Record connection quality if available
          if (systemMetrics.connection) {
            this.recordMetric('connection-rtt', systemMetrics.connection.rtt, 'ms')
            this.recordMetric('connection-downlink', systemMetrics.connection.downlink, 'mbps')
          }
        } catch (error) {
          console.warn('Periodic metrics collection failed:', error)
        }
      }, 30000) // Every 30 seconds
    }
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
    this.metrics = []
    this.vitals.clear()
  }
}

// Global performance monitor instance
let performanceMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor()
  }
  return performanceMonitor
}

// React hook for Web Vitals
export function useWebVitals() {
  if (typeof window === 'undefined') return null
  
  const monitor = getPerformanceMonitor()
  
  // Initialize Web Vitals tracking
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
      onCLS((metric) => monitor.recordVital('CLS', metric.value, metric.id))
      onFID((metric) => monitor.recordVital('FID', metric.value, metric.id))
      onFCP((metric) => monitor.recordVital('FCP', metric.value, metric.id))
      onLCP((metric) => monitor.recordVital('LCP', metric.value, metric.id))
      onTTFB((metric) => monitor.recordVital('TTFB', metric.value, metric.id))
      onINP?.((metric) => monitor.recordVital('INP', metric.value, metric.id))
    }).catch(() => {
      console.warn('Web Vitals library not available')
    })
  }
  
  return monitor
}

export { PerformanceMonitor }
export default PerformanceMonitor