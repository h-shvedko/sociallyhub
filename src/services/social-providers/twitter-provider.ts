import crypto from 'crypto'
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
  InboxReplyTarget,
  ValidationError
} from './types'
// PKCE verifier persistence (ADR-0009 Phase 0.6 / 1.1): verifiers are stored in
// Redis keyed by the OAuth `state` with a 10-minute TTL, then read back during
// token exchange. Provided by src/lib/social/pkce-store.ts.
import { storePkceVerifier, getPkceVerifier } from '@/lib/social/pkce-store'
// Real media upload (ADR-0009 Phase 1.2): source bytes from the ADR-0007 storage
// layer so the chunked v1.1 upload sends real data — never a fabricated media id.
import { resolveMediaBytes } from './media-bytes'

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
  
  getAuthUrl(
    redirectUri: string,
    scopes: string[] = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    state?: string
  ): string {
    // ADR-0009: use the caller's HMAC-signed `state` when present so a SINGLE
    // state round-trips — the callback both verifies it (recovering
    // workspaceId/userId) AND finds the PKCE verifier keyed by it. Minting a
    // second state here (the old bug) split those two needs across two
    // different, conflicting `state` values and broke token exchange. Only
    // stateless callers fall back to a self-minted nonce.
    const oauthState = state ?? this.generateState()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: oauthState,
      code_challenge_method: 'S256',
      code_challenge: this.generateCodeChallenge(oauthState)
    })

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string, redirectUri: string, state?: string): Promise<APIResponse<SocialAccount>> {
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token'

    // PKCE: recover the verifier persisted (keyed by the OAuth `state`) when the
    // authorization URL was minted. Without it we cannot satisfy Twitter's S256
    // PKCE requirement — fail honestly rather than sending an invalid grant.
    const codeVerifier = state ? await this.getStoredCodeVerifier(state) : null
    if (!codeVerifier) {
      return {
        success: false,
        error: {
          code: 'PKCE_VERIFIER_MISSING',
          message:
            'PKCE code_verifier not found for this OAuth state (missing state, or the ' +
            '10-minute TTL expired). Restart the connect flow.'
        }
      }
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
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
  
  /**
   * Reply to an ingested inbox item by posting a reply tweet (X API v2
   * POST /2/tweets with `reply.in_reply_to_tweet_id`). Without valid credentials
   * the underlying request fails honestly (4xx) and this returns success:false —
   * never a fabricated success (ADR-0009 Phase 1.5).
   */
  async replyToItem(
    account: SocialAccount,
    item: InboxReplyTarget,
    text: string
  ): Promise<APIResponse<{ id: string }>> {
    if (!item.providerItemId) {
      return {
        success: false,
        error: {
          code: 'MISSING_TARGET',
          message: 'No target tweet id (providerItemId) to reply to'
        }
      }
    }

    try {
      const response = await this.makeRequest<{
        data: { id: string; text: string }
      }>('/tweets', {
        method: 'POST',
        body: JSON.stringify({
          text,
          reply: { in_reply_to_tweet_id: item.providerItemId }
        })
      }, account)

      if (!response.success || !response.data?.data) {
        return {
          success: false,
          error: response.error || {
            code: 'REPLY_FAILED',
            message: 'Failed to post reply tweet'
          },
          rateLimit: response.rateLimit
        }
      }

      return {
        success: true,
        data: { id: response.data.data.id },
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REPLY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to post reply tweet',
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
  
  /**
   * Real X/Twitter media upload via the v1.1 chunked `media/upload` protocol
   * (INIT → APPEND(s) → FINALIZE, plus a processing-status poll for video/GIF).
   * Bytes are sourced from the ADR-0007 storage layer (`resolveMediaBytes`).
   *
   * HONESTY (ADR-0009): this NEVER returns a fabricated media id — the previous
   * `mock_media_...` stub is gone. Without a valid access token, without real
   * bytes, or on any API error, it returns `success:false` with a clear message.
   * Live verification against the real endpoint is DEFERRED until X API
   * credentials exist; the code is written to the documented v1.1 contract.
   */
  async uploadMedia(account: SocialAccount, media: MediaItem): Promise<APIResponse<{ mediaId: string }>> {
    if (!account.accessToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Twitter media upload requires a connected account access token.'
        }
      }
    }

    try {
      // Read the real bytes (throws honestly if they cannot be resolved).
      const { buffer, mimeType } = await resolveMediaBytes(media)
      const mediaId = await this.uploadMediaChunked(
        account.accessToken,
        buffer,
        mimeType,
        media.type
      )
      return {
        success: true,
        data: { mediaId }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MEDIA_UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to upload media',
          details: error
        }
      }
    }
  }

  /** X media_category for the chunked upload INIT command. */
  private twitterMediaCategory(mimeType: string, type: MediaItem['type']): string {
    if (type === 'gif' || mimeType === 'image/gif') return 'tweet_gif'
    if (type === 'video' || mimeType.startsWith('video/')) return 'tweet_video'
    return 'tweet_image'
  }

  /**
   * Chunked v1.1 media upload. Uses the account's OAuth2 user-context bearer
   * token (scope `media.write`). Throws on any non-2xx so `uploadMedia` maps it
   * to an honest failure. Returns the `media_id_string` on success.
   */
  private async uploadMediaChunked(
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    type: MediaItem['type']
  ): Promise<string> {
    const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json'
    const authHeader = { Authorization: `Bearer ${accessToken}` }
    const totalBytes = buffer.byteLength
    if (totalBytes === 0) {
      throw new Error('Media is empty (0 bytes); nothing to upload')
    }
    const category = this.twitterMediaCategory(mimeType, type)

    const safeText = async (res: Response): Promise<string> => {
      try {
        return (await res.text()).slice(0, 500)
      } catch {
        return ''
      }
    }

    // INIT — reserve a media id and declare total size + type.
    const initBody = new URLSearchParams({
      command: 'INIT',
      total_bytes: String(totalBytes),
      media_type: mimeType,
      media_category: category
    })
    const initRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: initBody.toString()
    })
    if (!initRes.ok) {
      throw new Error(`Twitter media INIT failed: HTTP ${initRes.status} ${await safeText(initRes)}`)
    }
    const initJson = (await initRes.json()) as { media_id_string?: string }
    const mediaId = initJson.media_id_string
    if (!mediaId) {
      throw new Error('Twitter media INIT returned no media_id_string')
    }

    // APPEND — upload the bytes in ordered chunks (<= 5MB each per X limits).
    const CHUNK_SIZE = 5 * 1024 * 1024
    let segmentIndex = 0
    for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
      const chunk = buffer.subarray(offset, Math.min(offset + CHUNK_SIZE, totalBytes))
      const form = new FormData()
      form.append('command', 'APPEND')
      form.append('media_id', mediaId)
      form.append('segment_index', String(segmentIndex))
      form.append('media', new Blob([chunk], { type: 'application/octet-stream' }))
      const appendRes = await fetch(UPLOAD_URL, { method: 'POST', headers: authHeader, body: form })
      if (!appendRes.ok) {
        throw new Error(
          `Twitter media APPEND (segment ${segmentIndex}) failed: HTTP ${appendRes.status} ${await safeText(appendRes)}`
        )
      }
      segmentIndex++
    }

    // FINALIZE — assemble the chunks; may kick off async processing for video/GIF.
    const finalizeBody = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })
    const finalizeRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: finalizeBody.toString()
    })
    if (!finalizeRes.ok) {
      throw new Error(`Twitter media FINALIZE failed: HTTP ${finalizeRes.status} ${await safeText(finalizeRes)}`)
    }
    const finalizeJson = (await finalizeRes.json()) as {
      processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } }
    }

    // Async processing (typically video/GIF): poll STATUS until succeeded/failed.
    if (finalizeJson.processing_info) {
      await this.pollMediaProcessing(UPLOAD_URL, authHeader, mediaId, finalizeJson.processing_info, safeText)
    }

    return mediaId
  }

  /** Poll v1.1 media/upload STATUS until processing succeeds; throw on failure/timeout. */
  private async pollMediaProcessing(
    uploadUrl: string,
    authHeader: { Authorization: string },
    mediaId: string,
    initialInfo: { state?: string; check_after_secs?: number; error?: { message?: string } },
    safeText: (res: Response) => Promise<string>
  ): Promise<void> {
    let info = initialInfo
    const MAX_POLLS = 20
    for (let attempt = 0; info && (info.state === 'pending' || info.state === 'in_progress'); attempt++) {
      if (attempt >= MAX_POLLS) {
        throw new Error(`Twitter media processing did not complete after ${MAX_POLLS} polls (media_id ${mediaId})`)
      }
      const waitMs = Math.max(1, info.check_after_secs ?? 1) * 1000
      await this.wait(waitMs)
      const statusRes = await fetch(
        `${uploadUrl}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
        { method: 'GET', headers: authHeader }
      )
      if (!statusRes.ok) {
        throw new Error(`Twitter media STATUS failed: HTTP ${statusRes.status} ${await safeText(statusRes)}`)
      }
      const statusJson = (await statusRes.json()) as {
        processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } }
      }
      info = statusJson.processing_info ?? { state: 'succeeded' }
    }
    if (info && info.state === 'failed') {
      throw new Error(`Twitter media processing failed: ${info.error?.message ?? 'unknown error'}`)
    }
  }
  
  async getAnalytics(account: SocialAccount, options: {
    startDate: Date
    endDate: Date
    metrics?: string[]
  }): Promise<APIResponse<AnalyticsData>> {
    // Real X/Twitter API v2 analytics: fetch the account's recent tweets and
    // aggregate their public_metrics. NEVER fabricate data — on missing creds
    // or any API failure this returns { success: false } so callers can never
    // mistake fiction for real metrics (ADR-0009 honesty-over-coverage rule).
    if (!account.accessToken) {
      return {
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Twitter analytics unavailable: account has no access token. Connect the account first.'
        }
      }
    }

    if (!account.platformId) {
      return {
        success: false,
        error: {
          code: 'MISSING_ACCOUNT_ID',
          message: 'Twitter analytics unavailable: account is missing its platform user id.'
        }
      }
    }

    try {
      const params: Record<string, any> = {
        'tweet.fields': 'created_at,public_metrics',
        max_results: 100,
        start_time: options.startDate.toISOString(),
        end_time: options.endDate.toISOString()
      }

      const queryString = this.buildQueryParams(params)
      const response = await this.makeRequest<{
        data?: TwitterTweet[]
        meta?: { result_count: number }
      }>(`/users/${account.platformId}/tweets?${queryString}`, {
        method: 'GET'
      }, account)

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'ANALYTICS_FETCH_FAILED',
            message: 'Twitter analytics request failed'
          },
          rateLimit: response.rateLimit
        }
      }

      const tweets = response.data?.data ?? []

      const aggregate = {
        impressions: 0,
        engagements: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        views: 0,
        reach: 0
      }

      const perPost = tweets.map(tweet => {
        const m = tweet.public_metrics
        const likes = m?.like_count ?? 0
        const shares = (m?.retweet_count ?? 0) + (m?.quote_count ?? 0)
        const comments = m?.reply_count ?? 0
        const impressions = m?.impression_count ?? 0
        const engagement = likes + shares + comments

        aggregate.likes += likes
        aggregate.shares += shares
        aggregate.comments += comments
        aggregate.engagements += engagement
        aggregate.impressions += impressions
        aggregate.views += impressions

        return { id: tweet.id, engagement, impressions }
      })

      // Twitter has no public follower-reach metric per tweet; impressions is
      // the closest honest proxy and is only populated when the token tier
      // grants impression_count. Leave it as the summed real value (0 if the
      // tier does not return it) rather than inventing a number.
      aggregate.reach = aggregate.impressions

      const topPosts = perPost
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)

      return {
        success: true,
        data: {
          period: {
            start: options.startDate,
            end: options.endDate
          },
          metrics: aggregate,
          topPosts
        },
        rateLimit: response.rateLimit
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ANALYTICS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch Twitter analytics',
          details: error
        }
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
  
  /**
   * Real S256 PKCE (RFC 7636). Generates a cryptographically random verifier,
   * derives `challenge = base64url(sha256(verifier))`, and persists the verifier
   * keyed by the OAuth `state` (10-minute TTL, handled by the pkce-store) so the
   * callback can read it back at token exchange. Returns the challenge for the
   * authorization URL.
   *
   * `getAuthUrl` is synchronous per the SocialMediaProvider contract, so the
   * Redis write cannot be awaited here; the human OAuth round-trip (seconds) far
   * exceeds the write latency, and any write error is surfaced via `.catch`.
   */
  private generateCodeChallenge(state: string): string {
    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    void storePkceVerifier(state, verifier).catch((err) => {
      console.error('[twitter-pkce] failed to persist PKCE verifier for state', err)
    })
    return challenge
  }

  /** Read back the PKCE verifier stored (keyed by `state`) when the auth URL was minted. */
  private async getStoredCodeVerifier(state: string): Promise<string | null> {
    return getPkceVerifier(state)
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