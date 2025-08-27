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

interface LinkedInConfig {
  clientId: string
  clientSecret: string
  baseURL?: string
}

interface LinkedInProfile {
  id: string
  firstName: {
    localized: Record<string, string>
    preferredLocale: { country: string; language: string }
  }
  lastName: {
    localized: Record<string, string>
    preferredLocale: { country: string; language: string }
  }
  headline?: {
    localized: Record<string, string>
  }
  profilePicture?: {
    'displayImage~': {
      elements: Array<{
        identifiers: Array<{
          identifier: string
        }>
      }>
    }
  }
  vanityName?: string
}

interface LinkedInEmailAddress {
  elements: Array<{
    'handle~': {
      emailAddress: string
    }
  }>
}

interface LinkedInOrganization {
  id: string
  name: {
    localized: Record<string, string>
  }
  logoV2?: {
    original?: string
    cropped?: string
  }
  staff?: {
    totalStaffCount?: number
  }
  followerCount?: number
}

interface LinkedInPost {
  id: string
  author: string
  lifecycleState: 'PUBLISHED' | 'DRAFT'
  created: {
    time: number
  }
  lastModified: {
    time: number
  }
  specificContent?: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary?: {
        text: string
      }
      shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' | 'ARTICLE'
      media?: Array<{
        status: 'READY' | 'PROCESSING' | 'FAILED'
        description?: {
          text: string
        }
        media?: string
        title?: {
          text: string
        }
      }>
    }
  }
}

interface LinkedInShare {
  activity: string
  id: string
}

export class LinkedInProvider extends BaseSocialMediaProvider {
  platform: Platform = 'linkedin'
  name = 'LinkedIn'
  
  private clientId: string
  private clientSecret: string
  
  constructor(config: LinkedInConfig) {
    super(config)
    this.baseURL = config.baseURL || 'https://api.linkedin.com/v2'
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
  }
  
  getAuthUrl(redirectUri: string, scopes: string[] = [
    'r_liteprofile',
    'r_emailaddress',
    'w_member_social',
    'r_organization_social',
    'w_organization_social'
  ]): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: this.generateState()
    })
    
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>> {
    try {
      const tokenResponse = await this.makeRequest<{
        access_token: string
        expires_in: number
        refresh_token?: string
        scope: string
      }>('/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }).toString()
      })
      
      if (!tokenResponse.success || !tokenResponse.data) {
        return tokenResponse as APIResponse<SocialAccount>
      }
      
      const accessToken = tokenResponse.data.access_token
      const expiresIn = tokenResponse.data.expires_in
      const scopes = tokenResponse.data.scope.split(' ')
      
      // Get user profile
      const tempAccount: SocialAccount = {
        id: '',
        platform: this.platform,
        platformId: '',
        username: '',
        displayName: '',
        accessToken,
        refreshToken: tokenResponse.data.refresh_token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        isConnected: true,
        permissions: scopes
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
        username: profile.username || profile.id,
        displayName: profile.displayName,
        avatar: profile.avatar
      }
      
      // Fetch organizations if user has permission
      if (scopes.includes('r_organization_social')) {
        await this.fetchUserOrganizations(account)
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
      // Get basic profile
      const profileResponse = await this.makeRequest<LinkedInProfile>(
        '/people/~:(id,firstName,lastName,headline,profilePicture(displayImage~:playableStreams),vanityName)',
        { method: 'GET' },
        account
      )
      
      if (!profileResponse.success || !profileResponse.data) {
        return profileResponse as APIResponse<UserProfile>
      }
      
      const linkedinProfile = profileResponse.data
      
      // Get email address
      let email = ''
      try {
        const emailResponse = await this.makeRequest<LinkedInEmailAddress>(
          '/emailAddress?q=members&projection=(elements*(handle~))',
          { method: 'GET' },
          account
        )
        
        if (emailResponse.success && emailResponse.data?.elements?.length > 0) {
          email = emailResponse.data.elements[0]['handle~'].emailAddress
        }
      } catch (error) {
        console.warn('Failed to fetch email address:', error)
      }
      
      // Extract profile picture
      let avatar = ''
      if (linkedinProfile.profilePicture?.['displayImage~']?.elements?.length > 0) {
        const profilePicElement = linkedinProfile.profilePicture['displayImage~'].elements[0]
        if (profilePicElement.identifiers?.length > 0) {
          avatar = profilePicElement.identifiers[0].identifier
        }
      }
      
      // Extract localized names
      const firstNameLocale = linkedinProfile.firstName.preferredLocale
      const lastNameLocale = linkedinProfile.lastName.preferredLocale
      const firstNameKey = `${firstNameLocale.language}_${firstNameLocale.country}`
      const lastNameKey = `${lastNameLocale.language}_${lastNameLocale.country}`
      
      const firstName = linkedinProfile.firstName.localized[firstNameKey] || 
                       Object.values(linkedinProfile.firstName.localized)[0] || ''
      const lastName = linkedinProfile.lastName.localized[lastNameKey] || 
                      Object.values(linkedinProfile.lastName.localized)[0] || ''
      
      const displayName = `${firstName} ${lastName}`.trim()
      
      // Extract headline
      let bio = ''
      if (linkedinProfile.headline?.localized) {
        bio = Object.values(linkedinProfile.headline.localized)[0] || ''
      }
      
      const profile: UserProfile = {
        id: linkedinProfile.id,
        username: linkedinProfile.vanityName || linkedinProfile.id,
        displayName,
        bio,
        avatar,
        followersCount: 0, // LinkedIn doesn't provide this for personal profiles
        followingCount: 0, // LinkedIn doesn't provide this for personal profiles
        postsCount: 0, // LinkedIn doesn't provide this easily
        verified: false,
        url: linkedinProfile.vanityName ? 
          `https://www.linkedin.com/in/${linkedinProfile.vanityName}` : 
          `https://www.linkedin.com/in/${linkedinProfile.id}`
      }
      
      return {
        success: true,
        data: profile,
        rateLimit: profileResponse.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch LinkedIn profile',
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
      // Determine author (user or organization)
      const author = this.getPostAuthor(account, options)
      
      const shareData: any = {
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: options.text || ''
            },
            shareMediaCategory: this.getMediaCategory(options.media)
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 
            options.settings?.linkedin?.visibility || 'PUBLIC'
        }
      }
      
      // Handle media
      if (options.media && options.media.length > 0) {
        shareData.specificContent['com.linkedin.ugc.ShareContent'].media = 
          await this.prepareMediaForPost(account, options.media)
      }
      
      // Handle targeting
      if (options.settings?.linkedin?.targetAudience) {
        shareData.targeting = options.settings.linkedin.targetAudience
      }
      
      const response = await this.makeRequest<LinkedInShare>(
        '/ugcPosts',
        {
          method: 'POST',
          body: JSON.stringify(shareData)
        },
        account
      )
      
      if (!response.success || !response.data) {
        return response as APIResponse<PublishedPost>
      }
      
      const shareId = response.data.id
      const publishedPost: PublishedPost = {
        id: shareId,
        platformPostId: shareId,
        platform: this.platform,
        url: `https://www.linkedin.com/feed/update/${shareId}`,
        createdAt: new Date(),
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
          message: 'Failed to create LinkedIn post',
          details: error
        }
      }
    }
  }
  
  async deletePost(account: SocialAccount, postId: string): Promise<APIResponse<boolean>> {
    try {
      const response = await this.makeRequest<any>(
        `/ugcPosts/${postId}`,
        { method: 'DELETE' },
        account
      )
      
      return {
        success: response.success,
        data: response.success,
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POST_DELETION_FAILED',
          message: 'Failed to delete LinkedIn post',
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
        q: 'authors',
        authors: `List(${account.platformId})`,
        count: Math.min(options?.limit || 20, 50),
        sortBy: 'LAST_MODIFIED'
      }
      
      if (options?.cursor) {
        params.start = parseInt(options.cursor)
      }
      
      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        elements: LinkedInPost[]
        paging?: {
          start: number
          count: number
          total: number
        }
      }>(`/ugcPosts?${queryString}`, {
        method: 'GET'
      }, account)
      
      if (!response.success || !response.data?.elements) {
        return response as APIResponse<PublishedPost[]>
      }
      
      const posts: PublishedPost[] = response.data.elements
        .filter(post => post.lifecycleState === 'PUBLISHED')
        .map(post => ({
          id: post.id,
          platformPostId: post.id,
          platform: this.platform,
          url: `https://www.linkedin.com/feed/update/${post.id}`,
          createdAt: new Date(post.created.time),
          status: 'published'
        }))
      
      return {
        success: true,
        data: posts,
        rateLimit: response.rateLimit,
        pagination: response.data.paging ? {
          nextCursor: (response.data.paging.start + response.data.paging.count).toString(),
          hasMore: response.data.paging.start + response.data.paging.count < response.data.paging.total
        } : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POSTS_FETCH_FAILED',
          message: 'Failed to fetch LinkedIn posts',
          details: error
        }
      }
    }
  }
  
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    try {
      // Step 1: Register upload
      const registerUploadRequest = {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], // or feedshare-video
          owner: account.platformId,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }
          ]
        }
      }
      
      const uploadResponse = await this.makeRequest<{
        value: {
          asset: string
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: string
              headers: Record<string, string>
            }
          }
        }
      }>('/assets?action=registerUpload', {
        method: 'POST',
        body: JSON.stringify(registerUploadRequest)
      }, account)
      
      if (!uploadResponse.success || !uploadResponse.data?.value) {
        return uploadResponse as APIResponse<{ mediaId: string }>
      }
      
      const asset = uploadResponse.data.value.asset
      const uploadUrl = uploadResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
      
      // Step 2: Upload media to provided URL
      // In a real implementation, you'd upload the actual media file here
      // For now, we'll simulate success
      
      return {
        success: true,
        data: { mediaId: asset }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: 'Failed to upload media to LinkedIn',
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
      // LinkedIn analytics are complex and require organization access
      // This is a simplified version that returns mock data
      return {
        success: true,
        data: this.generateMockAnalytics(options.startDate, options.endDate)
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: 'Failed to fetch LinkedIn analytics',
          details: error
        }
      }
    }
  }
  
  // LinkedIn-specific methods
  private async fetchUserOrganizations(account: SocialAccount): Promise<void> {
    try {
      const response = await this.makeRequest<{
        elements: Array<{
          organization: string
          roleAssignee: string
        }>
      }>('/organizationAcls?q=roleAssignee', {
        method: 'GET'
      }, account)
      
      if (response.success && response.data?.elements) {
        const organizationIds = response.data.elements.map(org => 
          org.organization.replace('urn:li:organization:', '')
        )
        
        if (organizationIds.length > 0) {
          const orgsResponse = await this.makeRequest<{
            results: Record<string, LinkedInOrganization>
          }>(`/organizations?ids=List(${organizationIds.join(',')})&fields=id,name,logoV2,staff,followerCount`, {
            method: 'GET'
          }, account)
          
          if (orgsResponse.success && orgsResponse.data?.results) {
            account.metadata = {
              ...account.metadata,
              organizations: Object.values(orgsResponse.data.results)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user organizations:', error)
    }
  }
  
  private getPostAuthor(account: SocialAccount, options: PostOptions): string {
    // Default to user's profile
    // In a real implementation, you might allow posting as an organization
    return `urn:li:person:${account.platformId}`
  }
  
  private getMediaCategory(media?: MediaItem[]): 'NONE' | 'IMAGE' | 'VIDEO' | 'ARTICLE' {
    if (!media || media.length === 0) {
      return 'NONE'
    }
    
    // LinkedIn supports one media type per post
    const firstMedia = media[0]
    if (firstMedia.type === 'image') {
      return 'IMAGE'
    } else if (firstMedia.type === 'video') {
      return 'VIDEO'
    }
    
    return 'NONE'
  }
  
  private async prepareMediaForPost(account: SocialAccount, mediaItems: MediaItem[]): Promise<any[]> {
    const preparedMedia = []
    
    for (const media of mediaItems.slice(0, 1)) { // LinkedIn typically supports one media item
      const uploadResult = await this.uploadMedia(account, media)
      
      if (uploadResult.success && uploadResult.data) {
        preparedMedia.push({
          status: 'READY',
          description: {
            text: media.altText || ''
          },
          media: uploadResult.data.mediaId,
          title: {
            text: media.altText || 'Uploaded media'
          }
        })
      }
    }
    
    return preparedMedia
  }
  
  private generateMockAnalytics(startDate: Date, endDate: Date): AnalyticsData {
    return {
      period: { start: startDate, end: endDate },
      metrics: {
        impressions: Math.floor(Math.random() * 25000) + 5000,
        engagements: Math.floor(Math.random() * 2500) + 500,
        likes: Math.floor(Math.random() * 1500) + 300,
        shares: Math.floor(Math.random() * 800) + 150,
        comments: Math.floor(Math.random() * 400) + 80,
        clicks: Math.floor(Math.random() * 1200) + 200,
        reach: Math.floor(Math.random() * 20000) + 4000
      },
      demographics: {
        ageGroups: {
          '18-24': 15,
          '25-34': 35,
          '35-44': 25,
          '45-54': 15,
          '55+': 10
        },
        genders: {
          male: 55,
          female: 42,
          other: 3
        },
        locations: {
          'United States': 40,
          'United Kingdom': 15,
          'Canada': 10,
          'Germany': 8,
          'Other': 27
        }
      },
      topPosts: [
        { id: 'li_post_1', engagement: 450, impressions: 8500 },
        { id: 'li_post_2', engagement: 380, impressions: 6800 },
        { id: 'li_post_3', engagement: 290, impressions: 5200 }
      ]
    }
  }
  
  protected getMaxTextLength(): number {
    return 3000 // LinkedIn's character limit
  }
  
  protected getMaxMediaCount(): number {
    return 1 // LinkedIn typically supports one media item per post
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // LinkedIn-specific validation
    if (!options.text && (!options.media || options.media.length === 0)) {
      issues.push('LinkedIn posts should contain text, media, or both')
    }
    
    if (options.text && options.text.length > this.getMaxTextLength()) {
      issues.push(`Text exceeds LinkedIn's character limit of ${this.getMaxTextLength()}`)
    }
    
    if (options.media && options.media.length > this.getMaxMediaCount()) {
      issues.push(`LinkedIn supports only ${this.getMaxMediaCount()} media item per post`)
    }
    
    // Check video specifications
    if (options.media) {
      for (const media of options.media) {
        if (media.type === 'video') {
          if (media.duration && media.duration > 10 * 60) { // 10 minutes
            issues.push('LinkedIn videos cannot exceed 10 minutes')
          }
          if (media.size && media.size > 5 * 1024 * 1024 * 1024) { // 5GB
            issues.push('LinkedIn video file size cannot exceed 5GB')
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