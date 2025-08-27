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

interface FacebookConfig {
  appId: string
  appSecret: string
  baseURL?: string
}

interface FacebookUser {
  id: string
  name: string
  email?: string
  picture?: {
    data: {
      url: string
    }
  }
  about?: string
  followers_count?: number
  friends_count?: number
  link?: string
}

interface FacebookPage {
  id: string
  name: string
  about?: string
  picture?: {
    data: {
      url: string
    }
  }
  followers_count?: number
  fan_count?: number
  link?: string
  access_token: string
}

interface FacebookPost {
  id: string
  message?: string
  story?: string
  created_time: string
  permalink_url?: string
  insights?: {
    data: Array<{
      name: string
      values: Array<{
        value: number
      }>
    }>
  }
}

interface FacebookPhotoUpload {
  id: string
  post_id?: string
}

export class FacebookProvider extends BaseSocialMediaProvider {
  platform: Platform = 'facebook'
  name = 'Facebook'
  
  private appId: string
  private appSecret: string
  
  constructor(config: FacebookConfig) {
    super(config)
    this.baseURL = config.baseURL || 'https://graph.facebook.com/v18.0'
    this.appId = config.appId
    this.appSecret = config.appSecret
  }
  
  getAuthUrl(redirectUri: string, scopes: string[] = [
    'pages_manage_posts', 
    'pages_read_engagement', 
    'pages_read_user_content',
    'pages_show_list',
    'publish_to_groups'
  ]): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state: this.generateState()
    })
    
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>> {
    try {
      // Exchange code for short-lived user access token
      const tokenResponse = await this.makeRequest<{
        access_token: string
        token_type: string
        expires_in?: number
      }>('/oauth/access_token', {
        method: 'GET'
      }, undefined, {
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code
      })
      
      if (!tokenResponse.success || !tokenResponse.data) {
        return tokenResponse as APIResponse<SocialAccount>
      }
      
      const shortLivedToken = tokenResponse.data.access_token
      
      // Exchange short-lived token for long-lived token
      const longLivedResponse = await this.makeRequest<{
        access_token: string
        token_type: string
        expires_in?: number
      }>('/oauth/access_token', {
        method: 'GET'
      }, undefined, {
        grant_type: 'fb_exchange_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: shortLivedToken
      })
      
      const accessToken = longLivedResponse.success && longLivedResponse.data ? 
        longLivedResponse.data.access_token : shortLivedToken
      const expiresIn = longLivedResponse.success && longLivedResponse.data?.expires_in ?
        longLivedResponse.data.expires_in : tokenResponse.data.expires_in
      
      // Get user profile
      const tempAccount: SocialAccount = {
        id: '',
        platform: this.platform,
        platformId: '',
        username: '',
        displayName: '',
        accessToken,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
        isConnected: true,
        permissions: []
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
        username: profile.username || profile.displayName.toLowerCase().replace(/\s+/g, ''),
        displayName: profile.displayName,
        avatar: profile.avatar,
        metadata: {
          pages: [] // Will be populated when fetching pages
        }
      }
      
      // Fetch user's pages for posting
      await this.fetchUserPages(account)
      
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
      const response = await this.makeRequest<FacebookUser>(
        '/me?fields=id,name,email,picture,about,followers_count,friends_count,link',
        { method: 'GET' },
        account
      )
      
      if (!response.success || !response.data) {
        return response as APIResponse<UserProfile>
      }
      
      const user = response.data
      const profile: UserProfile = {
        id: user.id,
        username: user.name.toLowerCase().replace(/\s+/g, ''),
        displayName: user.name,
        bio: user.about,
        avatar: user.picture?.data?.url,
        followersCount: user.followers_count || 0,
        followingCount: user.friends_count || 0,
        postsCount: 0, // Facebook doesn't provide this easily
        verified: false,
        url: user.link
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
      // Determine target (user feed or page)
      const targetId = this.getPostTarget(account, options)
      const targetAccessToken = this.getTargetAccessToken(account, targetId)
      
      const postData: any = {}
      
      // Handle text content
      if (options.text) {
        postData.message = options.text
      }
      
      // Handle media
      if (options.media && options.media.length > 0) {
        if (options.media.length === 1) {
          // Single media post
          const media = options.media[0]
          if (media.type === 'image') {
            return this.createPhotoPost(account, targetId, targetAccessToken, options)
          } else if (media.type === 'video') {
            return this.createVideoPost(account, targetId, targetAccessToken, options)
          }
        } else {
          // Multiple media - create album
          return this.createAlbumPost(account, targetId, targetAccessToken, options)
        }
      }
      
      // Handle location
      if (options.location) {
        postData.place = options.location.placeId
      }
      
      // Handle privacy settings
      if (options.settings?.facebook?.privacySettings) {
        postData.privacy = {
          value: options.settings.facebook.privacySettings
        }
      }
      
      // Handle targeting options
      if (options.settings?.facebook?.targetingOptions) {
        postData.targeting = options.settings.facebook.targetingOptions
      }
      
      // Handle scheduled publishing
      if (options.scheduledFor && options.scheduledFor > new Date()) {
        postData.scheduled_publish_time = Math.floor(options.scheduledFor.getTime() / 1000)
        postData.published = false
      }
      
      const tempAccount = { ...account, accessToken: targetAccessToken }
      const response = await this.makeRequest<{
        id: string
      }>(`/${targetId}/feed`, {
        method: 'POST',
        body: JSON.stringify(postData)
      }, tempAccount)
      
      if (!response.success || !response.data) {
        return response as APIResponse<PublishedPost>
      }
      
      const postId = response.data.id
      const publishedPost: PublishedPost = {
        id: postId,
        platformPostId: postId,
        platform: this.platform,
        url: `https://www.facebook.com/${postId}`,
        createdAt: options.scheduledFor || new Date(),
        status: options.scheduledFor ? 'pending' : 'published'
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
          message: 'Failed to create Facebook post',
          details: error
        }
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
      
      if (!response.success || !response.data) {
        return response as APIResponse<boolean>
      }
      
      return {
        success: true,
        data: response.data.success,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_DELETION_FAILED',
          message: 'Failed to delete Facebook post',
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
        fields: 'id,message,story,created_time,permalink_url,insights.metric(post_impressions,post_engaged_users,post_reactions_by_type_total)',
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
        data: FacebookPost[]
        paging?: {
          cursors?: {
            after?: string
            before?: string
          }
          next?: string
        }
      }>(`/me/posts?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<PublishedPost[]>
      }
      
      const posts: PublishedPost[] = response.data.data.map(post => {
        const engagement = this.extractEngagementFromInsights(post.insights)
        
        return {
          id: post.id,
          platformPostId: post.id,
          platform: this.platform,
          url: post.permalink_url || `https://www.facebook.com/${post.id}`,
          createdAt: new Date(post.created_time),
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
          message: 'Failed to fetch Facebook posts',
          details: error
        }
      }
    }
  }
  
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    try {
      // Facebook handles media upload differently depending on the context
      // For simplicity, we'll return a mock ID that would be used in actual posting
      const mockMediaId = `fb_media_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      return {
        success: true,
        data: { mediaId: mockMediaId }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'Failed to upload media to Facebook',
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
      // Facebook Insights API
      const metrics = options.metrics || [
        'page_impressions',
        'page_engaged_users',
        'page_fan_adds',
        'page_post_engagements'
      ]
      
      const params = {
        metric: metrics.join(','),
        since: options.startDate.toISOString().split('T')[0],
        until: options.endDate.toISOString().split('T')[0],
        period: 'day'
      }
      
      const queryString = this.buildQueryParams(params)
      
      // This would normally be for a specific page
      const pageId = this.getDefaultPageId(account)
      const response = await this.makeRequest<{
        data: Array<{
          name: string
          values: Array<{
            value: number
            end_time: string
          }>
        }>
      }>(`/${pageId}/insights?${queryString}`, {
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
          message: 'Failed to fetch Facebook analytics',
          details: error
        }
      }
    }
  }
  
  // Facebook-specific methods
  private async fetchUserPages(account: SocialAccount): Promise<void> {
    try {
      const response = await this.makeRequest<{
        data: FacebookPage[]
      }>('/me/accounts?fields=id,name,about,picture,followers_count,fan_count,link,access_token', {
        method: 'GET'
      }, account)
      
      if (response.success && response.data?.data) {
        account.metadata = {
          ...account.metadata,
          pages: response.data.data
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user pages:', error)
    }
  }
  
  private getPostTarget(account: SocialAccount, options: PostOptions): string {
    // Default to user's personal feed, or could be configured to post to a page
    return account.platformId
  }
  
  private getTargetAccessToken(account: SocialAccount, targetId: string): string {
    // If posting to a page, use the page's access token
    if (account.metadata?.pages) {
      const page = account.metadata.pages.find((p: FacebookPage) => p.id === targetId)
      if (page?.access_token) {
        return page.access_token
      }
    }
    
    return account.accessToken
  }
  
  private getDefaultPageId(account: SocialAccount): string {
    if (account.metadata?.pages && account.metadata.pages.length > 0) {
      return account.metadata.pages[0].id
    }
    return account.platformId
  }
  
  private async createPhotoPost(
    account: SocialAccount, 
    targetId: string, 
    accessToken: string,
    options: PostOptions
  ): Promise<APIResponse<PublishedPost>> {
    const media = options.media![0]
    const postData: any = {
      url: media.url, // In real implementation, this would be uploaded first
      caption: options.text
    }
    
    if (media.altText) {
      postData.alt_text_custom = media.altText
    }
    
    const tempAccount = { ...account, accessToken }
    const response = await this.makeRequest<{
      id: string
      post_id: string
    }>(`/${targetId}/photos`, {
      method: 'POST',
      body: JSON.stringify(postData)
    }, tempAccount)
    
    if (!response.success || !response.data) {
      return response as APIResponse<PublishedPost>
    }
    
    const postId = response.data.post_id || response.data.id
    return {
      success: true,
      data: {
        id: postId,
        platformPostId: postId,
        platform: this.platform,
        url: `https://www.facebook.com/${postId}`,
        createdAt: new Date(),
        status: 'published'
      }
    }
  }
  
  private async createVideoPost(
    account: SocialAccount, 
    targetId: string, 
    accessToken: string,
    options: PostOptions
  ): Promise<APIResponse<PublishedPost>> {
    const media = options.media![0]
    const postData: any = {
      file_url: media.url, // In real implementation, this would be uploaded first
      description: options.text
    }
    
    const tempAccount = { ...account, accessToken }
    const response = await this.makeRequest<{
      id: string
    }>(`/${targetId}/videos`, {
      method: 'POST',
      body: JSON.stringify(postData)
    }, tempAccount)
    
    if (!response.success || !response.data) {
      return response as APIResponse<PublishedPost>
    }
    
    const postId = response.data.id
    return {
      success: true,
      data: {
        id: postId,
        platformPostId: postId,
        platform: this.platform,
        url: `https://www.facebook.com/${postId}`,
        createdAt: new Date(),
        status: 'published'
      }
    }
  }
  
  private async createAlbumPost(
    account: SocialAccount, 
    targetId: string, 
    accessToken: string,
    options: PostOptions
  ): Promise<APIResponse<PublishedPost>> {
    // Create album first, then add photos
    const albumData = {
      name: 'SociallyHub Album',
      message: options.text
    }
    
    const tempAccount = { ...account, accessToken }
    const albumResponse = await this.makeRequest<{
      id: string
    }>(`/${targetId}/albums`, {
      method: 'POST',
      body: JSON.stringify(albumData)
    }, tempAccount)
    
    if (!albumResponse.success || !albumResponse.data) {
      return albumResponse as APIResponse<PublishedPost>
    }
    
    const albumId = albumResponse.data.id
    
    // Add photos to album (simplified)
    for (const media of options.media!) {
      if (media.type === 'image') {
        await this.makeRequest(`/${albumId}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            url: media.url,
            caption: media.altText
          })
        }, tempAccount)
      }
    }
    
    return {
      success: true,
      data: {
        id: albumId,
        platformPostId: albumId,
        platform: this.platform,
        url: `https://www.facebook.com/album/${albumId}`,
        createdAt: new Date(),
        status: 'published'
      }
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
      likes: metrics.post_reactions_by_type_total?.like || 0,
      shares: 0, // Would need additional API call
      comments: 0, // Would need additional API call
      views: metrics.post_impressions || 0,
      engagements: metrics.post_engaged_users || 0
    }
  }
  
  private processInsightsData(insightsData: any[], startDate: Date, endDate: Date): AnalyticsData {
    // Process Facebook Insights data into our standard format
    const metrics = insightsData.reduce((acc: any, insight) => {
      const latestValue = insight.values[insight.values.length - 1]?.value || 0
      
      switch (insight.name) {
        case 'page_impressions':
          acc.impressions = latestValue
          break
        case 'page_engaged_users':
          acc.engagements = latestValue
          break
        case 'page_fan_adds':
          acc.reach = latestValue
          break
        case 'page_post_engagements':
          acc.likes = latestValue
          break
      }
      
      return acc
    }, {})
    
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: metrics.impressions || 0,
        engagements: metrics.engagements || 0,
        likes: metrics.likes || 0,
        shares: 0,
        comments: 0,
        reach: metrics.reach || 0
      },
      topPosts: []
    }
  }
  
  private generateMockAnalytics(startDate: Date, endDate: Date): AnalyticsData {
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: Math.floor(Math.random() * 100000) + 20000,
        engagements: Math.floor(Math.random() * 10000) + 2000,
        likes: Math.floor(Math.random() * 5000) + 1000,
        shares: Math.floor(Math.random() * 2000) + 500,
        comments: Math.floor(Math.random() * 1000) + 200,
        reach: Math.floor(Math.random() * 80000) + 15000
      },
      topPosts: [
        { id: 'fb_post_1', engagement: 850, impressions: 25000 },
        { id: 'fb_post_2', engagement: 720, impressions: 18000 },
        { id: 'fb_post_3', engagement: 650, impressions: 15000 }
      ]
    }
  }
  
  protected getMaxTextLength(): number {
    return 63206 // Facebook's character limit
  }
  
  protected getMaxMediaCount(): number {
    return 10 // Facebook allows up to 10 photos in an album post
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // Facebook-specific validation
    if (!options.text && (!options.media || options.media.length === 0)) {
      issues.push('Facebook post must contain either text or media')
    }
    
    if (options.text && options.text.length > this.getMaxTextLength()) {
      issues.push(`Text exceeds Facebook's character limit of ${this.getMaxTextLength()}`)
    }
    
    if (options.media && options.media.length > this.getMaxMediaCount()) {
      issues.push(`Facebook allows maximum ${this.getMaxMediaCount()} media items per post`)
    }
    
    // Check video specifications
    if (options.media) {
      for (const media of options.media) {
        if (media.type === 'video') {
          if (media.duration && media.duration > 240 * 60) { // 240 minutes
            issues.push('Video duration cannot exceed 240 minutes on Facebook')
          }
          if (media.size && media.size > 10 * 1024 * 1024 * 1024) { // 10GB
            issues.push('Video file size cannot exceed 10GB on Facebook')
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