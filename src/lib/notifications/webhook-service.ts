import axios, { AxiosRequestConfig } from 'axios'
import { WebhookNotificationData } from './types'
import { ErrorLogger, PerformanceLogger, BusinessLogger } from '@/lib/middleware/logging'

export interface WebhookServiceConfig {
  timeout: number
  maxRetries: number
  retryDelay: number
  maxConcurrentRequests: number
}

export class WebhookService {
  private config: WebhookServiceConfig
  private activeRequests = 0

  constructor() {
    this.config = {
      timeout: 10000, // 10 seconds
      maxRetries: 3,
      retryDelay: 2000,
      maxConcurrentRequests: 10
    }
  }

  async send(webhookData: WebhookNotificationData): Promise<void> {
    // Rate limiting
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      await this.waitForSlot()
    }

    this.activeRequests++
    const timer = PerformanceLogger.startTimer('send_webhook')

    try {
      let retryCount = 0
      const maxRetries = webhookData.retries ?? this.config.maxRetries

      while (retryCount <= maxRetries) {
        try {
          const requestConfig: AxiosRequestConfig = {
            method: webhookData.method,
            url: webhookData.url,
            data: webhookData.payload,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'SociallyHub-Webhook/1.0',
              ...webhookData.headers
            },
            timeout: webhookData.timeout || this.config.timeout,
            validateStatus: (status) => status < 400
          }

          const response = await axios(requestConfig)

          BusinessLogger.logNotificationEvent(
            'webhook_sent',
            'system',
            {
              url: this.maskUrl(webhookData.url),
              method: webhookData.method,
              status: response.status,
              retryCount,
              responseTime: timer.getDuration()
            }
          )

          timer.end({
            success: true,
            status: response.status,
            retryCount
          })

          return

        } catch (error: any) {
          retryCount++

          const isRetryable = this.isRetryableError(error)

          if (retryCount > maxRetries || !isRetryable) {
            timer.end({
              success: false,
              error: true,
              status: error.response?.status,
              retryCount: retryCount - 1
            })

            ErrorLogger.logExternalServiceError(
              'webhook',
              error,
              {
                operation: 'send_webhook',
                url: this.maskUrl(webhookData.url),
                method: webhookData.method,
                status: error.response?.status,
                retryCount: retryCount - 1,
                isRetryable
              }
            )

            throw error
          }

          // Wait before retrying with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, retryCount - 1)
          await this.delay(delay)
        }
      }

    } finally {
      this.activeRequests--
    }
  }

  async sendBulk(webhooks: WebhookNotificationData[]): Promise<void> {
    const timer = PerformanceLogger.startTimer('send_bulk_webhooks')

    try {
      const promises = webhooks.map(webhook => this.send(webhook))
      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      BusinessLogger.logNotificationEvent(
        'bulk_webhooks_sent',
        'system',
        {
          total: webhooks.length,
          successful,
          failed
        }
      )

      timer.end({
        total: webhooks.length,
        successful,
        failed
      })

      // Log failed webhooks
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          ErrorLogger.logExternalServiceError(
            'webhook',
            result.reason,
            {
              operation: 'bulk_webhook_failed',
              webhookIndex: index,
              url: this.maskUrl(webhooks[index]?.url)
            }
          )
        }
      })

    } catch (error) {
      timer.end({ error: true })
      throw error
    }
  }

  async testWebhook(url: string): Promise<{
    success: boolean
    status?: number
    responseTime: number
    error?: string
  }> {
    const timer = PerformanceLogger.startTimer('test_webhook')
    
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Test webhook from SociallyHub'
      }

      const response = await axios.post(url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SociallyHub-Webhook-Test/1.0',
          'X-Webhook-Test': 'true'
        },
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500 // Accept 4xx as success for testing
      })

      const responseTime = timer.getDuration()
      timer.end({ success: true, status: response.status })

      BusinessLogger.logNotificationEvent(
        'webhook_test',
        'system',
        {
          url: this.maskUrl(url),
          status: response.status,
          responseTime
        }
      )

      return {
        success: response.status < 400,
        status: response.status,
        responseTime
      }

    } catch (error: any) {
      const responseTime = timer.getDuration()
      timer.end({ success: false, error: true })

      ErrorLogger.logExternalServiceError(
        'webhook',
        error,
        {
          operation: 'test_webhook',
          url: this.maskUrl(url),
          status: error.response?.status
        }
      )

      return {
        success: false,
        status: error.response?.status,
        responseTime,
        error: error.message
      }
    }
  }

  // Utility methods
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true
    }

    // HTTP status codes that are retryable
    const retryableStatuses = [408, 429, 500, 502, 503, 504]
    return error.response && retryableStatuses.includes(error.response.status)
  }

  private async waitForSlot(): Promise<void> {
    while (this.activeRequests >= this.config.maxConcurrentRequests) {
      await this.delay(100)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private maskUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
    } catch {
      // If URL parsing fails, just show the first part
      return url.length > 50 ? url.substring(0, 47) + '...' : url
    }
  }

  getConfig(): WebhookServiceConfig {
    return { ...this.config }
  }

  getStats(): {
    activeRequests: number
    maxConcurrentRequests: number
    utilizationPercentage: number
  } {
    return {
      activeRequests: this.activeRequests,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      utilizationPercentage: Math.round((this.activeRequests / this.config.maxConcurrentRequests) * 100)
    }
  }

  // Webhook validation utilities
  static validateWebhookPayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a valid object')
    }

    if (JSON.stringify(payload).length > 1024 * 1024) { // 1MB limit
      errors.push('Payload size exceeds 1MB limit')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  static generateWebhookSignature(payload: string, secret: string): string {
    const crypto = require('crypto')
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
  }

  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateWebhookSignature(payload, secret)
    const crypto = require('crypto')
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  // Webhook event types for SociallyHub
  static createPostPublishedPayload(postId: string, platform: string, userId: string): any {
    return {
      event: 'post.published',
      data: {
        postId,
        platform,
        userId,
        timestamp: new Date().toISOString()
      }
    }
  }

  static createTeamInvitationPayload(invitationId: string, workspaceId: string, inviterUserId: string): any {
    return {
      event: 'team.invitation_sent',
      data: {
        invitationId,
        workspaceId,
        inviterUserId,
        timestamp: new Date().toISOString()
      }
    }
  }

  static createApprovalRequestPayload(approvalId: string, postId: string, requesterId: string): any {
    return {
      event: 'content.approval_requested',
      data: {
        approvalId,
        postId,
        requesterId,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Singleton instance for global use
export const webhookService = new WebhookService()