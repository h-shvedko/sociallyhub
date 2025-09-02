import { Job } from 'bullmq'
import { JobProcessor, JobResult } from '../queue-manager'
import { socialMediaManager, Platform } from '@/services/social-providers'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { notificationManager } from '@/lib/notifications/notification-manager'
import { NotificationType, NotificationPriority, NotificationCategory } from '@/lib/notifications/types'

export interface AnalyticsCollectionJobData {
  id: string
  type: 'analytics_collection' | 'post_analytics' | 'account_analytics' | 'engagement_analytics'
  payload: {
    userId: string
    workspaceId: string
    accounts: Array<{
      platform: Platform
      accountId: string
      lastSyncAt?: string
    }>
    dateRange: {
      start: string
      end: string
    }
    metrics: string[]
    options?: {
      includePostMetrics?: boolean
      includeAudienceMetrics?: boolean
      includeEngagementMetrics?: boolean
      syncInterval?: 'hourly' | 'daily' | 'weekly'
    }
  }
  userId: string
  workspaceId: string
}

export interface AnalyticsCollectionResult {
  userId: string
  workspaceId: string
  collectionId: string
  results: Array<{
    platform: Platform
    accountId: string
    success: boolean
    data?: {
      posts?: Array<{
        id: string
        metrics: {
          likes: number
          shares: number
          comments: number
          views: number
          engagementRate: number
        }
        publishedAt: string
      }>
      account?: {
        followers: number
        following: number
        postsCount: number
        engagementRate: number
        growthRate: number
      }
      engagement?: {
        totalLikes: number
        totalShares: number
        totalComments: number
        totalViews: number
        avgEngagementRate: number
        topPerformingPosts: string[]
      }
      audience?: {
        demographics: {
          ageGroups: Record<string, number>
          genders: Record<string, number>
          locations: Record<string, number>
        }
        interests: string[]
        activeHours: Record<string, number>
      }
    }
    error?: string
    syncedAt: string
  }>
  summary: {
    totalAccounts: number
    successfulAccounts: number
    failedAccounts: number
    totalMetrics: number
    duration: number
  }
}

export const analyticsCollectionProcessor: JobProcessor<AnalyticsCollectionJobData> = async (
  job: Job<AnalyticsCollectionJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { userId, workspaceId, accounts, dateRange, metrics, options } = payload

  const timer = PerformanceLogger.startTimer('analytics_collection_job')
  const collectionId = `collection_${Date.now()}_${userId}`
  
  try {
    BusinessLogger.logSystemEvent('analytics_collection_started', {
      collectionId,
      userId,
      workspaceId,
      accountsCount: accounts.length,
      dateRange,
      metrics
    })

    const results: AnalyticsCollectionResult['results'] = []
    let successfulAccounts = 0
    let failedAccounts = 0
    let totalMetrics = 0

    // Process each account
    for (const [index, account] of accounts.entries()) {
      const accountTimer = PerformanceLogger.startTimer(`analytics_${account.platform}_${account.accountId}`)
      
      try {
        // Update job progress
        await job.updateProgress(Math.round(((index + 1) / accounts.length) * 100))

        const accountResult: AnalyticsCollectionResult['results'][0] = {
          platform: account.platform,
          accountId: account.accountId,
          success: false,
          syncedAt: new Date().toISOString()
        }

        // Collect analytics data
        const analyticsData = await socialMediaManager.getAnalytics(
          account.platform,
          account.accountId,
          {
            startDate: new Date(dateRange.start),
            endDate: new Date(dateRange.end),
            metrics
          }
        )

        accountResult.data = {}
        let metricsCount = 0

        // Collect post metrics
        if (options?.includePostMetrics && analyticsData.posts) {
          accountResult.data.posts = analyticsData.posts.map(post => ({
            id: post.id,
            metrics: {
              likes: post.likes || 0,
              shares: post.shares || 0,
              comments: post.comments || 0,
              views: post.views || 0,
              engagementRate: post.engagementRate || 0
            },
            publishedAt: post.publishedAt
          }))
          metricsCount += analyticsData.posts.length
        }

        // Collect account metrics
        if (options?.includeAudienceMetrics && analyticsData.account) {
          accountResult.data.account = {
            followers: analyticsData.account.followersCount || 0,
            following: analyticsData.account.followingCount || 0,
            postsCount: analyticsData.account.postsCount || 0,
            engagementRate: analyticsData.account.avgEngagementRate || 0,
            growthRate: analyticsData.account.followerGrowthRate || 0
          }
          metricsCount += 5
        }

        // Collect engagement metrics
        if (options?.includeEngagementMetrics && analyticsData.engagement) {
          accountResult.data.engagement = {
            totalLikes: analyticsData.engagement.totalLikes || 0,
            totalShares: analyticsData.engagement.totalShares || 0,
            totalComments: analyticsData.engagement.totalComments || 0,
            totalViews: analyticsData.engagement.totalViews || 0,
            avgEngagementRate: analyticsData.engagement.avgEngagementRate || 0,
            topPerformingPosts: analyticsData.engagement.topPerformingPosts || []
          }
          metricsCount += 6
        }

        // Collect audience demographics
        if (analyticsData.demographics) {
          accountResult.data.audience = {
            demographics: analyticsData.demographics,
            interests: analyticsData.interests || [],
            activeHours: analyticsData.activeHours || {}
          }
          metricsCount += Object.keys(analyticsData.demographics).length
        }

        accountResult.success = true
        successfulAccounts++
        totalMetrics += metricsCount

        BusinessLogger.logSystemEvent('analytics_collected_platform', {
          collectionId,
          platform: account.platform,
          accountId: account.accountId,
          metricsCount,
          userId,
          workspaceId
        })

        accountTimer.end({ success: true, platform: account.platform, metricsCount })

        results.push(accountResult)

      } catch (error) {
        results.push({
          platform: account.platform,
          accountId: account.accountId,
          success: false,
          error: (error as Error).message,
          syncedAt: new Date().toISOString()
        })

        failedAccounts++

        ErrorLogger.logExternalServiceError(account.platform, error as Error, {
          operation: 'analytics_collection',
          collectionId,
          accountId: account.accountId,
          userId,
          workspaceId
        })

        accountTimer.end({ success: false, error: true, platform: account.platform })
      }
    }

    const finalResult: AnalyticsCollectionResult = {
      userId,
      workspaceId,
      collectionId,
      results,
      summary: {
        totalAccounts: accounts.length,
        successfulAccounts,
        failedAccounts,
        totalMetrics,
        duration: timer.getDuration()
      }
    }

    // Check for performance alerts
    await checkPerformanceAlerts(finalResult, userId, workspaceId)

    // Send completion notification
    await notificationManager.send({
      id: `analytics_collection_${collectionId}`,
      type: NotificationType.ANALYTICS_REPORT,
      title: 'Analytics Collection Complete',
      message: `Collected ${totalMetrics} metrics from ${successfulAccounts} account${successfulAccounts > 1 ? 's' : ''}`,
      userId,
      workspaceId,
      priority: failedAccounts > 0 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      category: NotificationCategory.ANALYTICS,
      actionUrl: `/dashboard/analytics?collection=${collectionId}`,
      actionLabel: 'View Report',
      metadata: {
        collectionId,
        totalAccounts: accounts.length,
        successfulAccounts,
        failedAccounts,
        totalMetrics
      },
      createdAt: new Date().toISOString()
    })

    timer.end({
      success: true,
      collectionId,
      successfulAccounts,
      failedAccounts,
      totalMetrics
    })

    BusinessLogger.logSystemEvent('analytics_collection_completed', {
      collectionId,
      userId,
      workspaceId,
      summary: finalResult.summary,
      duration: timer.getDuration()
    })

    return {
      success: true,
      result: finalResult,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    timer.end({ success: false, error: true, collectionId })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'analytics_collection_job',
      collectionId,
      userId,
      workspaceId,
      accountsCount: accounts.length
    })

    // Send error notification
    await notificationManager.send({
      id: `analytics_error_${collectionId}`,
      type: NotificationType.PERFORMANCE_ALERT,
      title: 'Analytics Collection Failed',
      message: `Failed to collect analytics: ${(error as Error).message}`,
      userId,
      workspaceId,
      priority: NotificationPriority.HIGH,
      category: NotificationCategory.ANALYTICS,
      actionUrl: `/dashboard/analytics`,
      actionLabel: 'Try Again',
      metadata: {
        collectionId,
        error: (error as Error).message,
        accountsCount: accounts.length
      },
      createdAt: new Date().toISOString()
    })

    return {
      success: false,
      error: (error as Error).message,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Helper function to check for performance alerts
async function checkPerformanceAlerts(
  result: AnalyticsCollectionResult,
  userId: string,
  workspaceId: string
): Promise<void> {
  try {
    for (const accountResult of result.results) {
      if (!accountResult.success || !accountResult.data) continue

      const { data, platform } = accountResult

      // Check engagement rate alerts
      if (data.account?.engagementRate !== undefined) {
        if (data.account.engagementRate < 1.0) { // Below 1% engagement rate
          await notificationManager.send({
            id: `low_engagement_${accountResult.accountId}_${Date.now()}`,
            type: NotificationType.PERFORMANCE_ALERT,
            title: 'Low Engagement Rate Alert',
            message: `Your ${platform} account has a low engagement rate of ${data.account.engagementRate.toFixed(2)}%`,
            userId,
            workspaceId,
            priority: NotificationPriority.HIGH,
            category: NotificationCategory.ANALYTICS,
            actionUrl: `/dashboard/analytics?account=${accountResult.accountId}`,
            actionLabel: 'View Details',
            metadata: {
              platform,
              accountId: accountResult.accountId,
              engagementRate: data.account.engagementRate,
              threshold: 1.0
            },
            createdAt: new Date().toISOString()
          })
        }
      }

      // Check follower growth alerts
      if (data.account?.growthRate !== undefined) {
        if (data.account.growthRate < -5.0) { // Losing more than 5% followers
          await notificationManager.send({
            id: `follower_decline_${accountResult.accountId}_${Date.now()}`,
            type: NotificationType.PERFORMANCE_ALERT,
            title: 'Follower Decline Alert',
            message: `Your ${platform} account is losing followers at ${Math.abs(data.account.growthRate).toFixed(2)}% rate`,
            userId,
            workspaceId,
            priority: NotificationPriority.HIGH,
            category: NotificationCategory.ANALYTICS,
            actionUrl: `/dashboard/analytics?account=${accountResult.accountId}`,
            actionLabel: 'Analyze Trends',
            metadata: {
              platform,
              accountId: accountResult.accountId,
              growthRate: data.account.growthRate,
              threshold: -5.0
            },
            createdAt: new Date().toISOString()
          })
        }
      }

      // Check for milestone achievements
      if (data.account?.followers !== undefined) {
        const milestones = [1000, 5000, 10000, 50000, 100000, 500000, 1000000]
        const currentFollowers = data.account.followers
        
        for (const milestone of milestones) {
          if (currentFollowers >= milestone && currentFollowers < milestone * 1.1) {
            await notificationManager.send({
              id: `milestone_${milestone}_${accountResult.accountId}`,
              type: NotificationType.GOAL_ACHIEVED,
              title: 'Milestone Achieved!',
              message: `🎉 Your ${platform} account reached ${milestone.toLocaleString()} followers!`,
              userId,
              workspaceId,
              priority: NotificationPriority.MEDIUM,
              category: NotificationCategory.ANALYTICS,
              actionUrl: `/dashboard/analytics?account=${accountResult.accountId}`,
              actionLabel: 'Celebrate',
              metadata: {
                platform,
                accountId: accountResult.accountId,
                milestone,
                currentFollowers
              },
              createdAt: new Date().toISOString()
            })
            break
          }
        }
      }
    }
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'performance_alerts_check',
      userId,
      workspaceId,
      collectionId: result.collectionId
    })
  }
}

// Scheduled analytics collection processor for regular syncing
export interface ScheduledAnalyticsJobData {
  id: string
  type: 'scheduled_analytics'
  payload: {
    userId: string
    workspaceId: string
    frequency: 'hourly' | 'daily' | 'weekly'
    accounts: Array<{
      platform: Platform
      accountId: string
    }>
  }
  userId: string
  workspaceId: string
}

export const scheduledAnalyticsProcessor: JobProcessor<ScheduledAnalyticsJobData> = async (
  job: Job<ScheduledAnalyticsJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { userId, workspaceId, frequency, accounts } = payload

  try {
    // Determine date range based on frequency
    const now = new Date()
    let startDate: Date

    switch (frequency) {
      case 'hourly':
        startDate = new Date(now.getTime() - 60 * 60 * 1000) // Last hour
        break
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
        break
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // Last week
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Create analytics collection job
    const analyticsJobData: AnalyticsCollectionJobData = {
      id: `scheduled_${frequency}_${Date.now()}`,
      type: 'analytics_collection',
      payload: {
        userId,
        workspaceId,
        accounts: accounts.map(acc => ({
          ...acc,
          lastSyncAt: new Date().toISOString()
        })),
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString()
        },
        metrics: ['likes', 'shares', 'comments', 'views', 'followers', 'engagement'],
        options: {
          includePostMetrics: true,
          includeAudienceMetrics: true,
          includeEngagementMetrics: true,
          syncInterval: frequency
        }
      },
      userId,
      workspaceId
    }

    // Process the analytics collection
    const result = await analyticsCollectionProcessor({
      ...job,
      data: analyticsJobData
    } as Job<AnalyticsCollectionJobData>)

    BusinessLogger.logSystemEvent('scheduled_analytics_completed', {
      userId,
      workspaceId,
      frequency,
      accountsCount: accounts.length,
      success: result.success
    })

    return result

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'scheduled_analytics_job',
      userId,
      workspaceId,
      frequency,
      accountsCount: accounts.length
    })

    return {
      success: false,
      error: (error as Error).message,
      metrics: {
        duration: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }
  }
}