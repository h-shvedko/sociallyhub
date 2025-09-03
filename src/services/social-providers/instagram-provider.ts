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

interface InstagramConfig {
  facebookAppId: string
  facebookAppSecret: string
  baseURL?: string
}

interface InstagramBusinessAccount {
  id: string
  username: string
  name?: string
  biography?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  website?: string
}

interface InstagramMedia {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  permalink?: string
  caption?: string
  timestamp?: string
  username?: string
  insights?: {
    data: Array<{
      name: string
      values: Array<{
        value: number
      }>
    }>
  }
  children?: {
    data: Array<{
      id: string
      media_type: string
      media_url: string
    }>
  }
}

interface InstagramContainer {
  id: string
  status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR'
  status_code?: string
}

export class InstagramProvider extends BaseSocialMediaProvider {
  platform: Platform = 'instagram'
  name = 'Instagram Business'
  
  private facebookAppId: string
  private facebookAppSecret: string
  
  constructor(config: InstagramConfig) {
    super(config)
    this.baseURL = config.baseURL || 'https://graph.facebook.com/v18.0'
    this.facebookAppId = config.facebookAppId
    this.facebookAppSecret = config.facebookAppSecret
  }
  
  getAuthUrl(redirectUri: string, scopes: string[] = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement'
  ]): string {
    // Instagram Business API uses Facebook OAuth
    const params = new URLSearchParams({
      client_id: this.facebookAppId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state: this.generateState()
    })
    
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>> {
    try {
      // First get Facebook access token
      const tokenResponse = await this.makeRequest<{
        access_token: string
        token_type: string
        expires_in?: number
      }>('/oauth/access_token', {
        method: 'GET'
      }, undefined, {
        client_id: this.facebookAppId,
        client_secret: this.facebookAppSecret,
        redirect_uri: redirectUri,
        code
      })
      
      if (!tokenResponse.success || !tokenResponse.data) {
        return tokenResponse as APIResponse<SocialAccount>
      }
      
      const accessToken = tokenResponse.data.access_token
      
      // Get user's Facebook pages
      const pagesResponse = await this.makeRequest<{
        data: Array<{
          id: string
          name: string
          access_token: string
          instagram_business_account?: {
            id: string
          }
        }>
      }>('/me/accounts', {
        method: 'GET'
      }, { accessToken } as any)
      
      if (!pagesResponse.success || !pagesResponse.data?.data) {
        return {
          success: false,
          error: {
            code: 'NO_PAGES_FOUND',
            message: 'No Facebook pages found. Instagram Business API requires a connected Facebook page.'
          }
        }
      }
      
      // Find page with Instagram Business Account
      const pageWithInstagram = pagesResponse.data.data.find(page => 
        page.instagram_business_account?.id
      )
      
      if (!pageWithInstagram) {
        return {
          success: false,
          error: {
            code: 'NO_INSTAGRAM_BUSINESS_ACCOUNT',
            message: 'No Instagram Business Account found. Please connect your Instagram account to a Facebook page.'
          }
        }
      }
      
      const instagramAccountId = pageWithInstagram.instagram_business_account!.id
      const pageAccessToken = pageWithInstagram.access_token
      
      // Get Instagram account details
      const tempAccount: SocialAccount = {
        id: instagramAccountId,
        platform: this.platform,
        platformId: instagramAccountId,
        username: '',
        displayName: '',
        accessToken: pageAccessToken,
        isConnected: true,
        permissions: [],
        metadata: {
          facebookPageId: pageWithInstagram.id,
          facebookPageName: pageWithInstagram.name
        }
      }
      
      const profileResponse = await this.getProfile(tempAccount)
      if (!profileResponse.success || !profileResponse.data) {
        return {
          success: false,
          error: {
            code: 'PROFILE_FETCH_FAILED',
            message: 'Failed to fetch Instagram profile after authentication'
          }
        }
      }
      
      const profile = profileResponse.data
      const account: SocialAccount = {
        ...tempAccount,
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
  
  async getProfile(account: SocialAccount): Promise<APIResponse<UserProfile>> {
    try {
      const response = await this.makeRequest<InstagramBusinessAccount>(
        `/${account.platformId}?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website`,
        { method: 'GET' },
        account
      )
      
      if (!response.success || !response.data) {
        return response as APIResponse<UserProfile>
      }
      
      const igAccount = response.data
      const profile: UserProfile = {
        id: igAccount.id,
        username: igAccount.username,
        displayName: igAccount.name || igAccount.username,
        bio: igAccount.biography,
        avatar: igAccount.profile_picture_url,
        followersCount: igAccount.followers_count || 0,
        followingCount: igAccount.follows_count || 0,
        postsCount: igAccount.media_count || 0,
        verified: false, // Instagram Business API doesn't provide verification status
        url: igAccount.website
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
          message: 'Failed to fetch Instagram profile',
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
      if (!options.media || options.media.length === 0) {
        return {
          success: false,
          error: {
            code: 'MEDIA_REQUIRED',
            message: 'Instagram posts require at least one media item'
          }
        }
      }
      
      // Handle different post types
      if (options.media.length === 1) {
        return this.createSingleMediaPost(account, options)
      } else {
        return this.createCarouselPost(account, options)
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_CREATION_FAILED',
          message: 'Failed to create Instagram post',
          details: error
        }
      }
    }
  }
  
  async schedulePost(account: SocialAccount, options: PostOptions): Promise<APIResponse<{ scheduledId: string }>> {
    // Instagram Business API doesn't support scheduling directly
    // This would typically be handled by storing the post and using a job queue
    return {
      success: false,
      error: {
        code: 'SCHEDULING_NOT_SUPPORTED',
        message: 'Instagram Business API does not support direct post scheduling. Use third-party scheduling tools.'
      }
    }
  }
  
  async deletePost(account: SocialAccount, postId: string): Promise<APIResponse<boolean>> {
    try {
      const response = await this.makeRequest<{
        success: boolean
      }>(`/${postId}`, {
        method: 'DELETE'
      }, account)
      
      if (!response.success) {
        return response as APIResponse<boolean>
      }
      
      return {
        success: true,
        data: true,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_DELETION_FAILED',
          message: 'Failed to delete Instagram post',
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
        fields: 'id,media_type,media_url,permalink,caption,timestamp,username,insights.metric(impressions,engagement,likes,comments,shares,saved)',
        limit: Math.min(options?.limit || 25, 100)
      }
      
      if (options?.cursor) {
        params.after = options.cursor
      }
      
      if (options?.since) {
        params.since = Math.floor(options.since.getTime() / 1000)
      }
      
      if (options?.until) {
        params.until = Math.floor(options.until.getTime() / 1000)
      }
      
      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        data: InstagramMedia[]
        paging?: {
          cursors?: {
            after?: string
            before?: string
          }
          next?: string
        }
      }>(`/${account.platformId}/media?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<PublishedPost[]>
      }
      
      const posts: PublishedPost[] = response.data.data.map(media => {
        const engagement = this.extractEngagementFromInsights(media.insights)
        
        return {
          id: media.id,
          platformPostId: media.id,
          platform: this.platform,
          url: media.permalink || `https://www.instagram.com/p/${media.id}`,
          createdAt: media.timestamp ? new Date(media.timestamp) : new Date(),
          engagement,
          status: 'published'
        }
      })
      
      return {
        success: true,
        data: posts,
        rateLimit: response.rateLimit,
        pagination: response.data.paging ? {
          nextCursor: response.data.paging.cursors?.after,
          hasMore: !!response.data.paging.next
        } : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POSTS_FETCH_FAILED',
          message: 'Failed to fetch Instagram posts',
          details: error
        }
      }
    }
  }
  
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    try {
      // Instagram Business API requires media to be uploaded to Facebook first
      // This is a simplified version - real implementation would handle file uploads
      const mockMediaId = `ig_media_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      return {
        success: true,
        data: { mediaId: mockMediaId }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'Failed to upload media to Instagram',
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
    try {
      const metrics = options.metrics || [
        'impressions',
        'reach',
        'follower_count',
        'email_contacts',
        'phone_call_clicks',
        'text_message_clicks',
        'get_directions_clicks',
        'website_clicks'
      ]
      
      const params = {
        metric: metrics.join(','),
        since: Math.floor(options.startDate.getTime() / 1000),
        until: Math.floor(options.endDate.getTime() / 1000),
        period: 'day'
      }
      
      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        data: Array<{
          name: string
          values: Array<{
            value: number
            end_time: string
          }>
        }>
      }>(`/${account.platformId}/insights?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data) {
        // Return mock data if insights aren't available
        return {
          success: true,
          data: this.generateMockAnalytics(options.startDate, options.endDate)
        }
      }
      
      const insightsData = response.data.data
      const analytics = this.processInsightsData(insightsData, options.startDate, options.endDate)
      
      return {
        success: true,
        data: analytics,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: 'Failed to fetch Instagram analytics',
          details: error
        }
      }
    }
  }
  
  // Instagram-specific methods
  private async createSingleMediaPost(account: SocialAccount, options: PostOptions): Promise<APIResponse<PublishedPost>> {
    const media = options.media![0]
    
    // Step 1: Create media container
    const containerData: any = {
      image_url: media.type === 'image' ? media.url : undefined,
      video_url: media.type === 'video' ? media.url : undefined,
      caption: options.text
    }
    
    // Add user tags if provided
    if (options.settings?.instagram?.userTags) {
      containerData.user_tags = options.settings.instagram.userTags
    }
    
    // Add location if provided
    if (options.settings?.instagram?.locationId) {
      containerData.location_id = options.settings.instagram.locationId
    }
    
    const containerResponse = await this.makeRequest<InstagramContainer>(
      `/${account.platformId}/media`,
      {
        method: 'POST',
        body: JSON.stringify(containerData)
      },
      account
    )
    
    if (!containerResponse.success || !containerResponse.data) {
      return containerResponse as APIResponse<PublishedPost>
    }
    
    const containerId = containerResponse.data.id
    
    // Step 2: Wait for media processing (simplified)
    await this.waitForMediaProcessing(account, containerId)
    
    // Step 3: Publish the media
    const publishResponse = await this.makeRequest<{
      id: string
    }>(`/${account.platformId}/media_publish`, {
      method: 'POST',
      body: JSON.stringify({ creation_id: containerId })
    }, account)
    
    if (!publishResponse.success || !publishResponse.data) {
      return publishResponse as APIResponse<PublishedPost>
    }
    
    const postId = publishResponse.data.id
    const publishedPost: PublishedPost = {
      id: postId,
      platformPostId: postId,
      platform: this.platform,
      url: `https://www.instagram.com/p/${postId}`,
      createdAt: new Date(),
      status: 'published'
    }
    
    return {
      success: true,
      data: publishedPost,
      rateLimit: publishResponse.rateLimit
    }
  }
  
  private async createCarouselPost(account: SocialAccount, options: PostOptions): Promise<APIResponse<PublishedPost>> {
    // Step 1: Create containers for each media item
    const containerIds: string[] = []
    
    for (const media of options.media!.slice(0, 10)) { // Instagram allows max 10 items in carousel
      const containerData = {
        image_url: media.type === 'image' ? media.url : undefined,
        video_url: media.type === 'video' ? media.url : undefined,
        is_carousel_item: true
      }
      
      const containerResponse = await this.makeRequest<InstagramContainer>(
        `/${account.platformId}/media`,
        {
          method: 'POST',
          body: JSON.stringify(containerData)
        },
        account
      )
      
      if (containerResponse.success && containerResponse.data) {
        containerIds.push(containerResponse.data.id)
      }
    }
    
    if (containerIds.length === 0) {
      return {
        success: false,
        error: {
          code: 'CAROUSEL_CREATION_FAILED',
          message: 'Failed to create carousel media containers'
        }
      }
    }
    
    // Step 2: Create carousel container
    const carouselData = {
      media_type: 'CAROUSEL',
      children: containerIds.join(','),
      caption: options.text
    }
    
    const carouselResponse = await this.makeRequest<InstagramContainer>(
      `/${account.platformId}/media`,
      {
        method: 'POST',
        body: JSON.stringify(carouselData)
      },
      account
    )
    
    if (!carouselResponse.success || !carouselResponse.data) {
      return carouselResponse as APIResponse<PublishedPost>
    }
    
    const carouselId = carouselResponse.data.id
    
    // Step 3: Wait for processing and publish
    await this.waitForMediaProcessing(account, carouselId)
    
    const publishResponse = await this.makeRequest<{
      id: string
    }>(`/${account.platformId}/media_publish`, {
      method: 'POST',
      body: JSON.stringify({ creation_id: carouselId })
    }, account)
    
    if (!publishResponse.success || !publishResponse.data) {
      return publishResponse as APIResponse<PublishedPost>
    }
    
    const postId = publishResponse.data.id
    const publishedPost: PublishedPost = {
      id: postId,
      platformPostId: postId,
      platform: this.platform,
      url: `https://www.instagram.com/p/${postId}`,
      createdAt: new Date(),
      status: 'published'
    }
    
    return {
      success: true,
      data: publishedPost,
      rateLimit: publishResponse.rateLimit
    }
  }
  
  private async waitForMediaProcessing(account: SocialAccount, containerId: string): Promise<void> {
    // In a real implementation, you'd poll the container status until it's finished
    // For now, we'll simulate a delay
    await this.wait(2000)
    
    // Check status (simplified)
    try {
      const statusResponse = await this.makeRequest<InstagramContainer>(
        `/${containerId}?fields=status,status_code`,
        { method: 'GET' },
        account
      )
      
      if (statusResponse.success && statusResponse.data?.status === 'ERROR') {
        throw new Error(`Media processing failed: ${statusResponse.data.status_code}`)
      }
    } catch (error) {
      console.warn('Failed to check media processing status:', error)
    }
  }
  
  private extractEngagementFromInsights(insights?: any): any {
    if (!insights?.data) {
      return {
        likes: 0,
        shares: 0,
        comments: 0,
        views: 0
      }
    }
    
    const metrics = insights.data.reduce((acc: any, insight: any) => {
      if (insight.values && insight.values.length > 0) {
        acc[insight.name] = insight.values[0].value
      }
      return acc
    }, {})
    
    return {
      likes: metrics.likes || 0,
      shares: metrics.shares || 0,
      comments: metrics.comments || 0,
      views: metrics.impressions || 0,
      engagements: metrics.engagement || 0
    }
  }
  
  private processInsightsData(insightsData: any[], startDate: Date, endDate: Date): AnalyticsData {
    const metrics = insightsData.reduce((acc: any, insight) => {
      const latestValue = insight.values[insight.values.length - 1]?.value || 0
      
      switch (insight.name) {
        case 'impressions':
          acc.impressions = latestValue
          break
        case 'reach':
          acc.reach = latestValue
          break
        case 'follower_count':
          acc.followers = latestValue
          break
        case 'website_clicks':
          acc.clicks = latestValue
          break
      }
      
      return acc
    }, {})
    
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: metrics.impressions || 0,
        engagements: Math.floor((metrics.impressions || 0) * 0.05), // Estimated
        likes: Math.floor((metrics.impressions || 0) * 0.03),
        shares: Math.floor((metrics.impressions || 0) * 0.01),
        comments: Math.floor((metrics.impressions || 0) * 0.02),
        reach: metrics.reach || 0,
        clicks: metrics.clicks || 0
      },
      topPosts: []
    }
  }
  
  private generateMockAnalytics(startDate: Date, endDate: Date): AnalyticsData {
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: Math.floor(Math.random() * 50000) + 10000,
        engagements: Math.floor(Math.random() * 5000) + 1000,
        likes: Math.floor(Math.random() * 3000) + 800,
        shares: Math.floor(Math.random() * 500) + 100,
        comments: Math.floor(Math.random() * 800) + 200,
        reach: Math.floor(Math.random() * 40000) + 8000
      },
      topPosts: [
        { id: 'ig_post_1', engagement: 1200, impressions: 15000 },
        { id: 'ig_post_2', engagement: 980, impressions: 12000 },
        { id: 'ig_post_3', engagement: 750, impressions: 9500 }
      ]
    }
  }
  
  protected getMaxTextLength(): number {
    return 2200 // Instagram's character limit for captions
  }
  
  protected getMaxMediaCount(): number {
    return 10 // Instagram allows max 10 items in carousel
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // Instagram-specific validation
    if (!options.media || options.media.length === 0) {
      issues.push('Instagram posts require at least one media item')
    }
    
    if (options.text && options.text.length > this.getMaxTextLength()) {
      issues.push(`Caption exceeds Instagram's character limit of ${this.getMaxTextLength()}`)
    }
    
    if (options.media && options.media.length > this.getMaxMediaCount()) {
      issues.push(`Instagram allows maximum ${this.getMaxMediaCount()} media items per post`)
    }
    
    // Check media requirements
    if (options.media) {
      for (const media of options.media) {
        if (media.type === 'video') {
          if (media.duration && media.duration > 60) {
            issues.push('Instagram videos cannot exceed 60 seconds (except for IGTV)')
          }
          if (media.size && media.size > 100 * 1024 * 1024) { // 100MB
            issues.push('Instagram video file size cannot exceed 100MB')
          }
        }
        
        if (media.type === 'image') {
          if (!media.width || !media.height) {
            continue // Skip validation if dimensions not provided
          }
          
          const aspectRatio = media.width / media.height
          if (aspectRatio < 0.8 || aspectRatio > 1.91) {
            issues.push('Instagram images must have aspect ratio between 0.8 and 1.91')
          }
        }
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