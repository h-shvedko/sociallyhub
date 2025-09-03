import { Job } from 'bullmq'
import { JobProcessor, JobResult } from '../queue-manager'
import { socialMediaManager, Platform } from '@/services/social-providers'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { notificationManager } from '@/lib/notifications/notification-manager'
import { NotificationType, NotificationPriority, NotificationCategory } from '@/lib/notifications/types'

export interface PostSchedulingJobData {
  id: string
  type: 'post_scheduling'
  payload: {
    postId: string
    content: {
      text: string
      media?: Array<{
        type: 'image' | 'video' | 'gif'
        url: string
        alt?: string
      }>
      links?: string[]
    }
    platforms: Platform[]
    platformSpecificSettings?: {
      [platform: string]: any
    }
    scheduledFor: string
    userId: string
    workspaceId: string
    accountIds: {
      [platform: string]: string
    }
  }
  userId: string
  workspaceId: string
  scheduledFor: string
}

export interface PostSchedulingResult {
  postId: string
  results: Array<{
    platform: Platform
    success: boolean
    platformPostId?: string
    error?: string
    metrics?: {
      likes: number
      shares: number
      comments: number
      views: number
    }
  }>
  totalPlatforms: number
  successfulPlatforms: number
  failedPlatforms: number
}

export const postSchedulingProcessor: JobProcessor<PostSchedulingJobData> = async (
  job: Job<PostSchedulingJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { postId, content, platforms, platformSpecificSettings, userId, workspaceId, accountIds } = payload

  const timer = PerformanceLogger.startTimer('post_scheduling_job')
  
  try {
    BusinessLogger.logPostCreated(postId, userId, platforms)

    const results: PostSchedulingResult['results'] = []
    let successfulPlatforms = 0
    let failedPlatforms = 0

    // Process each platform
    for (const platform of platforms) {
      const platformTimer = PerformanceLogger.startTimer(`post_scheduling_${platform}`)
      
      try {
        const accountId = accountIds[platform]
        if (!accountId) {
          throw new Error(`No account ID provided for platform: ${platform}`)
        }

        // Prepare platform-specific content
        const platformContent = {
          text: content.text,
          media: content.media || [],
          links: content.links || [],
          ...platformSpecificSettings?.[platform]
        }

        // Post to platform
        const postResult = await socialMediaManager.createPost(
          platform,
          accountId,
          platformContent
        )

        results.push({
          platform,
          success: true,
          platformPostId: postResult.id,
          metrics: postResult.metrics
        })

        successfulPlatforms++

        BusinessLogger.logSystemEvent('post_published_platform', {
          postId,
          platform,
          platformPostId: postResult.id,
          userId,
          workspaceId
        })

        platformTimer.end({ success: true, platform })

      } catch (error) {
        results.push({
          platform,
          success: false,
          error: (error as Error).message
        })

        failedPlatforms++

        ErrorLogger.logExternalServiceError(platform, error as Error, {
          operation: 'post_scheduling',
          postId,
          userId,
          workspaceId,
          accountId: accountIds[platform]
        })

        platformTimer.end({ success: false, error: true, platform })
      }
    }

    const finalResult: PostSchedulingResult = {
      postId,
      results,
      totalPlatforms: platforms.length,
      successfulPlatforms,
      failedPlatforms
    }

    // Send success/failure notifications
    if (successfulPlatforms > 0) {
      await notificationManager.send({
        id: `post_published_${postId}`,
        type: NotificationType.POST_PUBLISHED,
        title: 'Post Published Successfully',
        message: `Your post has been published to ${successfulPlatforms} platform${successfulPlatforms > 1 ? 's' : ''}`,
        userId,
        workspaceId,
        priority: NotificationPriority.MEDIUM,
        category: NotificationCategory.SOCIAL_MEDIA,
        actionUrl: `/dashboard/posts/${postId}`,
        actionLabel: 'View Post',
        metadata: {
          postId,
          platforms: platforms.filter((_, i) => results[i].success),
          successfulPlatforms,
          totalPlatforms: platforms.length
        },
        createdAt: new Date().toISOString()
      })
    }

    if (failedPlatforms > 0) {
      await notificationManager.send({
        id: `post_failed_${postId}`,
        type: NotificationType.POST_FAILED,
        title: 'Post Publishing Failed',
        message: `Failed to publish to ${failedPlatforms} platform${failedPlatforms > 1 ? 's' : ''}`,
        userId,
        workspaceId,
        priority: NotificationPriority.HIGH,
        category: NotificationCategory.SOCIAL_MEDIA,
        actionUrl: `/dashboard/posts/${postId}`,
        actionLabel: 'View Details',
        metadata: {
          postId,
          failedPlatforms: platforms.filter((_, i) => !results[i].success),
          failedPlatforms,
          totalPlatforms: platforms.length,
          errors: results.filter(r => !r.success).map(r => r.error)
        },
        createdAt: new Date().toISOString()
      })
    }

    timer.end({
      success: true,
      postId,
      successfulPlatforms,
      failedPlatforms,
      totalPlatforms: platforms.length
    })

    BusinessLogger.logSystemEvent('post_scheduling_completed', {
      postId,
      userId,
      workspaceId,
      platforms,
      successfulPlatforms,
      failedPlatforms,
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
    timer.end({ success: false, error: true, postId })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'post_scheduling_job',
      postId,
      userId,
      workspaceId,
      platforms
    })

    // Send error notification
    await notificationManager.send({
      id: `post_error_${postId}`,
      type: NotificationType.POST_FAILED,
      title: 'Post Scheduling Error',
      message: `An error occurred while scheduling your post: ${(error as Error).message}`,
      userId,
      workspaceId,
      priority: NotificationPriority.HIGH,
      category: NotificationCategory.SOCIAL_MEDIA,
      actionUrl: `/dashboard/posts/${postId}`,
      actionLabel: 'Try Again',
      metadata: {
        postId,
        error: (error as Error).message,
        platforms
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

// Bulk post scheduling processor
export interface BulkPostSchedulingJobData {
  id: string
  type: 'bulk_post_scheduling'
  payload: {
    posts: Array<{
      postId: string
      content: {
        text: string
        media?: Array<{
          type: 'image' | 'video' | 'gif'
          url: string
          alt?: string
        }>
      }
      platforms: Platform[]
      scheduledFor: string
      accountIds: {
        [platform: string]: string
      }
    }>
    userId: string
    workspaceId: string
    batchId: string
  }
  userId: string
  workspaceId: string
}

export const bulkPostSchedulingProcessor: JobProcessor<BulkPostSchedulingJobData> = async (
  job: Job<BulkPostSchedulingJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { posts, userId, workspaceId, batchId } = payload

  const timer = PerformanceLogger.startTimer('bulk_post_scheduling_job')

  try {
    const results = []
    let totalPosts = posts.length
    let successfulPosts = 0
    let failedPosts = 0

    for (const [index, post] of posts.entries()) {
      try {
        // Update job progress
        await job.updateProgress(Math.round(((index + 1) / totalPosts) * 100))

        // Create individual post scheduling job
        const postJobData: PostSchedulingJobData = {
          id: `post_${post.postId}`,
          type: 'post_scheduling',
          payload: {
            postId: post.postId,
            content: post.content,
            platforms: post.platforms,
            scheduledFor: post.scheduledFor,
            userId,
            workspaceId,
            accountIds: post.accountIds
          },
          userId,
          workspaceId,
          scheduledFor: post.scheduledFor
        }

        // Process the post (could also queue it for later processing)
        const postResult = await postSchedulingProcessor({
          ...job,
          data: postJobData
        } as Job<PostSchedulingJobData>)

        results.push({
          postId: post.postId,
          success: postResult.success,
          result: postResult.result,
          error: postResult.error
        })

        if (postResult.success) {
          successfulPosts++
        } else {
          failedPosts++
        }

      } catch (error) {
        results.push({
          postId: post.postId,
          success: false,
          error: (error as Error).message
        })
        failedPosts++
      }
    }

    // Send batch completion notification
    await notificationManager.send({
      id: `bulk_post_completed_${batchId}`,
      type: NotificationType.POST_PUBLISHED,
      title: 'Bulk Post Scheduling Completed',
      message: `${successfulPosts} of ${totalPosts} posts scheduled successfully`,
      userId,
      workspaceId,
      priority: failedPosts > 0 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      category: NotificationCategory.SOCIAL_MEDIA,
      actionUrl: `/dashboard/posts?batch=${batchId}`,
      actionLabel: 'View Results',
      metadata: {
        batchId,
        totalPosts,
        successfulPosts,
        failedPosts
      },
      createdAt: new Date().toISOString()
    })

    timer.end({
      success: true,
      batchId,
      totalPosts,
      successfulPosts,
      failedPosts
    })

    return {
      success: true,
      result: {
        batchId,
        totalPosts,
        successfulPosts,
        failedPosts,
        results
      },
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    timer.end({ success: false, error: true, batchId })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'bulk_post_scheduling_job',
      batchId,
      userId,
      workspaceId,
      totalPosts: posts.length
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