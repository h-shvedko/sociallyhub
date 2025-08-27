import { 
  SocialMediaProvider, 
  Platform, 
  APIResponse, 
  SocialAccount, 
  PostOptions,
  RateLimitInfo,
  SocialMediaError,
  RateLimitError,
  AuthenticationError 
} from './types'

export abstract class BaseSocialMediaProvider implements SocialMediaProvider {
  abstract platform: Platform
  abstract name: string
  
  protected baseURL: string = ''
  protected apiVersion: string = ''
  protected timeout: number = 30000
  protected maxRetries: number = 3
  
  constructor(protected config: Record<string, any> = {}) {
    this.baseURL = config.baseURL || this.baseURL
    this.apiVersion = config.apiVersion || this.apiVersion
    this.timeout = config.timeout || this.timeout
    this.maxRetries = config.maxRetries || this.maxRetries
  }
  
  // Abstract methods that must be implemented by each provider
  abstract getAuthUrl(redirectUri: string, scopes?: string[]): string
  abstract exchangeCodeForToken(code: string, redirectUri: string): Promise<APIResponse<SocialAccount>>
  abstract getProfile(account: SocialAccount): Promise<APIResponse<any>>
  abstract createPost(account: SocialAccount, options: PostOptions): Promise<APIResponse<any>>
  
  // Default implementations that can be overridden
  async refreshAccessToken(account: SocialAccount): Promise<APIResponse<SocialAccount>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Token refresh not implemented for this provider'
    )
  }
  
  async updateProfile(account: SocialAccount, updates: any): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Profile update not implemented for this provider'
    )
  }
  
  async schedulePost(account: SocialAccount, options: PostOptions): Promise<APIResponse<{ scheduledId: string }>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Post scheduling not implemented for this provider'
    )
  }
  
  async updatePost(account: SocialAccount, postId: string, updates: Partial<PostOptions>): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Post update not implemented for this provider'
    )
  }
  
  async deletePost(account: SocialAccount, postId: string): Promise<APIResponse<boolean>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Post deletion not implemented for this provider'
    )
  }
  
  async getPosts(account: SocialAccount, options?: any): Promise<APIResponse<any[]>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Post retrieval not implemented for this provider'
    )
  }
  
  async getPost(account: SocialAccount, postId: string): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Single post retrieval not implemented for this provider'
    )
  }
  
  async uploadMedia(account: SocialAccount, media: any): Promise<APIResponse<{ mediaId: string }>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Media upload not implemented for this provider'
    )
  }
  
  async getMediaLibrary(account: SocialAccount, options?: any): Promise<APIResponse<any[]>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Media library not implemented for this provider'
    )
  }
  
  async getAnalytics(account: SocialAccount, options: any): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Analytics not implemented for this provider'
    )
  }
  
  async getPostAnalytics(account: SocialAccount, postId: string): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Post analytics not implemented for this provider'
    )
  }
  
  async getComments(account: SocialAccount, postId: string): Promise<APIResponse<any[]>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Comments retrieval not implemented for this provider'
    )
  }
  
  async replyToComment(account: SocialAccount, commentId: string, text: string): Promise<APIResponse<any>> {
    throw new SocialMediaError(
      this.platform, 
      'NOT_IMPLEMENTED', 
      'Comment reply not implemented for this provider'
    )
  }
  
  async getRateLimit(account: SocialAccount): Promise<APIResponse<RateLimitInfo>> {
    return {
      success: true,
      data: {
        limit: 1000,
        remaining: 999,
        resetAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
      }
    }
  }
  
  async validatePost(options: PostOptions): Promise<APIResponse<{ valid: boolean; issues?: string[] }>> {
    const issues: string[] = []
    
    // Basic validation
    if (!options.text && (!options.media || options.media.length === 0)) {
      issues.push('Post must contain either text or media')
    }
    
    // Text length validation (can be overridden by specific providers)
    if (options.text && options.text.length > this.getMaxTextLength()) {
      issues.push(`Text exceeds maximum length of ${this.getMaxTextLength()} characters`)
    }
    
    // Media validation
    if (options.media) {
      const maxMedia = this.getMaxMediaCount()
      if (options.media.length > maxMedia) {
        issues.push(`Cannot attach more than ${maxMedia} media items`)
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
  
  // Helper methods for API calls
  protected async makeRequest<T = any>(
    url: string, 
    options: RequestInit = {},
    account?: SocialAccount
  ): Promise<APIResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'User-Agent': 'SociallyHub/1.0'
    }
    
    if (account?.accessToken) {
      defaultHeaders.Authorization = `Bearer ${account.accessToken}`
    }
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    }
    
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)
        
        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = this.getRetryAfterFromHeaders(response.headers)
          throw new RateLimitError(this.platform, retryAfter)
        }
        
        // Handle authentication errors
        if (response.status === 401) {
          throw new AuthenticationError(this.platform, 'Invalid or expired access token')
        }
        
        const responseData = await this.parseResponse(response)
        
        if (!response.ok) {
          return {
            success: false,
            error: {
              code: response.status.toString(),
              message: responseData.message || response.statusText,
              details: responseData
            }
          }
        }
        
        return {
          success: true,
          data: responseData as T,
          rateLimit: this.extractRateLimitFromHeaders(response.headers)
        }
        
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on authentication errors or rate limits
        if (error instanceof AuthenticationError || error instanceof RateLimitError) {
          throw error
        }
        
        // Wait before retrying
        if (attempt < this.maxRetries) {
          await this.wait(Math.pow(2, attempt) * 1000) // Exponential backoff
        }
      }
    }
    
    throw lastError || new Error('Request failed after maximum retries')
  }
  
  protected async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    
    return response.text()
  }
  
  protected extractRateLimitFromHeaders(headers: Headers): RateLimitInfo | undefined {
    const limit = headers.get('x-rate-limit-limit')
    const remaining = headers.get('x-rate-limit-remaining')
    const reset = headers.get('x-rate-limit-reset')
    
    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        resetAt: new Date(parseInt(reset) * 1000)
      }
    }
    
    return undefined
  }
  
  protected getRetryAfterFromHeaders(headers: Headers): number {
    const retryAfter = headers.get('retry-after')
    return retryAfter ? parseInt(retryAfter) * 1000 : 60000 // Default to 1 minute
  }
  
  protected wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  // Platform-specific limits (can be overridden)
  protected getMaxTextLength(): number {
    return 280 // Default to Twitter's limit
  }
  
  protected getMaxMediaCount(): number {
    return 4 // Default to Twitter's limit
  }
  
  // Utility methods
  protected generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15)
  }
  
  protected buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()))
        } else {
          searchParams.append(key, value.toString())
        }
      }
    })
    
    return searchParams.toString()
  }
}