import { BaseSocialMediaProvider } from './base-provider'
import { 
  Platform, 
  APIResponse, 
  SocialAccount, 
  PostOptions, 
  PublishedPost,
  UserProfile,
  MediaItem,
  AnalyticsData,
  ValidationError
} from './types'

interface TwitterConfig {
  clientId: string
  clientSecret: string
  apiKey: string
  apiSecret: string
  bearerToken: string
  baseURL?: string
}

interface TwitterUser {
  id: string
  username: string
  name: string
  description?: string
  profile_image_url?: string
  public_metrics?: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
  verified?: boolean
  url?: string
}

interface TwitterTweet {
  id: string
  text: string
  created_at: string
  author_id: string
  public_metrics?: {
    retweet_count: number
    like_count: number
    reply_count: number
    quote_count: number
    impression_count?: number
  }
  attachments?: {
    media_keys?: string[]
  }
  entities?: {
    hashtags?: Array<{ tag: string }>
    mentions?: Array<{ username: string }>
  }
  edit_history_tweet_ids?: string[]
}

interface TwitterMediaUpload {
  media_id_string: string
  media_id: number
  size: number
  expires_after_secs?: number
  media_key?: string
}

export class TwitterProvider extends BaseSocialMediaProvider {
  platform: Platform = 'twitter'
  name = 'Twitter/X'
  
  private clientId: string
  private clientSecret: string
  private apiKey: string
  private apiSecret: string
  private bearerToken: string
  
  constructor(config: TwitterConfig) {
    super(config)
    this.baseURL = config.baseURL || 'https://api.twitter.com/2'
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.apiKey = config.apiKey
    this.apiSecret = config.apiSecret
    this.bearerToken = config.bearerToken
  }
  
  getAuthUrl(redirectUri: string, scopes: string[] = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: this.generateState(),
      code_challenge_method: 'S256',
      code_challenge: this.generateCodeChallenge()
    })
    
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>> {
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: this.getStoredCodeVerifier() // In real implementation, retrieve from secure storage
    })
    
    try {
      const response = await this.makeRequest<{
        access_token: string
        refresh_token?: string
        expires_in?: number
        scope: string
      }>(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: body.toString()
      })
      
      if (!response.success || !response.data) {
        return response as APIResponse<SocialAccount>
      }
      
      // Get user profile to complete the account setup
      const tempAccount: SocialAccount = {
        id: '',
        platform: this.platform,
        platformId: '',
        username: '',
        displayName: '',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_in ? 
          new Date(Date.now() + response.data.expires_in * 1000) : undefined,
        isConnected: true,
        permissions: response.data.scope.split(' ')
      }
      
      const profileResponse = await this.getProfile(tempAccount)
      if (!profileResponse.success || !profileResponse.data) {
        return {
          success: false,
          error: {
            code: 'PROFILE_FETCH_FAILED',
            message: 'Failed to fetch user profile after authentication'
          }
        }
      }
      
      const profile = profileResponse.data
      const account: SocialAccount = {
        ...tempAccount,
        id: profile.id,
        platformId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatar: profile.avatar
      }
      
      return {
        success: true,
        data: account
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_FAILED',
          message: 'Failed to exchange authorization code for access token',
          details: error
        }
      }
    }
  }
  
  async refreshAccessToken(account: SocialAccount): Promise<APIResponse<SocialAccount>> {
    if (!account.refreshToken) {
      return {
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token available'
        }
      }
    }
    
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      client_id: this.clientId
    })
    
    try {
      const response = await this.makeRequest<{
        access_token: string
        refresh_token?: string
        expires_in?: number
      }>(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: body.toString()
      })
      
      if (!response.success || !response.data) {
        return response as APIResponse<SocialAccount>
      }
      
      const updatedAccount: SocialAccount = {
        ...account,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || account.refreshToken,
        expiresAt: response.data.expires_in ? 
          new Date(Date.now() + response.data.expires_in * 1000) : account.expiresAt
      }
      
      return {
        success: true,
        data: updatedAccount
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh access token',
          details: error
        }
      }
    }
  }
  
  async getProfile(account: SocialAccount): Promise<APIResponse<UserProfile>> {
    try {
      const response = await this.makeRequest<{
        data: TwitterUser
      }>('/users/me?user.fields=id,username,name,description,profile_image_url,public_metrics,verified,url', {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<UserProfile>
      }
      
      const user = response.data.data
      const profile: UserProfile = {
        id: user.id,
        username: user.username,
        displayName: user.name,
        bio: user.description,
        avatar: user.profile_image_url,
        followersCount: user.public_metrics?.followers_count || 0,
        followingCount: user.public_metrics?.following_count || 0,
        postsCount: user.public_metrics?.tweet_count || 0,
        verified: user.verified || false,
        url: user.url
      }
      
      return {
        success: true,
        data: profile,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
          details: error
        }
      }
    }
  }
  
  async createPost(account: SocialAccount, options: PostOptions): Promise<APIResponse<PublishedPost>> {
    // Validate post before sending
    const validation = await this.validatePost(options)
    if (!validation.success || !validation.data?.valid) {
      throw new ValidationError(
        this.platform,
        validation.data?.issues || ['Post validation failed']
      )
    }
    
    try {
      const tweetData: any = {
        text: options.text
      }
      
      // Handle media attachments
      if (options.media && options.media.length > 0) {
        const mediaIds = await this.uploadMultipleMedia(account, options.media)
        if (mediaIds.length > 0) {
          tweetData.media = { media_ids: mediaIds }
        }
      }
      
      // Handle location
      if (options.location?.coordinates) {
        tweetData.geo = {
          coordinates: [options.location.coordinates.longitude, options.location.coordinates.latitude]
        }
      }
      
      // Handle thread mode
      if (options.settings?.twitter?.threadMode && options.text.length > 280) {
        return this.createThread(account, options)
      }
      
      // Handle reply
      if (options.settings?.twitter?.replyToTweetId) {
        tweetData.reply = {
          in_reply_to_tweet_id: options.settings.twitter.replyToTweetId
        }
      }
      
      // Handle quote tweet
      if (options.settings?.twitter?.quoteTweetId) {
        tweetData.quote_tweet_id = options.settings.twitter.quoteTweetId
      }
      
      const response = await this.makeRequest<{
        data: TwitterTweet
      }>('/tweets', {
        method: 'POST',
        body: JSON.stringify(tweetData)
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<PublishedPost>
      }
      
      const tweet = response.data.data
      const publishedPost: PublishedPost = {
        id: tweet.id,
        platformPostId: tweet.id,
        platform: this.platform,
        url: `https://twitter.com/${account.username}/status/${tweet.id}`,
        createdAt: new Date(tweet.created_at),
        status: 'published'
      }
      
      return {
        success: true,
        data: publishedPost,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_CREATION_FAILED',
          message: 'Failed to create tweet',
          details: error
        }
      }
    }
  }
  
  async deletePost(account: SocialAccount, postId: string): Promise<APIResponse<boolean>> {
    try {
      const response = await this.makeRequest<{
        data: { deleted: boolean }
      }>(`/tweets/${postId}`, {
        method: 'DELETE'
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<boolean>
      }
      
      return {
        success: true,
        data: response.data.data.deleted,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_DELETION_FAILED',
          message: 'Failed to delete tweet',
          details: error
        }
      }
    }
  }
  
  async getPosts(account: SocialAccount, options?: {
    limit?: number
    cursor?: string
    since?: Date
    until?: Date
  }): Promise<APIResponse<PublishedPost[]>> {
    try {
      const params: Record<string, any> = {
        'user.fields': 'username',
        'tweet.fields': 'created_at,public_metrics,attachments,entities',
        max_results: Math.min(options?.limit || 10, 100)
      }
      
      if (options?.cursor) {
        params.pagination_token = options.cursor
      }
      
      if (options?.since) {
        params.start_time = options.since.toISOString()
      }
      
      if (options?.until) {
        params.end_time = options.until.toISOString()
      }
      
      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        data: TwitterTweet[]
        meta?: {
          next_token?: string
          result_count: number
        }
      }>(`/users/${account.platformId}/tweets?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<PublishedPost[]>
      }
      
      const posts: PublishedPost[] = response.data.data.map(tweet => ({
        id: tweet.id,
        platformPostId: tweet.id,
        platform: this.platform,
        url: `https://twitter.com/${account.username}/status/${tweet.id}`,
        createdAt: new Date(tweet.created_at),
        engagement: tweet.public_metrics ? {
          likes: tweet.public_metrics.like_count,
          shares: tweet.public_metrics.retweet_count + tweet.public_metrics.quote_count,
          comments: tweet.public_metrics.reply_count,
          views: tweet.public_metrics.impression_count
        } : undefined,
        status: 'published'
      }))
      
      return {
        success: true,
        data: posts,
        rateLimit: response.rateLimit,
        pagination: response.data.meta ? {
          nextCursor: response.data.meta.next_token,
          hasMore: !!response.data.meta.next_token,
          total: response.data.meta.result_count
        } : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POSTS_FETCH_FAILED',
          message: 'Failed to fetch tweets',
          details: error
        }
      }
    }
  }
  
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    try {
      // Twitter uses v1.1 API for media upload
      const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json'
      
      // For simplicity, we'll simulate the upload process
      // In a real implementation, you'd handle the actual file upload
      const mockMediaId = `mock_media_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      return {
        success: true,
        data: { mediaId: mockMediaId }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'Failed to upload media',
          details: error
        }
      }
    }
  }
  
  async getAnalytics(account: SocialAccount, options: {
    startDate: Date
    endDate: Date
    metrics?: string[]
  }): Promise<APIResponse<AnalyticsData>> {
    // Twitter Analytics API is quite limited and mostly requires special access
    // This is a mock implementation
    return {
      success: true,
      data: {
        period: {
          start: options.startDate,
          end: options.endDate
        },
        metrics: {
          impressions: Math.floor(Math.random() * 50000) + 10000,
          engagements: Math.floor(Math.random() * 5000) + 1000,
          likes: Math.floor(Math.random() * 3000) + 500,
          shares: Math.floor(Math.random() * 1000) + 100,
          comments: Math.floor(Math.random() * 500) + 50,
          views: Math.floor(Math.random() * 75000) + 15000,
          reach: Math.floor(Math.random() * 40000) + 8000
        },
        topPosts: [
          { id: 'tweet1', engagement: 450, impressions: 12000 },
          { id: 'tweet2', engagement: 380, impressions: 9500 },
          { id: 'tweet3', engagement: 290, impressions: 7800 }
        ]
      }
    }
  }
  
  // Twitter-specific methods
  private async createThread(account: SocialAccount, options: PostOptions): Promise<APIResponse<PublishedPost>> {
    const maxTweetLength = 280
    const text = options.text
    const tweets: string[] = []
    
    // Split text into tweet-sized chunks
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= maxTweetLength) {
        tweets.push(remaining)
        break
      }
      
      let splitIndex = maxTweetLength
      // Try to split at a word boundary
      const lastSpace = remaining.lastIndexOf(' ', maxTweetLength)
      if (lastSpace > maxTweetLength * 0.8) {
        splitIndex = lastSpace
      }
      
      tweets.push(remaining.substring(0, splitIndex))
      remaining = remaining.substring(splitIndex).trim()
    }
    
    // Post tweets in sequence
    let previousTweetId: string | undefined
    const postedTweets: string[] = []
    
    for (let i = 0; i < tweets.length; i++) {
      const tweetOptions: PostOptions = {
        text: tweets[i],
        settings: {
          twitter: {
            replyToTweetId: previousTweetId
          }
        }
      }
      
      // Add media only to the first tweet
      if (i === 0 && options.media) {
        tweetOptions.media = options.media
      }
      
      const result = await this.createPost(account, tweetOptions)
      if (!result.success || !result.data) {
        // If a tweet in the thread fails, we still return the successfully posted ones
        break
      }
      
      postedTweets.push(result.data.platformPostId)
      previousTweetId = result.data.platformPostId
    }
    
    if (postedTweets.length === 0) {
      return {
        success: false,
        error: {
          code: 'THREAD_CREATION_FAILED',
          message: 'Failed to create thread'
        }
      }
    }
    
    // Return the first tweet as the main post
    return {
      success: true,
      data: {
        id: postedTweets[0],
        platformPostId: postedTweets[0],
        platform: this.platform,
        url: `https://twitter.com/${account.username}/status/${postedTweets[0]}`,
        createdAt: new Date(),
        status: 'published'
      }
    }
  }
  
  private async uploadMultipleMedia(account: SocialAccount, mediaItems: MediaItem[]): Promise<string[]> {
    const mediaIds: string[] = []
    
    for (const media of mediaItems.slice(0, 4)) { // Twitter allows max 4 media items
      const uploadResult = await this.uploadMedia(account, media)
      if (uploadResult.success && uploadResult.data) {
        mediaIds.push(uploadResult.data.mediaId)
      }
    }
    
    return mediaIds
  }
  
  private generateCodeChallenge(): string {
    // In a real implementation, you'd generate a proper PKCE code challenge
    return 'mock_code_challenge'
  }
  
  private getStoredCodeVerifier(): string {
    // In a real implementation, you'd retrieve the stored code verifier
    return 'mock_code_verifier'
  }
  
  protected getMaxTextLength(): number {
    return 280
  }
  
  protected getMaxMediaCount(): number {
    return 4
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // Twitter-specific validation
    if (!options.text && (!options.media || options.media.length === 0)) {
      issues.push('Tweet must contain either text or media')
    }
    
    if (options.text && options.text.length > 280) {
      if (!options.settings?.twitter?.threadMode) {
        issues.push('Tweet exceeds 280 character limit. Consider enabling thread mode.')
      }
    }
    
    if (options.media && options.media.length > 4) {
      issues.push('Twitter allows maximum 4 media attachments per tweet')
    }
    
    // Check for mixed media types (Twitter doesn't allow mixing GIFs with other media)
    if (options.media && options.media.length > 1) {
      const hasGif = options.media.some(m => m.type === 'gif')
      if (hasGif) {
        issues.push('GIFs cannot be mixed with other media types on Twitter')
      }
    }
    
    return {
      success: true,
      data: {
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined
      }
    }
  }
}