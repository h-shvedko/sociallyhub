import { TwitterProvider } from './twitter-provider'
import { FacebookProvider } from './facebook-provider'
import { InstagramProvider } from './instagram-provider'
import { LinkedInProvider } from './linkedin-provider'
import { TikTokProvider } from './tiktok-provider'
import { YouTubeProvider } from './youtube-provider'
import {
  SocialMediaProvider,
  Platform,
  SocialAccount,
  PostOptions,
  PublishedPost,
  UserProfile,
  AnalyticsData,
  APIResponse,
  SocialMediaError,
  MediaItem
} from './types'

export interface BulkPostOptions extends PostOptions {
  platforms: Platform[]
  platformSpecificSettings?: {
    [key in Platform]?: Partial<PostOptions>
  }
}

export interface BulkPostResult {
  platform: Platform
  success: boolean
  result?: PublishedPost
  error?: string
}

export interface CrossPlatformAnalytics {
  totalEngagement: number
  totalReach: number
  totalImpressions: number
  platformBreakdown: {
    [key in Platform]?: {
      engagement: number
      reach: number
      impressions: number
      followers: number
    }
  }
  topPerformingPlatforms: Array<{
    platform: Platform
    engagementRate: number
    reach: number
  }>
  timeSeriesData: Array<{
    date: string
    metrics: {
      [key in Platform]?: {
        engagement: number
        reach: number
        impressions: number
      }
    }
  }>
}

export interface AccountStatus {
  platform: Platform
  connected: boolean
  lastSync: Date | null
  status: 'active' | 'inactive' | 'error' | 'rate_limited'
  error?: string
  rateLimitReset?: Date
}

export class SocialMediaManager {
  private providers: Map<Platform, SocialMediaProvider>
  private accounts: Map<string, SocialAccount>

  constructor() {
    this.providers = new Map()
    this.accounts = new Map()

    // Initialize all providers
    this.providers.set(Platform.TWITTER, new TwitterProvider())
    this.providers.set(Platform.FACEBOOK, new FacebookProvider())
    this.providers.set(Platform.INSTAGRAM, new InstagramProvider())
    this.providers.set(Platform.LINKEDIN, new LinkedInProvider())
    this.providers.set(Platform.TIKTOK, new TikTokProvider())
    this.providers.set(Platform.YOUTUBE, new YouTubeProvider())
  }

  // Provider Management
  getProvider(platform: Platform): SocialMediaProvider {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new SocialMediaError(`Provider for ${platform} not found`, 'PROVIDER_NOT_FOUND')
    }
    return provider
  }

  getSupportedPlatforms(): Platform[] {
    return Array.from(this.providers.keys())
  }

  // Account Management
  addAccount(account: SocialAccount): void {
    const key = `${account.platform}_${account.accountId}`
    this.accounts.set(key, account)
  }

  removeAccount(platform: Platform, accountId: string): void {
    const key = `${platform}_${accountId}`
    this.accounts.delete(key)
  }

  getAccount(platform: Platform, accountId: string): SocialAccount | null {
    const key = `${platform}_${accountId}`
    return this.accounts.get(key) || null
  }

  getAccountsByPlatform(platform: Platform): SocialAccount[] {
    return Array.from(this.accounts.values()).filter(
      account => account.platform === platform
    )
  }

  getAllAccounts(): SocialAccount[] {
    return Array.from(this.accounts.values())
  }

  // Authentication
  async getAuthUrl(platform: Platform, redirectUri: string, scopes?: string[]): Promise<string> {
    const provider = this.getProvider(platform)
    return provider.getAuthUrl(redirectUri, scopes)
  }

  async exchangeCodeForToken(
    platform: Platform, 
    code: string, 
    redirectUri: string
  ): Promise<APIResponse<SocialAccount>> {
    const provider = this.getProvider(platform)
    const result = await provider.exchangeCodeForToken(code, redirectUri)
    
    if (result.success && result.data) {
      this.addAccount(result.data)
    }
    
    return result
  }

  // Single Platform Operations
  async createPost(
    platform: Platform, 
    accountId: string, 
    options: PostOptions
  ): Promise<APIResponse<PublishedPost>> {
    const provider = this.getProvider(platform)
    const account = this.getAccount(platform, accountId)
    
    if (!account) {
      return {
        success: false,
        error: `Account not found for ${platform}:${accountId}`,
        errorCode: 'ACCOUNT_NOT_FOUND'
      }
    }

    return provider.createPost(account, options)
  }

  async getUserProfile(
    platform: Platform, 
    accountId: string
  ): Promise<APIResponse<UserProfile>> {
    const provider = this.getProvider(platform)
    const account = this.getAccount(platform, accountId)
    
    if (!account) {
      return {
        success: false,
        error: `Account not found for ${platform}:${accountId}`,
        errorCode: 'ACCOUNT_NOT_FOUND'
      }
    }

    return provider.getUserProfile(account)
  }

  async getAnalytics(
    platform: Platform, 
    accountId: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<APIResponse<AnalyticsData>> {
    const provider = this.getProvider(platform)
    const account = this.getAccount(platform, accountId)
    
    if (!account) {
      return {
        success: false,
        error: `Account not found for ${platform}:${accountId}`,
        errorCode: 'ACCOUNT_NOT_FOUND'
      }
    }

    return provider.getAnalytics(account, dateRange)
  }

  // Cross-Platform Operations
  async bulkPost(options: BulkPostOptions): Promise<BulkPostResult[]> {
    const results: BulkPostResult[] = []
    const promises: Promise<void>[] = []

    for (const platform of options.platforms) {
      const promise = (async () => {
        try {
          const accounts = this.getAccountsByPlatform(platform)
          if (accounts.length === 0) {
            results.push({
              platform,
              success: false,
              error: `No accounts connected for ${platform}`
            })
            return
          }

          // Use the first available account for each platform
          const account = accounts[0]
          
          // Merge platform-specific settings
          const platformOptions: PostOptions = {
            ...options,
            ...options.platformSpecificSettings?.[platform]
          }

          const result = await this.getProvider(platform).createPost(account, platformOptions)
          
          if (result.success && result.data) {
            results.push({
              platform,
              success: true,
              result: result.data
            })
          } else {
            results.push({
              platform,
              success: false,
              error: result.error || 'Unknown error'
            })
          }
        } catch (error) {
          results.push({
            platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })()

      promises.push(promise)
    }

    await Promise.all(promises)
    return results
  }

  async getCrossPlatformAnalytics(
    accountIds: Array<{ platform: Platform; accountId: string }>,
    dateRange?: { start: Date; end: Date }
  ): Promise<APIResponse<CrossPlatformAnalytics>> {
    try {
      const analyticsPromises = accountIds.map(async ({ platform, accountId }) => {
        const result = await this.getAnalytics(platform, accountId, dateRange)
        return {
          platform,
          data: result.success ? result.data : null,
          error: result.error
        }
      })

      const analyticsResults = await Promise.all(analyticsPromises)
      
      // Aggregate data across platforms
      const crossPlatformData: CrossPlatformAnalytics = {
        totalEngagement: 0,
        totalReach: 0,
        totalImpressions: 0,
        platformBreakdown: {},
        topPerformingPlatforms: [],
        timeSeriesData: []
      }

      const platformMetrics: Array<{ platform: Platform; engagement: number; reach: number }> = []

      for (const result of analyticsResults) {
        if (result.data) {
          const { platform, data } = result
          
          crossPlatformData.totalEngagement += data.totalEngagement
          crossPlatformData.totalReach += data.totalReach
          crossPlatformData.totalImpressions += data.totalImpressions

          crossPlatformData.platformBreakdown[platform] = {
            engagement: data.totalEngagement,
            reach: data.totalReach,
            impressions: data.totalImpressions,
            followers: data.followerGrowth
          }

          platformMetrics.push({
            platform,
            engagement: data.totalEngagement,
            reach: data.totalReach
          })
        }
      }

      // Calculate top performing platforms
      crossPlatformData.topPerformingPlatforms = platformMetrics
        .sort((a, b) => {
          const aRate = a.reach > 0 ? a.engagement / a.reach : 0
          const bRate = b.reach > 0 ? b.engagement / b.reach : 0
          return bRate - aRate
        })
        .map(metric => ({
          platform: metric.platform,
          engagementRate: metric.reach > 0 ? metric.engagement / metric.reach : 0,
          reach: metric.reach
        }))

      return {
        success: true,
        data: crossPlatformData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cross-platform analytics',
        errorCode: 'ANALYTICS_ERROR'
      }
    }
  }

  // Account Health Monitoring
  async checkAccountStatuses(): Promise<AccountStatus[]> {
    const statuses: AccountStatus[] = []
    const accounts = this.getAllAccounts()

    const promises = accounts.map(async (account) => {
      try {
        const provider = this.getProvider(account.platform)
        const profileResult = await provider.getUserProfile(account)
        
        const status: AccountStatus = {
          platform: account.platform,
          connected: profileResult.success,
          lastSync: new Date(),
          status: profileResult.success ? 'active' : 'error',
          error: profileResult.error
        }

        if (!profileResult.success && profileResult.errorCode === 'RATE_LIMITED') {
          status.status = 'rate_limited'
          // Estimate rate limit reset (typically 15 minutes for most platforms)
          status.rateLimitReset = new Date(Date.now() + 15 * 60 * 1000)
        }

        return status
      } catch (error) {
        return {
          platform: account.platform,
          connected: false,
          lastSync: null,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const results = await Promise.all(promises)
    statuses.push(...results)

    return statuses
  }

  // Validation
  async validatePostForPlatforms(
    platforms: Platform[], 
    options: PostOptions
  ): Promise<{ [key in Platform]?: { valid: boolean; issues?: string[] } }> {
    const validationResults: { [key in Platform]?: { valid: boolean; issues?: string[] } } = {}

    const promises = platforms.map(async (platform) => {
      try {
        const provider = this.getProvider(platform)
        const result = await provider.validatePost(options)
        validationResults[platform] = result.success ? result.data : { valid: false, issues: [result.error || 'Validation failed'] }
      } catch (error) {
        validationResults[platform] = {
          valid: false,
          issues: [error instanceof Error ? error.message : 'Validation error']
        }
      }
    })

    await Promise.all(promises)
    return validationResults
  }

  // Media Management
  async uploadMedia(
    platform: Platform, 
    accountId: string, 
    media: MediaItem
  ): Promise<APIResponse<any>> {
    const provider = this.getProvider(platform)
    const account = this.getAccount(platform, accountId)
    
    if (!account) {
      return {
        success: false,
        error: `Account not found for ${platform}:${accountId}`,
        errorCode: 'ACCOUNT_NOT_FOUND'
      }
    }

    return provider.uploadMedia(account, media)
  }

  // Utility Methods
  getConnectedPlatforms(): Platform[] {
    const connectedPlatforms = new Set<Platform>()
    this.getAllAccounts().forEach(account => {
      connectedPlatforms.add(account.platform)
    })
    return Array.from(connectedPlatforms)
  }

  getAccountCount(): number {
    return this.accounts.size
  }

  getAccountCountByPlatform(): { [key in Platform]?: number } {
    const counts: { [key in Platform]?: number } = {}
    this.getAllAccounts().forEach(account => {
      counts[account.platform] = (counts[account.platform] || 0) + 1
    })
    return counts
  }
}

// Singleton instance for global use
export const socialMediaManager = new SocialMediaManager()