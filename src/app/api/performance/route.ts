import { NextRequest, NextResponse } from 'next/server'
import { getPerformanceMonitor } from '@/lib/performance/performance-monitor'

// Performance metrics API endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const summary = searchParams.get('summary') === 'true'
    
    const performanceMonitor = getPerformanceMonitor()
    
    if (summary) {
      const data = await performanceMonitor.getPerformanceSummary()
      
      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        data
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
    
    if (format === 'prometheus') {
      const metrics = performanceMonitor.exportPrometheusMetrics()
      
      return new NextResponse(metrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }
    
    // Default JSON format
    const data = await performanceMonitor.getPerformanceSummary()
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      data
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    console.error('Performance metrics API error:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve performance metrics'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Record custom performance metric
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, value, unit = 'ms', tags = {}, type = 'gauge' } = body
    
    if (!name || typeof value !== 'number') {
      return NextResponse.json({
        status: 'error',
        error: 'Name and numeric value are required'
      }, { status: 400 })
    }
    
    const performanceMonitor = getPerformanceMonitor()
    performanceMonitor.recordMetric(name, value, unit, tags, type)
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      recorded: { name, value, unit, tags, type }
    })
    
  } catch (error) {
    console.error('Performance metric recording error:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to record performance metric'
    }, { status: 500 })
  }
}