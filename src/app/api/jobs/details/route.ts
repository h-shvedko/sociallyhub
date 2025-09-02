import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/jobs/queue-manager'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queue = searchParams.get('queue')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Mock job details for demonstration
    // In a real implementation, you would fetch from BullMQ
    const mockJobs = [
      {
        id: 'job_1',
        name: 'post_scheduling',
        queueName: 'post-scheduling',
        status: 'completed' as const,
        progress: 100,
        data: {
          postId: 'post_123',
          platforms: ['twitter', 'facebook'],
          userId: 'user_123'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        processedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        finishedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        attempts: 1,
        maxAttempts: 3,
        priority: 0,
        duration: 2340
      },
      {
        id: 'job_2',
        name: 'analytics_collection',
        queueName: 'analytics-collection',
        status: 'active' as const,
        progress: 67,
        data: {
          userId: 'user_456',
          accounts: ['twitter_account', 'instagram_account']
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        processedAt: new Date(Date.now() - 1000 * 60).toISOString(),
        attempts: 1,
        maxAttempts: 3,
        priority: 0
      },
      {
        id: 'job_3',
        name: 'notification_dispatch',
        queueName: 'notification-dispatch',
        status: 'failed' as const,
        progress: 0,
        data: {
          notificationId: 'notif_789',
          userId: 'user_789',
          channels: ['email', 'push']
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        processedAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        failedReason: 'SMTP connection failed',
        attempts: 3,
        maxAttempts: 3,
        priority: 1
      },
      {
        id: 'job_4',
        name: 'bulk_post_scheduling',
        queueName: 'post-scheduling',
        status: 'waiting' as const,
        progress: 0,
        data: {
          batchId: 'batch_456',
          postsCount: 15,
          userId: 'user_234'
        },
        createdAt: new Date(Date.now() - 1000 * 30).toISOString(),
        attempts: 0,
        maxAttempts: 3,
        priority: 0,
        delay: 1000 * 60 * 5 // 5 minutes delay
      },
      {
        id: 'job_5',
        name: 'scheduled_analytics',
        queueName: 'analytics-collection',
        status: 'delayed' as const,
        progress: 0,
        data: {
          frequency: 'daily',
          userId: 'user_567',
          accountsCount: 8
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        attempts: 0,
        maxAttempts: 2,
        priority: -5,
        delay: 1000 * 60 * 60 * 24 // 24 hours delay
      }
    ]

    let filteredJobs = mockJobs

    // Apply filters
    if (queue && queue !== 'all') {
      filteredJobs = filteredJobs.filter(job => job.queueName === queue)
    }

    if (status && status !== 'all') {
      filteredJobs = filteredJobs.filter(job => job.status === status)
    }

    if (search) {
      const searchTerm = search.toLowerCase()
      filteredJobs = filteredJobs.filter(job => 
        job.name.toLowerCase().includes(searchTerm) ||
        job.id.toLowerCase().includes(searchTerm)
      )
    }

    // Apply pagination
    const paginatedJobs = filteredJobs.slice(offset, offset + limit)

    BusinessLogger.logSystemEvent('job_details_requested', {
      filters: { queue, status, search },
      totalJobs: filteredJobs.length,
      returnedJobs: paginatedJobs.length,
      userAgent: request.headers.get('user-agent')
    })

    return NextResponse.json(paginatedJobs)

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'job_details_api',
      operation: 'get_details'
    })

    return NextResponse.json(
      { error: 'Failed to fetch job details' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'job-details')