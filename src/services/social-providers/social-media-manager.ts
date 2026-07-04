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
import { prisma } from '@/lib/prisma'
import { decryptCredentials, decryptToken, encryptToken } from '@/lib/encryption'

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
  // LEGACY, per-process OAuth-callback cache ONLY (ADR-0009 Phase 0).
  //
  // This in-memory Map is NOT the source of truth for accounts and MUST NOT be
  // used by the publish/analytics/refresh paths — those resolve `SocialAccount`
  // rows from the database (via `getDecryptedAccount` / `refreshAccount` /
  // `processors/post-scheduling.ts`), because a worker in a separate process can
  // never see whatever a request handler happened to put here. The only writer
  // is `exchangeCodeForToken` during the OAuth callback within a single request;
  // the map is retained solely for backward compatibility with the older
  // `getAccount`/`bulkPost`/`checkAccountStatuses` helpers on this singleton that
  // later phases (analytics rewiring) migrate off it. It is slated for removal
  // once no caller depends on it.
  private accounts: Map<string, SocialAccount>

  /**
   * @param options.skipEnvInit when true, do NOT auto-populate providers from
   *   `process.env`. Used by `getSocialManager(workspaceId)`, which injects
   *   per-workspace credentials via `registerProvider`. The default (no options)
   *   preserves the env-initialized singleton for existing single-tenant callers.
   */
  constructor(options?: { skipEnvInit?: boolean }) {
    this.providers = new Map()
    this.accounts = new Map()

    // Initialize providers with configuration from environment (single-tenant).
    if (!options?.skipEnvInit) {
      this.initializeProviders()
    }
  }

  private initializeProviders() {
    // Single-tenant env fallback: register a provider for each platform whose
    // required env credentials are present. Delegates to the SAME builder used
    // by the per-workspace factory (`getSocialManager`) so env and BYO
    // credentials map to provider configs identically (and correctly — the old
    // inline Instagram/TikTok mappings passed the wrong config field names).
    for (const platform of ALL_PLATFORMS) {
      const envCreds = envCredentialsFor(platform)
      if (!envCreds) continue
      const provider = buildProviderFromCredentials(platform, envCreds)
      if (provider) this.providers.set(platform, provider)
    }
  }

  // Provider Management
  getProvider(platform: Platform): SocialMediaProvider {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new SocialMediaError(platform, 'PROVIDER_NOT_FOUND', `Provider for ${platform} not found`)
    }
    return provider
  }

  /**
   * Register (or replace) a provider instance for a platform. Used by
   * `getSocialManager(workspaceId)` to inject providers built from a workspace's
   * decrypted `PlatformCredentials` (or the env fallback). Not part of the
   * legacy in-memory account cache.
   */
  registerProvider(platform: Platform, provider: SocialMediaProvider): void {
    this.providers.set(platform, provider)
  }

  /**
   * Refresh a stored `SocialAccount`'s OAuth tokens and persist them ENCRYPTED.
   * Delegates to the module-level `refreshAccount` (DB-backed, Map-free) so the
   * singleton and any per-workspace instance behave identically. See that
   * function for the honest-failure contract.
   */
  async refreshAccount(
    accountId: string
  ): Promise<APIResponse<RefreshAccountResult>> {
    return refreshAccount(accountId)
  }

  getSupportedPlatforms(): Platform[] {
    return Array.from(this.providers.keys())
  }

  // Account Management
  addAccount(account: SocialAccount): void {
    const key = `${account.platform}_${account.id}`
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

  // Authentication.
  // ADR-0009: `state` is threaded end-to-end so a SINGLE HMAC-signed OAuth state
  // (minted by the connect route) is embedded in the auth URL and, for PKCE
  // providers, keys the code_verifier. The same `state` is handed back to
  // `exchangeCodeForToken` so PKCE providers can recover that verifier. Passing
  // no `state` preserves the legacy self-minted-nonce behaviour.
  async getAuthUrl(
    platform: Platform,
    redirectUri: string,
    scopes?: string[],
    state?: string
  ): Promise<string> {
    const provider = this.getProvider(platform)
    return provider.getAuthUrl(redirectUri, scopes, state)
  }

  async exchangeCodeForToken(
    platform: Platform,
    code: string,
    redirectUri: string,
    state?: string
  ): Promise<APIResponse<SocialAccount>> {
    const provider = this.getProvider(platform)
    const result = await provider.exchangeCodeForToken(code, redirectUri, state)

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

    return provider.getProfile(account)
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
        const profileResult = await provider.getProfile(account)
        
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

// ============================================================================
// ADR-0009 Phase 0.1 — per-workspace credential resolution + DB-backed refresh.
//
// The env-initialized `socialMediaManager` singleton below is retained for the
// single-tenant callers that still depend on it. The forward path is
// `getSocialManager(workspaceId)`, which resolves credentials from the
// workspace's `PlatformCredentials` (decrypted, ADR-0006) and falls back to
// `process.env` for single-tenant installs. Neither of these paths uses the
// legacy in-memory `accounts` Map — accounts always come from the database.
// ============================================================================

/**
 * A decrypted credentials bag. Every value is a string secret/id (or absent).
 * Produced by `decryptCredentials(PlatformCredentials.credentials)` or read from
 * `process.env`.
 */
type CredentialBag = Record<string, string | undefined>

/** Every platform we can build a provider for, in a stable order. */
const ALL_PLATFORMS: Platform[] = [
  'twitter',
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
]

/** Map the DB `SocialProvider` enum (uppercase) to the provider-layer Platform. */
function dbProviderToPlatform(provider: string): Platform | null {
  switch (provider) {
    case 'TWITTER':
      return 'twitter'
    case 'FACEBOOK':
      return 'facebook'
    case 'INSTAGRAM':
      return 'instagram'
    case 'LINKEDIN':
      return 'linkedin'
    case 'TIKTOK':
      return 'tiktok'
    case 'YOUTUBE':
      return 'youtube'
    default:
      // SYSTEM (or anything unmapped) is not a real social platform.
      return null
  }
}

/**
 * Build a provider instance from a plaintext credentials object, normalizing the
 * various field-name conventions (workspace `PlatformCredentials` use
 * `clientId`/`clientSecret`; the Meta/TikTok provider configs expect
 * `appId`/`facebookAppId`/`clientKey`). Returns `null` when the credentials lack
 * the required fields — so we never register a half-configured provider that
 * would fail opaquely later.
 */
function buildProviderFromCredentials(
  platform: Platform,
  creds: CredentialBag
): SocialMediaProvider | null {
  switch (platform) {
    case 'twitter': {
      if (!creds.clientId || !creds.clientSecret) return null
      return new TwitterProvider({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        apiKey: creds.apiKey || creds.clientId,
        apiSecret: creds.apiSecret || creds.clientSecret,
        bearerToken: creds.bearerToken || '',
      })
    }
    case 'facebook': {
      const appId = creds.appId || creds.clientId
      const appSecret = creds.appSecret || creds.clientSecret
      if (!appId || !appSecret) return null
      return new FacebookProvider({ appId, appSecret })
    }
    case 'instagram': {
      // Instagram publishes via the Meta Graph app (shared with Facebook).
      const facebookAppId = creds.facebookAppId || creds.appId || creds.clientId
      const facebookAppSecret =
        creds.facebookAppSecret || creds.appSecret || creds.clientSecret
      if (!facebookAppId || !facebookAppSecret) return null
      return new InstagramProvider({ facebookAppId, facebookAppSecret })
    }
    case 'linkedin': {
      if (!creds.clientId || !creds.clientSecret) return null
      return new LinkedInProvider({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      })
    }
    case 'tiktok': {
      const clientKey = creds.clientKey || creds.clientId
      if (!clientKey || !creds.clientSecret) return null
      return new TikTokProvider({ clientKey, clientSecret: creds.clientSecret })
    }
    case 'youtube': {
      if (!creds.clientId || !creds.clientSecret) return null
      return new YouTubeProvider({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        apiKey: creds.apiKey || '',
      })
    }
    default:
      return null
  }
}

/**
 * Resolve a platform's credentials from `process.env` (single-tenant fallback).
 * Returns `null` when the required env vars are unset, so no provider is built.
 */
function envCredentialsFor(platform: Platform): CredentialBag | null {
  switch (platform) {
    case 'twitter':
      if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET)
        return null
      return {
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
      }
    case 'facebook':
      if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET)
        return null
      return {
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
      }
    case 'instagram':
      if (
        !process.env.INSTAGRAM_CLIENT_ID ||
        !process.env.INSTAGRAM_CLIENT_SECRET
      )
        return null
      return {
        clientId: process.env.INSTAGRAM_CLIENT_ID,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      }
    case 'linkedin':
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET)
        return null
      return {
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      }
    case 'tiktok': {
      const clientKey =
        process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID
      if (!clientKey || !process.env.TIKTOK_CLIENT_SECRET) return null
      return { clientKey, clientSecret: process.env.TIKTOK_CLIENT_SECRET }
    }
    case 'youtube':
      if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET)
        return null
      return {
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
        apiKey: process.env.YOUTUBE_API_KEY,
      }
    default:
      return null
  }
}

/** Short-lived cache entry for a per-workspace manager. */
interface CachedManager {
  manager: SocialMediaManager
  expiresAt: number
}

/**
 * Cache of workspace-scoped managers so we do not re-query + re-decrypt
 * `PlatformCredentials` on every call. TTL is deliberately short — long enough
 * to coalesce a burst of operations, short enough that a credential change takes
 * effect promptly.
 */
const managerCache = new Map<string, CachedManager>()
const MANAGER_CACHE_TTL_MS = 60_000

/**
 * Get a `SocialMediaManager` whose providers are built from `workspaceId`'s
 * `PlatformCredentials` (primary), falling back to `process.env` for any
 * platform the workspace has not configured (single-tenant installs).
 *
 * The returned manager's providers are ready for OAuth/publish/analytics calls;
 * it does NOT use the in-memory account cache — callers pass DB-hydrated,
 * decrypted accounts (see `getDecryptedAccount`).
 *
 * Result is cached per workspace for `MANAGER_CACHE_TTL_MS`.
 */
export async function getSocialManager(
  workspaceId: string
): Promise<SocialMediaManager> {
  const now = Date.now()
  const cached = managerCache.get(workspaceId)
  if (cached && cached.expiresAt > now) {
    return cached.manager
  }

  const manager = new SocialMediaManager({ skipEnvInit: true })
  const resolved = new Set<Platform>()

  // 1) Workspace BYO credentials (primary source of truth).
  let rows: Array<{ platform: string; credentials: unknown }> = []
  try {
    rows = await prisma.platformCredentials.findMany({
      where: { workspaceId, isActive: true },
      select: { platform: true, credentials: true },
    })
  } catch (error) {
    // Credential lookup failed — fall through to the env fallback only.
    console.warn(
      `[social] failed to load PlatformCredentials for workspace ${workspaceId}: ${(error as Error).message}`
    )
  }

  for (const row of rows) {
    const platform = dbProviderToPlatform(row.platform)
    if (!platform || resolved.has(platform)) continue
    let creds: CredentialBag | null = null
    try {
      creds = decryptCredentials(row.credentials) as CredentialBag
    } catch (error) {
      // Legacy/unrecoverable secret (ADR-0006 Phase 4 nulls those). Skip it and
      // let the env fallback cover the platform if configured. Never fabricate.
      console.warn(
        `[social] could not decrypt ${platform} credentials for workspace ${workspaceId}; skipping (${(error as Error).message})`
      )
      continue
    }
    const provider = creds ? buildProviderFromCredentials(platform, creds) : null
    if (provider) {
      manager.registerProvider(platform, provider)
      resolved.add(platform)
    }
  }

  // 2) process.env fallback for any platform not resolved per-workspace.
  for (const platform of ALL_PLATFORMS) {
    if (resolved.has(platform)) continue
    const envCreds = envCredentialsFor(platform)
    if (!envCreds) continue
    const provider = buildProviderFromCredentials(platform, envCreds)
    if (provider) manager.registerProvider(platform, provider)
  }

  managerCache.set(workspaceId, {
    manager,
    expiresAt: now + MANAGER_CACHE_TTL_MS,
  })
  return manager
}

/** Invalidate the cached manager for a workspace (e.g. after credential edits). */
export function invalidateSocialManagerCache(workspaceId?: string): void {
  if (workspaceId) managerCache.delete(workspaceId)
  else managerCache.clear()
}

/** Non-sensitive result of a successful token refresh. */
export interface RefreshAccountResult {
  id: string
  status: string
  tokenExpiry: Date | null
}

/**
 * Refresh a stored `SocialAccount`'s OAuth tokens using its provider and persist
 * the ROTATED tokens ENCRYPTED (ADR-0006), updating `tokenExpiry` and `status`.
 *
 * HONEST-FAILURE CONTRACT (ADR-0009): this never fabricates a refreshed state.
 * It returns `success: false` with a clear `error.code`/`error.message` when the
 * account/provider/tokens make a real refresh impossible:
 *   - ACCOUNT_NOT_FOUND        — no such account
 *   - PROVIDER_NOT_SUPPORTED   — the DB provider is not a social platform
 *   - DECRYPT_FAILED           — stored token ciphertext failed to decrypt
 *   - NO_REFRESH_TOKEN         — nothing to refresh with; reconnect required
 *   - PROVIDER_NOT_CONFIGURED  — no workspace/env credentials for this platform
 *   - REFRESH_NOT_SUPPORTED    — provider has no refresh implementation yet
 *   - REFRESH_FAILED / <provider error> — the provider refused the refresh
 * The DB is mutated ONLY on a real, successful rotation.
 */
export async function refreshAccount(
  accountId: string
): Promise<APIResponse<RefreshAccountResult>> {
  const raw = await prisma.socialAccount.findUnique({ where: { id: accountId } })
  if (!raw) {
    return {
      success: false,
      error: { code: 'ACCOUNT_NOT_FOUND', message: 'Social account not found' },
    }
  }

  const platform = dbProviderToPlatform(raw.provider)
  if (!platform) {
    return {
      success: false,
      error: {
        code: 'PROVIDER_NOT_SUPPORTED',
        message: `Provider '${raw.provider}' does not support token refresh`,
      },
    }
  }

  // Decrypt current tokens (ADR-0006). A decrypt failure is a real config/tamper
  // problem, not something a retry fixes.
  let accessToken: string
  let refreshToken: string | undefined
  try {
    accessToken = (decryptToken(raw.accessToken) as string) || ''
    const rt = decryptToken(raw.refreshToken)
    refreshToken = rt ? rt : undefined
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DECRYPT_FAILED',
        message: `Failed to decrypt stored credentials: ${(error as Error).message}`,
      },
    }
  }

  if (!refreshToken) {
    return {
      success: false,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message:
          'No refresh token stored for this account; reconnect the account',
      },
    }
  }

  // Resolve a provider from the account's workspace credentials (BYO → env).
  const manager = await getSocialManager(raw.workspaceId)
  let provider: SocialMediaProvider
  try {
    provider = manager.getProvider(platform)
  } catch {
    return {
      success: false,
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `${platform} is not configured for this workspace (no BYO or environment credentials); cannot refresh token`,
      },
    }
  }

  // Hydrate the provider-layer account from the decrypted DB row.
  const providerAccount: SocialAccount = {
    id: raw.id,
    platform,
    platformId: raw.accountId,
    username: raw.handle,
    displayName: raw.displayName,
    accessToken,
    refreshToken,
    expiresAt: raw.tokenExpiry ?? undefined,
    isConnected: raw.status === 'ACTIVE',
    permissions: raw.scopes,
    metadata: (raw.metadata as Record<string, unknown> | null) ?? undefined,
  }

  // Delegate to the provider's real refresh. Providers without an implementation
  // (Facebook/Instagram/LinkedIn) throw NOT_IMPLEMENTED from the base class —
  // convert that to an honest failure, NEVER a fake success.
  let result: APIResponse<SocialAccount>
  try {
    result = await provider.refreshAccessToken(providerAccount)
  } catch (error) {
    if (error instanceof SocialMediaError && error.code === 'NOT_IMPLEMENTED') {
      return {
        success: false,
        error: {
          code: 'REFRESH_NOT_SUPPORTED',
          message: `Token refresh is not implemented for ${platform}; reconnect the account to obtain fresh tokens`,
        },
      }
    }
    return {
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error instanceof Error ? error.message : 'Token refresh failed',
      },
    }
  }

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error ?? {
        code: 'REFRESH_FAILED',
        message: 'Provider did not return refreshed tokens',
      },
    }
  }

  // Persist the ROTATED tokens ENCRYPTED, refreshing expiry + status. When the
  // provider did not rotate the refresh token, re-encrypt the existing one (this
  // also opportunistically upgrades any legacy plaintext refresh token at rest).
  const rotated = result.data
  const newExpiry = rotated.expiresAt ? new Date(rotated.expiresAt) : null
  const encryptedAccess = encryptToken(rotated.accessToken)
  const encryptedRefresh = rotated.refreshToken
    ? encryptToken(rotated.refreshToken)
    : encryptToken(refreshToken)

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiry: newExpiry,
      status: 'ACTIVE',
    },
  })

  return {
    success: true,
    data: { id: accountId, status: 'ACTIVE', tokenExpiry: newExpiry },
  }
}

// Singleton instance for global use
export const socialMediaManager = new SocialMediaManager()