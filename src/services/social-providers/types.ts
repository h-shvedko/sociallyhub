// Base types for social media API integrations

export interface SocialMediaPost {
  id: string
  text: string
  media?: MediaItem[]
  scheduledFor?: Date
  platforms: Platform[]
  hashtags?: string[]
  mentions?: string[]
  location?: Location
}

export interface MediaItem {
  id: string
  type: 'image' | 'video' | 'gif'
  url: string
  thumbnailUrl?: string
  altText?: string
  duration?: number // for videos
  size?: number
  width?: number
  height?: number
}

export interface Location {
  name: string
  coordinates?: {
    latitude: number
    longitude: number
  }
  placeId?: string
}

export type Platform = 
  | 'twitter' 
  | 'facebook' 
  | 'instagram' 
  | 'linkedin' 
  | 'tiktok' 
  | 'youtube'

export interface SocialAccount {
  id: string
  platform: Platform
  platformId: string
  username: string
  displayName: string
  avatar?: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  isConnected: boolean
  permissions: string[]
  metadata?: Record<string, any>
}

export interface PostOptions {
  text: string
  media?: MediaItem[]
  scheduledFor?: Date
  location?: Location
  hashtags?: string[]
  mentions?: string[]
  settings?: PlatformSpecificSettings
}

export interface PlatformSpecificSettings {
  twitter?: {
    threadMode?: boolean
    replyToTweetId?: string
    quoteTweetId?: string
  }
  facebook?: {
    targetingOptions?: any
    publishingOptions?: any
    privacySettings?: 'PUBLIC' | 'FRIENDS' | 'CUSTOM'
  }
  instagram?: {
    altText?: string
    userTags?: Array<{ userId: string; x: number; y: number }>
    locationId?: string
  }
  linkedin?: {
    visibility?: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN_MEMBERS'
    targetAudience?: any
  }
  tiktok?: {
    privacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
    allowComments?: boolean
    allowDuet?: boolean
    allowStitch?: boolean
  }
  youtube?: {
    privacy?: 'public' | 'unlisted' | 'private'
    categoryId?: string
    tags?: string[]
    description?: string
    thumbnail?: string
  }
}

export interface PublishedPost {
  id: string
  platformPostId: string
  platform: Platform
  url?: string
  createdAt: Date
  engagement?: {
    likes: number
    shares: number
    comments: number
    views?: number
  }
  status: 'published' | 'failed' | 'pending'
  error?: string
}

export interface UserProfile {
  id: string
  username: string
  displayName: string
  bio?: string
  avatar?: string
  followersCount: number
  followingCount: number
  postsCount: number
  verified: boolean
  url?: string
}

export interface AnalyticsData {
  period: {
    start: Date
    end: Date
  }
  metrics: {
    impressions: number
    engagements: number
    likes: number
    shares: number
    comments: number
    clicks?: number
    views?: number
    reach?: number
  }
  demographics?: {
    ageGroups: Record<string, number>
    genders: Record<string, number>
    locations: Record<string, number>
  }
  topPosts: Array<{
    id: string
    engagement: number
    impressions: number
  }>
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: Date
  retryAfter?: number
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  rateLimit?: RateLimitInfo
  pagination?: {
    nextCursor?: string
    hasMore: boolean
    total?: number
  }
}

export interface SocialMediaProvider {
  platform: Platform
  name: string
  
  // Authentication
  getAuthUrl(redirectUri: string, scopes?: string[]): string
  exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>>
  refreshAccessToken(account: SocialAccount): Promise<APIResponse<SocialAccount>>
  
  // Account Management
  getProfile(account: SocialAccount): Promise<APIResponse<UserProfile>>
  updateProfile(account: SocialAccount, updates: Partial<UserProfile>): Promise<APIResponse<UserProfile>>
  
  // Content Publishing
  createPost(account: SocialAccount, options: PostOptions): Promise<APIResponse<PublishedPost>>
  schedulePost(account: SocialAccount, options: PostOptions): Promise<APIResponse<{ scheduledId: string }>>
  updatePost(account: SocialAccount, postId: string, updates: Partial<PostOptions>): Promise<APIResponse<PublishedPost>>
  deletePost(account: SocialAccount, postId: string): Promise<APIResponse<boolean>>
  
  // Content Retrieval
  getPosts(account: SocialAccount, options?: { 
    limit?: number
    cursor?: string
    since?: Date 
    until?: Date 
  }): Promise<APIResponse<PublishedPost[]>>
  getPost(account: SocialAccount, postId: string): Promise<APIResponse<PublishedPost>>
  
  // Media Management
  uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>>
  getMediaLibrary(account: SocialAccount, options?: { 
    limit?: number
    cursor?: string 
  }): Promise<APIResponse<MediaItem[]>>
  
  // Analytics
  getAnalytics(account: SocialAccount, options: {
    startDate: Date
    endDate: Date
    metrics?: string[]
  }): Promise<APIResponse<AnalyticsData>>
  getPostAnalytics(account: SocialAccount, postId: string): Promise<APIResponse<AnalyticsData>>
  
  // Engagement
  getComments(account: SocialAccount, postId: string): Promise<APIResponse<any[]>>
  replyToComment(account: SocialAccount, commentId: string, text: string): Promise<APIResponse<any>>
  
  // Rate Limiting
  getRateLimit(account: SocialAccount): Promise<APIResponse<RateLimitInfo>>
  
  // Validation
  validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>>
  
  // Platform-specific methods (optional)
  [key: string]: any
}

export interface SocialMediaManagerConfig {
  providers: SocialMediaProvider[]
  defaultRetryAttempts: number
  defaultTimeout: number
  rateLimitBuffer: number
}

// Error types
export class SocialMediaError extends Error {
  constructor(
    public platform: Platform,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'SocialMediaError'
  }
}

export class RateLimitError extends SocialMediaError {
  constructor(
    platform: Platform,
    public retryAfter: number,
    message = 'Rate limit exceeded'
  ) {
    super(platform, 'RATE_LIMIT_EXCEEDED', message)
    this.name = 'RateLimitError'
  }
}

export class AuthenticationError extends SocialMediaError {
  constructor(platform: Platform, message = 'Authentication failed') {
    super(platform, 'AUTHENTICATION_ERROR', message)
    this.name = 'AuthenticationError'
  }
}

export class ValidationError extends SocialMediaError {
  constructor(
    platform: Platform,
    public issues: string[],
    message = 'Validation failed'
  ) {
    super(platform, 'VALIDATION_ERROR', message)
    this.name = 'ValidationError'
  }
}