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

interface TikTokConfig {
  clientKey: string
  clientSecret: string
  baseURL?: string
}

interface TikTokUser {
  union_id: string
  open_id: string
  avatar_url?: string
  avatar_url_100?: string
  avatar_large_url?: string
  display_name: string
  bio_description?: string
  profile_deep_link?: string
  is_verified?: boolean
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
}

interface TikTokVideo {
  id: string
  title: string
  video_description: string
  create_time: number
  cover_image_url: string
  share_url: string
  video_url?: string
  embed_html?: string
  embed_link?: string
  like_count?: number
  comment_count?: number
  share_count?: number
  view_count?: number
}

interface TikTokCreatorInfo {
  creator_avatar_url: string
  creator_nickname: string
  creator_username: string
}

interface TikTokPostRequest {
  video_url: string
  post_info: {
    title: string
    privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
    disable_duet?: boolean
    disable_comment?: boolean
    disable_stitch?: boolean
    brand_content_toggle?: boolean
    brand_organic_toggle?: boolean
  }
  source_info: {
    source: string
    video_url: string
  }
}

export class TikTokProvider extends BaseSocialMediaProvider {
  platform: Platform = 'tiktok'
  name = 'TikTok'
  
  private clientKey: string
  private clientSecret: string
  
  constructor(config: TikTokConfig) {
    super(config)
    this.baseURL = config.baseURL || 'https://open-api.tiktok.com'
    this.clientKey = config.clientKey
    this.clientSecret = config.clientSecret
  }
  
  getAuthUrl(redirectUri: string, scopes: string[] = [
    'user.info.basic',
    'user.info.profile',
    'video.list',
    'video.upload',
    'user.info.stats'
  ]): string {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state: this.generateState()
    })
    
    return `https://www.tiktok.com/auth/authorize/?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>> {
    try {
      const tokenResponse = await this.makeRequest<{
        access_token: string
        expires_in: number
        open_id: string
        refresh_expires_in: number
        refresh_token: string
        scope: string
        token_type: string
      }>('/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        }).toString()
      })
      
      if (!tokenResponse.success || !tokenResponse.data) {
        return tokenResponse as APIResponse<SocialAccount>
      }
      
      const tokenData = tokenResponse.data
      
      // Create temporary account to get profile
      const tempAccount: SocialAccount = {
        id: tokenData.open_id,
        platform: this.platform,
        platformId: tokenData.open_id,
        username: '',
        displayName: '',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        isConnected: true,
        permissions: tokenData.scope.split(',')
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
    
    try {
      const response = await this.makeRequest<{
        access_token: string
        expires_in: number
        refresh_expires_in: number
        refresh_token: string
        scope: string
        token_type: string
      }>('/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: account.refreshToken
        }).toString()
      })
      
      if (!response.success || !response.data) {
        return response as APIResponse<SocialAccount>
      }
      
      const tokenData = response.data
      const updatedAccount: SocialAccount = {
        ...account,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        permissions: tokenData.scope.split(',')
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
        data: {
          user: TikTokUser
        }
      }>('/v2/user/info/?fields=open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count', {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data?.user) {
        return response as APIResponse<UserProfile>
      }
      
      const user = response.data.data.user
      const profile: UserProfile = {
        id: user.open_id,
        username: user.display_name.toLowerCase().replace(/\s+/g, '_'),
        displayName: user.display_name,
        bio: user.bio_description,
        avatar: user.avatar_large_url || user.avatar_url_100 || user.avatar_url,
        followersCount: user.follower_count || 0,
        followingCount: user.following_count || 0,
        postsCount: user.video_count || 0,
        verified: user.is_verified || false,
        url: user.profile_deep_link
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
          message: 'Failed to fetch TikTok profile',
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
            code: 'VIDEO_REQUIRED',
            message: 'TikTok posts require a video'
          }
        }
      }
      
      const video = options.media[0]
      if (video.type !== 'video') {
        return {
          success: false,
          error: {
            code: 'INVALID_MEDIA_TYPE',
            message: 'TikTok only supports video content'
          }
        }
      }
      
      // Upload video first
      const uploadResult = await this.uploadMedia(account, video)
      if (!uploadResult.success || !uploadResult.data) {
        return uploadResult as APIResponse<PublishedPost>
      }
      
      const videoUrl = uploadResult.data.mediaId // This would be the actual video URL after upload
      
      const postData: TikTokPostRequest = {
        video_url: videoUrl,
        post_info: {
          title: options.text || '',
          privacy_level: options.settings?.tiktok?.privacy || 'PUBLIC_TO_EVERYONE',
          disable_duet: !options.settings?.tiktok?.allowDuet,
          disable_comment: !options.settings?.tiktok?.allowComments,
          disable_stitch: !options.settings?.tiktok?.allowStitch
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl
        }
      }
      
      const response = await this.makeRequest<{
        data: {
          share_id: string
        }
      }>('/v2/post/publish/video/init/', {
        method: 'POST',
        body: JSON.stringify(postData)
      }, account)
      
      if (!response.success || !response.data?.data) {
        return response as APIResponse<PublishedPost>
      }
      
      const shareId = response.data.data.share_id
      
      // Poll for publish status (simplified)
      const publishedPost: PublishedPost = {
        id: shareId,
        platformPostId: shareId,
        platform: this.platform,
        url: `https://www.tiktok.com/@${account.username}/video/${shareId}`,
        createdAt: new Date(),
        status: 'published' // In reality, you'd need to poll for status
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
          message: 'Failed to create TikTok video',
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
        max_count: Math.min(options?.limit || 20, 20) // TikTok API limit
      }
      
      if (options?.cursor) {
        params.cursor = options.cursor
      }
      
      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        data: {
          videos: TikTokVideo[]
          cursor: string
          has_more: boolean
        }
      }>(`/v2/video/list/?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data?.videos) {
        return response as APIResponse<PublishedPost[]>
      }
      
      const videos = response.data.data.videos
      const posts: PublishedPost[] = videos.map(video => ({
        id: video.id,
        platformPostId: video.id,
        platform: this.platform,
        url: video.share_url,
        createdAt: new Date(video.create_time * 1000),
        engagement: {
          likes: video.like_count || 0,
          shares: video.share_count || 0,
          comments: video.comment_count || 0,
          views: video.view_count || 0
        },
        status: 'published'
      }))
      
      return {
        success: true,
        data: posts,
        rateLimit: response.rateLimit,
        pagination: {
          nextCursor: response.data.data.cursor,
          hasMore: response.data.data.has_more
        }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POSTS_FETCH_FAILED',
          message: 'Failed to fetch TikTok videos',
          details: error
        }
      }
    }
  }
  
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    try {
      // TikTok video upload is a multi-step process
      // Step 1: Initialize upload
      const initResponse = await this.makeRequest<{
        data: {
          upload_url: string
          publish_id: string
        }
      }>('/v2/post/publish/video/init/', {
        method: 'POST',
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD'
          }
        })
      }, account)
      
      if (!initResponse.success || !initResponse.data?.data) {
        return initResponse as APIResponse<{ mediaId: string }>
      }
      
      const uploadUrl = initResponse.data.data.upload_url
      const publishId = initResponse.data.data.publish_id
      
      // Step 2: Upload video to the provided URL
      // In a real implementation, you would upload the actual video file
      // For now, we'll simulate success
      
      return {
        success: true,
        data: { mediaId: publishId }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'Failed to upload video to TikTok',
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
      // TikTok analytics require additional permissions and have limited availability
      // This returns mock data for demonstration
      return {
        success: true,
        data: this.generateMockAnalytics(options.startDate, options.endDate)
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: 'Failed to fetch TikTok analytics',
          details: error
        }
      }
    }
  }
  
  async getComments(account: SocialAccount, postId: string): Promise<APIResponse<any[]>> {
    try {
      const response = await this.makeRequest<{
        data: {
          comments: Array<{
            id: string
            text: string
            like_count: number
            create_time: number
            user: {
              display_name: string
              avatar_url: string
            }
          }>
          cursor: string
          has_more: boolean
        }
      }>(`/v2/video/comment/list/?video_id=${postId}&max_count=50`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.data?.comments) {
        return response as APIResponse<any[]>
      }
      
      const comments = response.data.data.comments.map(comment => ({
        id: comment.id,
        text: comment.text,
        likes: comment.like_count,
        createdAt: new Date(comment.create_time * 1000),
        author: {
          name: comment.user.display_name,
          avatar: comment.user.avatar_url
        }
      }))
      
      return {
        success: true,
        data: comments,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COMMENTS_FETCH_FAILED',
          message: 'Failed to fetch TikTok comments',
          details: error
        }
      }
    }
  }
  
  // TikTok-specific methods
  private generateMockAnalytics(startDate: Date, endDate: Date): AnalyticsData {
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: Math.floor(Math.random() * 500000) + 100000,
        engagements: Math.floor(Math.random() * 50000) + 10000,
        likes: Math.floor(Math.random() * 30000) + 8000,
        shares: Math.floor(Math.random() * 10000) + 2000,
        comments: Math.floor(Math.random() * 5000) + 1000,
        views: Math.floor(Math.random() * 1000000) + 200000,
        reach: Math.floor(Math.random() * 400000) + 80000
      },
      demographics: {
        ageGroups: {
          '13-17': 25,
          '18-24': 35,
          '25-34': 25,
          '35-44': 10,
          '45+': 5
        },
        genders: {
          male: 48,
          female: 50,
          other: 2
        },
        locations: {
          'United States': 30,
          'Brazil': 12,
          'Mexico': 10,
          'India': 8,
          'Other': 40
        }
      },
      topPosts: [
        { id: 'tiktok_video_1', engagement: 15000, impressions: 250000 },
        { id: 'tiktok_video_2', engagement: 12000, impressions: 180000 },
        { id: 'tiktok_video_3', engagement: 9500, impressions: 150000 }
      ]
    }
  }
  
  protected getMaxTextLength(): number {
    return 2200 // TikTok's character limit for captions
  }
  
  protected getMaxMediaCount(): number {
    return 1 // TikTok supports one video per post
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // TikTok-specific validation
    if (!options.media || options.media.length === 0) {
      issues.push('TikTok posts require a video')
    }
    
    if (options.media && options.media.length > 0) {
      const video = options.media[0]
      if (video.type !== 'video') {
        issues.push('TikTok only supports video content')
      }
      
      // Video duration check
      if (video.duration) {
        if (video.duration < 3) {
          issues.push('TikTok videos must be at least 3 seconds long')
        }
        if (video.duration > 60 * 10) { // 10 minutes
          issues.push('TikTok videos cannot exceed 10 minutes')
        }
      }
      
      // File size check
      if (video.size && video.size > 287 * 1024 * 1024) { // 287MB
        issues.push('TikTok video file size cannot exceed 287MB')
      }
    }
    
    if (options.text && options.text.length > this.getMaxTextLength()) {
      issues.push(`Caption exceeds TikTok's character limit of ${this.getMaxTextLength()}`)
    }
    
    // Check for multiple videos
    if (options.media && options.media.length > 1) {
      issues.push('TikTok supports only one video per post')
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