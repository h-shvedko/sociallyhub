import { Job } from 'bullmq'
import { JobProcessor, JobResult } from '../queue-manager'
import {
  socialMediaManager,
  Platform,
  SocialAccount as ProviderAccount,
  PostOptions,
  MediaItem,
  PublishedPost,
  APIResponse,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  SocialMediaError,
} from '@/services/social-providers'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/encryption'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { notifyUser } from '@/lib/notifications/notify'

// ============================================================================
// ADR-0008 Phase 3 — DB-backed, restart-safe, HONEST publishing processor.
//
// This processor is the single source of truth for what actually happened per
// platform. It NEVER fabricates success. It:
//   1. Loads the Post + its PostVariants + each variant's SocialAccount from the
//      DB (Prisma) — NOT from socialMediaManager's in-memory `accounts` Map,
//      which is empty in any process other than the OAuth callback that filled
//      it (a worker never fills it).
//   2. Skips variants that are already PUBLISHED or carry a providerPostId, so a
//      retry after a partial failure never double-posts a platform that already
//      succeeded (idempotent retry).
//   3. Decrypts the stored access/refresh tokens (ADR-0006 crypto) and checks
//      token expiry before calling the provider.
//   4. Invokes the provider with a DB-hydrated account and CHECKS the returned
//      APIResponse.success — writing the TRUE per-variant outcome:
//        success  → PostVariant.status='PUBLISHED', providerPostId=result.data.*,
//                   publishedAt=now, failureReason=null
//        failure  → PostVariant.status='FAILED', failureReason=<clear string>
//   5. Rolls up Post.status once the job reaches a terminal state.
//   6. Classifies errors: 401/403/validation/provider-not-configured →
//      fail-fast (record FAILED + mark account, no job retry); 429/5xx/network →
//      transient (job returns success:false so BullMQ retries with backoff).
//   7. Fires notifications from ACTUAL counts, exactly once (terminal only).
//
// NOTE ON REAL POSTING: the providers themselves (real HTTP to the platforms)
// are ADR-0009's job and are largely stubs, and demo SocialAccounts carry fake
// tokens. Against those, a publish attempt correctly FAILS the variant honestly
// (e.g. "provider not configured" or a 401 → TOKEN_EXPIRED). That honest failure
// is the correct, testable behavior for this ADR — the pipeline is real even
// while the providers are not yet.
// ============================================================================

/**
 * Post-scheduling job payload. Account/content resolution is DB-first, so the
 * only field the processor strictly needs is `postId`. The remaining fields are
 * retained (optional) for backward compatibility with existing enqueuers
 * (job-scheduler.schedulePost) and are IGNORED by the processor — the DB is the
 * source of truth.
 */
export interface PostSchedulingJobData {
  id: string
  type: 'post_scheduling'
  payload: {
    postId: string
    // Legacy/optional — no longer used for resolution (DB is authoritative):
    content?: {
      text: string
      media?: Array<{ type: 'image' | 'video' | 'gif'; url: string; alt?: string }>
      links?: string[]
    }
    platforms?: Platform[]
    platformSpecificSettings?: { [platform: string]: unknown }
    scheduledFor?: string
    userId?: string
    workspaceId?: string
    accountIds?: { [platform: string]: string }
  }
  userId?: string
  workspaceId?: string
  scheduledFor?: string
}

/** Per-variant outcome for one processing run (used for roll-up + notifications). */
interface VariantOutcome {
  variantId: string
  accountId: string
  platform: Platform | null
  /** Persisted status after this run. */
  finalStatus: 'PUBLISHED' | 'FAILED' | 'PENDING'
  /** True when a transient (retryable) error occurred this run. */
  transient: boolean
  /** True when the variant was actually attempted this run (false = idempotent skip). */
  processed: boolean
  providerPostId?: string
  failureReason?: string
}

export interface PostSchedulingResult {
  postId: string
  postStatus: 'PUBLISHED' | 'FAILED' | 'PENDING'
  totalVariants: number
  published: number
  failed: number
  pending: number
  skipped: number
  variants: Array<{
    variantId: string
    platform: Platform | null
    status: 'PUBLISHED' | 'FAILED' | 'PENDING'
    providerPostId?: string
    failureReason?: string
  }>
}

/** Result of classifying a publish error into a persistence + retry decision. */
interface ErrorClassification {
  /** true → transient: the JOB should be retried by BullMQ. false → permanent. */
  retryable: boolean
  /** Clear, user-facing string written to PostVariant.failureReason. */
  failureReason: string
  /** If set, the SocialAccount status to persist (e.g. TOKEN_EXPIRED on 401). */
  accountStatus?: 'TOKEN_EXPIRED' | 'ERROR' | 'REVOKED'
  /** Retry-After surfaced by the provider (ms), for logging/observability. */
  retryAfterMs?: number
}

/** Map the DB SocialProvider enum (uppercase) to the provider-layer Platform (lowercase). */
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
      // SYSTEM (or anything unmapped) is not a publishable platform.
      return null
  }
}

/** Best-effort mimeType → provider media type. */
function mimeToMediaType(mimeType: string | null | undefined): 'image' | 'video' | 'gif' {
  if (!mimeType) return 'image'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType.startsWith('video/')) return 'video'
  return 'image'
}

/**
 * Core classifier. Inspects whatever signals are available (an HTTP-ish status
 * code parsed from the provider error `code`, a symbolic `code`, an error
 * `name`, and the message) and decides retryable vs permanent, plus any account
 * status side effect. Unknown/unclassified errors default to PERMANENT — we do
 * NOT retry-storm against an error we cannot prove is transient.
 */
function decide(sig: {
  statusCode?: number
  code?: string
  name?: string
  message: string
  retryAfterMs?: number
}): ErrorClassification {
  const { statusCode, code, name, message, retryAfterMs } = sig
  const is = (v: string | undefined, ...vals: string[]) => v != null && vals.includes(v)

  // 1) Rate limited → retry (honor Retry-After when surfaced).
  if (statusCode === 429 || is(code, 'RATE_LIMIT_EXCEEDED', 'RATE_LIMITED') || is(name, 'RateLimitError')) {
    return { retryable: true, failureReason: `Rate limited by platform: ${message}`, retryAfterMs }
  }

  // 2) Unauthorized → token invalid/expired. Fail fast + mark account TOKEN_EXPIRED.
  if (statusCode === 401 || is(code, 'AUTHENTICATION_ERROR') || is(name, 'AuthenticationError')) {
    return {
      retryable: false,
      failureReason: `Authentication failed (token invalid or expired): ${message}`,
      accountStatus: 'TOKEN_EXPIRED',
    }
  }

  // 3) Forbidden → insufficient permissions / revoked. Fail fast + mark account ERROR.
  if (statusCode === 403) {
    return {
      retryable: false,
      failureReason: `Forbidden by platform (insufficient permissions or revoked access): ${message}`,
      accountStatus: 'ERROR',
    }
  }

  // 4) Server errors / network / timeout → transient, retry with backoff.
  if (
    (typeof statusCode === 'number' && statusCode >= 500) ||
    is(name, 'AbortError', 'FetchError', 'TimeoutError') ||
    /network|timeout|timed out|fetch failed|econn|socket hang up|und_err|enotfound|eai_again/i.test(message)
  ) {
    return { retryable: true, failureReason: `Transient network/server error: ${message}`, retryAfterMs }
  }

  // 5) Known permanent conditions.
  if (is(code, 'VALIDATION_ERROR') || is(name, 'ValidationError')) {
    return { retryable: false, failureReason: `Post validation failed: ${message}` }
  }
  if (is(code, 'PROVIDER_NOT_FOUND')) {
    return { retryable: false, failureReason: message }
  }
  if (is(code, 'NOT_IMPLEMENTED')) {
    return { retryable: false, failureReason: `Operation not supported by provider: ${message}` }
  }
  if (is(code, 'ACCOUNT_NOT_FOUND')) {
    return { retryable: false, failureReason: `Account not found: ${message}` }
  }

  // 6) Unknown → permanent (conservative; avoids retry storms on real failures).
  return { retryable: false, failureReason: message || 'Publishing failed' }
}

/** Classify a THROWN error (provider threw instead of returning an envelope). */
function classifyThrown(err: unknown): ErrorClassification {
  const e = (err ?? {}) as { retryAfter?: unknown; code?: unknown; name?: unknown; message?: unknown }
  const retryAfterMs = typeof e.retryAfter === 'number' ? e.retryAfter : undefined
  // instanceof covers same-module errors; name/code duck-typing covers the rest.
  if (err instanceof RateLimitError) {
    return { retryable: true, failureReason: `Rate limited by platform: ${e.message}`, retryAfterMs }
  }
  if (err instanceof AuthenticationError) {
    return {
      retryable: false,
      failureReason: `Authentication failed (token invalid or expired): ${e.message}`,
      accountStatus: 'TOKEN_EXPIRED',
    }
  }
  if (err instanceof ValidationError) {
    return { retryable: false, failureReason: `Post validation failed: ${e.message}` }
  }
  return decide({
    code: typeof e.code === 'string' ? e.code : undefined,
    name: typeof e.name === 'string' ? e.name : undefined,
    message: typeof e.message === 'string' ? e.message : String(err),
    retryAfterMs,
  })
}

/**
 * Classify a failed APIResponse envelope. The provider error `code` may be a
 * numeric HTTP status string ("403", "503") when the provider surfaces
 * makeRequest's non-ok response directly, OR a symbolic code
 * ("POST_CREATION_FAILED") that wraps the real thrown error inside `.details`
 * (e.g. an AuthenticationError / RateLimitError). We therefore inspect both the
 * envelope and its nested `details`.
 */
function classifyApiFailure(result: APIResponse<unknown>): ErrorClassification {
  const err = result.error
  const rawCode = err?.code
  const numeric =
    typeof rawCode === 'string' && /^\d+$/.test(rawCode)
      ? parseInt(rawCode, 10)
      : typeof rawCode === 'number'
        ? rawCode
        : undefined

  const details = err?.details as
    | { name?: unknown; code?: unknown; message?: unknown; retryAfter?: unknown }
    | undefined
  const detailName = typeof details?.name === 'string' ? details.name : undefined
  const detailCode = typeof details?.code === 'string' ? details.code : undefined
  const detailMessage = typeof details?.message === 'string' ? details.message : undefined

  const retryAfterMs =
    (typeof details?.retryAfter === 'number' ? details.retryAfter : undefined) ??
    (typeof result.rateLimit?.retryAfter === 'number' ? result.rateLimit.retryAfter : undefined)

  // Prefer the nested detail's symbolic code when the envelope code is a generic
  // wrapper; keep a non-numeric envelope code otherwise.
  const symbolicCode =
    typeof rawCode === 'string' && !/^\d+$/.test(rawCode) ? rawCode : undefined

  return decide({
    statusCode: numeric,
    code: symbolicCode ?? detailCode,
    name: detailName,
    message: err?.message || detailMessage || 'Publishing failed',
    retryAfterMs,
  })
}

/** Persist a SocialAccount status transition (best-effort; never throws). */
async function markAccountStatus(
  accountId: string,
  status: 'TOKEN_EXPIRED' | 'ERROR' | 'REVOKED'
): Promise<void> {
  try {
    await prisma.socialAccount.update({ where: { id: accountId }, data: { status } })
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'mark_account_status',
      accountId,
      status,
    })
  }
}

/**
 * ADR-0010 producer recipient resolution. A publish job is enqueued with the
 * acting user's id, but `Post` itself has no `userId` column — so when the job
 * carries no user (e.g. a system-triggered run) we fall back to the workspace
 * OWNER so the notification still reaches a real person. Returns null only when
 * there is neither a job user nor a resolvable workspace owner.
 */
async function resolvePostNotifyRecipient(
  userId: string | undefined,
  workspaceId: string | undefined
): Promise<string | null> {
  if (userId) return userId
  if (!workspaceId) return null
  const owner = await prisma.userWorkspace.findFirst({
    where: { workspaceId, role: 'OWNER' },
    select: { userId: true },
  })
  return owner?.userId ?? null
}

/**
 * Publish ONE variant and persist its truthful outcome. Returns a descriptor for
 * roll-up + notifications. Never throws — a transient error is recorded and
 * surfaced via `outcome.transient` so the caller can decide whether to fail the
 * job (triggering a BullMQ retry).
 *
 * @param isLastAttempt when true, a transient failure is persisted as FAILED
 *   (terminal) instead of being left PENDING for another retry — so a variant is
 *   never stuck PENDING after retries are exhausted.
 */
async function publishVariant(
  variant: {
    id: string
    text: string | null
    hashtags: string[]
    platformData: unknown
    status: string
    providerPostId: string | null
    socialAccount: {
      id: string
      provider: string
      accountId: string
      handle: string
      displayName: string
      accessToken: string
      refreshToken: string | null
      tokenExpiry: Date | null
      scopes: string[]
      status: string
      metadata: unknown
    } | null
  },
  postBaseContent: string | null,
  media: MediaItem[],
  isLastAttempt: boolean,
  now: Date
): Promise<VariantOutcome> {
  const dbAccount = variant.socialAccount
  const platform = dbAccount ? dbProviderToPlatform(dbAccount.provider) : null

  // (2) Idempotent skip — already published on a prior attempt. Never re-post.
  if (variant.status === 'PUBLISHED' || variant.providerPostId) {
    return {
      variantId: variant.id,
      accountId: dbAccount?.id ?? '',
      platform,
      finalStatus: 'PUBLISHED',
      transient: false,
      processed: false,
      providerPostId: variant.providerPostId ?? undefined,
    }
  }

  // Helper to persist a permanent failure and (optionally) mark the account.
  const failPermanent = async (
    reason: string,
    accountStatus?: 'TOKEN_EXPIRED' | 'ERROR' | 'REVOKED'
  ): Promise<VariantOutcome> => {
    await prisma.postVariant.update({
      where: { id: variant.id },
      data: { status: 'FAILED', failureReason: reason },
    })
    if (dbAccount && accountStatus) await markAccountStatus(dbAccount.id, accountStatus)
    return {
      variantId: variant.id,
      accountId: dbAccount?.id ?? '',
      platform,
      finalStatus: 'FAILED',
      transient: false,
      processed: true,
      failureReason: reason,
    }
  }

  // Helper to persist a transient failure. On the last attempt it becomes
  // terminal FAILED; otherwise the variant stays PENDING (with an informational
  // failureReason) so the next retry re-attempts only it.
  const failTransient = async (
    reason: string,
    accountStatus?: 'TOKEN_EXPIRED' | 'ERROR' | 'REVOKED'
  ): Promise<VariantOutcome> => {
    if (isLastAttempt) {
      await prisma.postVariant.update({
        where: { id: variant.id },
        data: { status: 'FAILED', failureReason: `${reason} (retries exhausted)` },
      })
    } else {
      await prisma.postVariant.update({
        where: { id: variant.id },
        data: { failureReason: `${reason} (will retry)` },
      })
    }
    if (dbAccount && accountStatus) await markAccountStatus(dbAccount.id, accountStatus)
    return {
      variantId: variant.id,
      accountId: dbAccount?.id ?? '',
      platform,
      finalStatus: isLastAttempt ? 'FAILED' : 'PENDING',
      transient: true,
      processed: true,
      failureReason: reason,
    }
  }

  // Guard: variant with no account, or an unpublishable provider.
  if (!dbAccount) {
    return failPermanent('Social account for this variant no longer exists')
  }
  if (!platform) {
    return failPermanent(`Provider '${dbAccount.provider}' is not a publishable platform`)
  }

  // Account-level status gates (revoked/error accounts fail fast, no provider call).
  if (dbAccount.status === 'REVOKED') {
    return failPermanent('Social account access has been revoked; reconnect the account')
  }

  // Decrypt tokens (ADR-0006). Decryption failure = a real config/tamper problem,
  // not something a re-post fixes → permanent.
  let accessToken: string
  let refreshToken: string | undefined
  try {
    accessToken = (decryptToken(dbAccount.accessToken) as string) || ''
    const rt = decryptToken(dbAccount.refreshToken)
    refreshToken = rt ? rt : undefined
  } catch (error) {
    return failPermanent(
      `Failed to decrypt stored credentials: ${(error as Error).message}`,
      'ERROR'
    )
  }
  if (!accessToken) {
    return failPermanent('No access token stored for this account', 'TOKEN_EXPIRED')
  }

  // (2 cont.) Token expiry check — expired tokens fail the variant; provider
  // refresh is ADR-0009 scope, so we mark the account and do NOT retry.
  if (dbAccount.tokenExpiry && dbAccount.tokenExpiry.getTime() <= now.getTime()) {
    return failPermanent(
      `Access token expired at ${dbAccount.tokenExpiry.toISOString()}; reconnect the account`,
      'TOKEN_EXPIRED'
    )
  }

  // Hydrate the provider-layer account object entirely from the DB row.
  const account: ProviderAccount = {
    id: dbAccount.id,
    platform,
    platformId: dbAccount.accountId,
    username: dbAccount.handle,
    displayName: dbAccount.displayName,
    accessToken,
    refreshToken,
    expiresAt: dbAccount.tokenExpiry ?? undefined,
    isConnected: dbAccount.status === 'ACTIVE',
    permissions: dbAccount.scopes,
    metadata: (dbAccount.metadata as Record<string, unknown> | null) ?? undefined,
  }

  // Build provider PostOptions from the variant (DB is source of truth).
  const options: PostOptions = {
    text: variant.text ?? postBaseContent ?? '',
    media,
    hashtags: variant.hashtags,
    ...(variant.platformData && typeof variant.platformData === 'object'
      ? { settings: { [platform]: variant.platformData } as unknown as PostOptions['settings'] }
      : {}),
  }

  // Resolve the provider. getProvider THROWS when the platform is not configured
  // (no API credentials in env) — the common demo/dev case. That is a permanent,
  // honest failure, not a retry.
  let result: APIResponse<PublishedPost>
  try {
    const provider = socialMediaManager.getProvider(platform)
    // Call the provider DIRECTLY with the DB-hydrated account, bypassing the
    // in-memory accounts Map (which a worker never populates).
    result = await provider.createPost(account, options)
  } catch (error) {
    if (error instanceof SocialMediaError && error.code === 'PROVIDER_NOT_FOUND') {
      return failPermanent(
        `${platform} provider is not configured (missing API credentials)`
      )
    }
    const cls = classifyThrown(error)
    ErrorLogger.logExternalServiceError(platform, error as Error, {
      operation: 'publish_variant',
      variantId: variant.id,
      accountId: dbAccount.id,
      retryable: cls.retryable,
    })
    return cls.retryable
      ? failTransient(cls.failureReason, cls.accountStatus)
      : failPermanent(cls.failureReason, cls.accountStatus)
  }

  // (3) CHECK APIResponse.success — the whole point of this rewrite.
  if (result.success && result.data) {
    // providerPostId is the REAL id from result.data (platformPostId preferred),
    // NOT a field off the envelope.
    const providerPostId = result.data.platformPostId || result.data.id
    await prisma.postVariant.update({
      where: { id: variant.id },
      data: {
        status: 'PUBLISHED',
        providerPostId,
        publishedAt: now,
        failureReason: null,
      },
    })
    BusinessLogger.logSystemEvent('post_variant_published', {
      variantId: variant.id,
      platform,
      providerPostId,
      accountId: dbAccount.id,
    })
    return {
      variantId: variant.id,
      accountId: dbAccount.id,
      platform,
      finalStatus: 'PUBLISHED',
      transient: false,
      processed: true,
      providerPostId,
    }
  }

  // Defensive: provider reported success but returned no data — treat as failure,
  // never fabricate a published state.
  if (result.success && !result.data) {
    return failPermanent('Provider reported success but returned no post data')
  }

  // Failure envelope → classify and persist the truthful outcome.
  const cls = classifyApiFailure(result)
  ErrorLogger.logExternalServiceError(
    platform,
    new Error(cls.failureReason),
    {
      operation: 'publish_variant',
      variantId: variant.id,
      accountId: dbAccount.id,
      retryable: cls.retryable,
      retryAfterMs: cls.retryAfterMs,
    }
  )
  return cls.retryable
    ? failTransient(cls.failureReason, cls.accountStatus)
    : failPermanent(cls.failureReason, cls.accountStatus)
}

/**
 * Single-post publishing processor. Registered by job-scheduler / the worker as
 * ('post-scheduling', 'post_scheduling'). Loads everything from the DB, publishes
 * each variant honestly, rolls up Post.status, and decides retry via the job
 * result (success:false → BullMQ retries with the queue's configured backoff).
 */
export const postSchedulingProcessor: JobProcessor<PostSchedulingJobData> = async (
  job: Job<PostSchedulingJobData>
): Promise<JobResult> => {
  const now = new Date()
  const payload = job.data?.payload
  const postId = payload?.postId
  const userId = job.data?.userId ?? payload?.userId
  const workspaceId = job.data?.workspaceId ?? payload?.workspaceId

  const timer = PerformanceLogger.startTimer('post_scheduling_job')

  // This is the last configured attempt when attemptsMade+1 reaches opts.attempts.
  const configuredAttempts = job.opts?.attempts ?? 1
  const isLastAttempt = job.attemptsMade + 1 >= configuredAttempts

  const baseMetrics = () => ({
    duration: timer.getDuration(),
    memoryUsage: process.memoryUsage().heapUsed,
    timestamp: new Date().toISOString(),
  })

  try {
    if (!postId) {
      timer.end({ success: false, error: true })
      // No postId = malformed job; retrying cannot help.
      return { success: true, result: { skipped: 'no-post-id' }, metrics: baseMetrics() }
    }

    // (1) Load Post + variants + each variant's SocialAccount + media assets.
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        variants: { include: { socialAccount: true } },
        assets: { include: { asset: true } },
      },
    })

    if (!post) {
      // Post was deleted between enqueue and execution — terminal, no retry.
      BusinessLogger.logSystemEvent('post_scheduling_post_missing', { postId })
      timer.end({ success: true, postId, skipped: 'post-not-found' })
      return { success: true, result: { postId, skipped: 'post-not-found' }, metrics: baseMetrics() }
    }

    if (post.variants.length === 0) {
      timer.end({ success: true, postId, skipped: 'no-variants' })
      return { success: true, result: { postId, skipped: 'no-variants' }, metrics: baseMetrics() }
    }

    // Build shared media list once from the post's attached assets.
    const media: MediaItem[] = post.assets.map((pa) => ({
      id: pa.asset.id,
      type: mimeToMediaType(pa.asset.mimeType),
      url: pa.asset.url,
      thumbnailUrl: pa.asset.thumbnailUrl ?? undefined,
      width: pa.asset.width ?? undefined,
      height: pa.asset.height ?? undefined,
      size: pa.asset.size ?? undefined,
    }))

    BusinessLogger.logSystemEvent('post_scheduling_started', {
      postId,
      workspaceId,
      variants: post.variants.length,
      attempt: job.attemptsMade + 1,
      isLastAttempt,
    })

    // Publish each variant sequentially (per-variant DB writes make partial
    // progress durable across crashes/retries).
    const outcomes: VariantOutcome[] = []
    for (const variant of post.variants) {
      const outcome = await publishVariant(
        variant,
        post.baseContent,
        media,
        isLastAttempt,
        now
      )
      outcomes.push(outcome)
    }

    // Aggregate real outcomes.
    const published = outcomes.filter((o) => o.finalStatus === 'PUBLISHED').length
    const failed = outcomes.filter((o) => o.finalStatus === 'FAILED').length
    const pending = outcomes.filter((o) => o.finalStatus === 'PENDING').length
    const skipped = outcomes.filter((o) => !o.processed).length
    const processedCount = outcomes.filter((o) => o.processed).length
    const hasTransient = outcomes.some((o) => o.transient)

    // The job is terminal (won't be retried) when there is no transient failure,
    // or when we've exhausted attempts. Only then do we roll up Post.status and
    // fire notifications — so both happen exactly once, not on every retry.
    const willRetry = hasTransient && !isLastAttempt
    const isTerminal = !willRetry

    // Reported post status for this run. Overwritten below in every branch.
    let postStatus: 'PUBLISHED' | 'FAILED' | 'PENDING' = 'PENDING'
    if (isTerminal) {
      // All published (or already published) → PUBLISHED; all failed → FAILED;
      // mixed → PUBLISHED (per-variant detail is the source of truth, ADR-0008).
      if (published > 0) {
        postStatus = 'PUBLISHED'
        await prisma.post.update({
          where: { id: postId },
          data: { status: 'PUBLISHED', publishedAt: post.publishedAt ?? now },
        })
      } else {
        postStatus = 'FAILED'
        await prisma.post.update({ where: { id: postId }, data: { status: 'FAILED' } })
      }
    } else {
      postStatus = 'PENDING'
    }

    const result: PostSchedulingResult = {
      postId,
      postStatus,
      totalVariants: outcomes.length,
      published,
      failed,
      pending,
      skipped,
      variants: outcomes.map((o) => ({
        variantId: o.variantId,
        platform: o.platform,
        status: o.finalStatus,
        providerPostId: o.providerPostId,
        failureReason: o.failureReason,
      })),
    }

    // (6) Notifications fire from ACTUAL outcomes, only at terminal state, and
    // only when something was actually attempted this run (no spam on no-op
    // retries where every variant was already published).
    if (isTerminal && processedCount > 0) {
      const recipient = await resolvePostNotifyRecipient(userId, workspaceId)
      if (recipient) {
        const publishedPlatforms = outcomes
          .filter((o) => o.finalStatus === 'PUBLISHED' && o.processed)
          .map((o) => o.platform)
          .filter(Boolean)
        const failedDetails = outcomes
          .filter((o) => o.finalStatus === 'FAILED')
          .map((o) => ({ platform: o.platform, error: o.failureReason }))

        // A single, truthful notification per terminal run (ADR-0010). Nothing
        // published (with something processed) ⇒ PUBLISH_FAILED; otherwise
        // PUBLISH_SUCCESS (mixed counts roll up to success per ADR-0008). The
        // notify path is persist-first + best-effort: a Redis/enqueue hiccup must
        // never fail an already-persisted publish outcome.
        const allFailed = published === 0
        try {
          await notifyUser(recipient, {
            type: allFailed ? 'PUBLISH_FAILED' : 'PUBLISH_SUCCESS',
            title: allFailed ? 'Post publishing failed' : 'Post published',
            message: allFailed
              ? `Publishing failed on ${failed} platform${failed > 1 ? 's' : ''}.`
              : `Your post was published to ${published} platform${published > 1 ? 's' : ''}.` +
                (failed > 0 ? ` ${failed} platform${failed > 1 ? 's' : ''} failed.` : ''),
            data: {
              postId,
              published,
              failed,
              total: outcomes.length,
              publishedPlatforms,
              failedDetails,
              actionUrl: `/dashboard/posts/${postId}`,
            },
          })
        } catch (notifyError) {
          ErrorLogger.logUnexpectedError(notifyError as Error, {
            context: 'post_scheduling_notify',
            postId,
            workspaceId,
          })
        }
      }
    }

    timer.end({ success: !willRetry, postId, published, failed, pending })
    BusinessLogger.logSystemEvent('post_scheduling_completed', {
      postId,
      workspaceId,
      published,
      failed,
      pending,
      skipped,
      postStatus,
      willRetry,
      duration: timer.getDuration(),
    })

    if (willRetry) {
      // Returning success:false makes the queue-manager wrapper throw, so BullMQ
      // retries the whole job with its configured backoff. On retry, already-
      // PUBLISHED variants are skipped — only PENDING/FAILED are re-attempted, so
      // no platform is ever double-posted.
      //
      // NOTE (Retry-After): the provider may surface a Retry-After (recorded in
      // the failureReason/logs above). Honoring it precisely would require
      // job.moveToDelayed, which needs the BullMQ job token — the worker wrapper
      // (queue-manager, not this file) does not pass it. Until that seam exists,
      // retry timing follows the queue's exponential backoff, which is a safe
      // floor. This is intentionally in queue-manager's scope, not this phase's.
      return {
        success: false,
        error: `Transient failure on ${pending} variant(s); scheduled for retry`,
        result,
        metrics: baseMetrics(),
      }
    }

    return { success: true, result, metrics: baseMetrics() }
  } catch (error) {
    // Unexpected error (e.g. DB unavailable). Let BullMQ retry — this is
    // infrastructure-transient, and per-variant writes already persisted any
    // partial success, so a retry is safe (idempotent skip on published ones).
    timer.end({ success: false, error: true, postId })
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'post_scheduling_job',
      postId,
      userId,
      workspaceId,
    })
    return { success: false, error: (error as Error).message, metrics: baseMetrics() }
  }
}

// ============================================================================
// Bulk post scheduling processor
//
// Aligned with the DB-backed single processor: it now only needs each post's id,
// delegating all resolution/publishing to `postSchedulingProcessor`. True
// per-post queue-level retry (each post as its own job) is ADR-0008 step 10
// (route bulk publishing through the queue); this inline delegation preserves the
// existing batch behavior in the meantime while remaining honest about outcomes.
// ============================================================================

export interface BulkPostSchedulingJobData {
  id: string
  type: 'bulk_post_scheduling'
  payload: {
    posts: Array<{ postId: string }>
    userId?: string
    workspaceId?: string
    batchId: string
  }
  userId?: string
  workspaceId?: string
}

export const bulkPostSchedulingProcessor: JobProcessor<BulkPostSchedulingJobData> = async (
  job: Job<BulkPostSchedulingJobData>
): Promise<JobResult> => {
  const payload = job.data?.payload
  const posts = payload?.posts ?? []
  const userId = job.data?.userId ?? payload?.userId
  const workspaceId = job.data?.workspaceId ?? payload?.workspaceId
  const batchId = payload?.batchId

  const timer = PerformanceLogger.startTimer('bulk_post_scheduling_job')

  try {
    const results: Array<{ postId: string; success: boolean; result?: unknown; error?: string }> = []
    const totalPosts = posts.length
    let successfulPosts = 0
    let failedPosts = 0

    for (const [index, post] of posts.entries()) {
      try {
        await job.updateProgress(Math.round(((index + 1) / Math.max(1, totalPosts)) * 100))

        // Delegate to the single processor with a minimal, DB-first payload.
        const postJob = {
          ...job,
          data: {
            id: `post_${post.postId}`,
            type: 'post_scheduling' as const,
            payload: { postId: post.postId, userId, workspaceId },
            userId,
            workspaceId,
          },
        } as unknown as Job<PostSchedulingJobData>

        const postResult = await postSchedulingProcessor(postJob)

        results.push({
          postId: post.postId,
          success: postResult.success,
          result: postResult.result,
          error: postResult.error,
        })

        if (postResult.success) successfulPosts++
        else failedPosts++
      } catch (error) {
        results.push({ postId: post.postId, success: false, error: (error as Error).message })
        failedPosts++
      }
    }

    // Batch notification from real counts (ADR-0010 producer, persist-first,
    // best-effort). All posts failed ⇒ PUBLISH_FAILED; otherwise PUBLISH_SUCCESS.
    const recipient = await resolvePostNotifyRecipient(userId, workspaceId)
    if (recipient) {
      try {
        await notifyUser(recipient, {
          type: successfulPosts === 0 && failedPosts > 0 ? 'PUBLISH_FAILED' : 'PUBLISH_SUCCESS',
          title: 'Bulk publishing completed',
          message: `${successfulPosts} of ${totalPosts} posts processed successfully.`,
          data: {
            batchId,
            totalPosts,
            successfulPosts,
            failedPosts,
            actionUrl: `/dashboard/posts?batch=${batchId}`,
          },
        })
      } catch (notifyError) {
        ErrorLogger.logUnexpectedError(notifyError as Error, {
          context: 'bulk_post_scheduling_notify',
          batchId,
          workspaceId,
        })
      }
    }

    timer.end({ success: true, batchId, totalPosts, successfulPosts, failedPosts })

    return {
      success: true,
      result: { batchId, totalPosts, successfulPosts, failedPosts, results },
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    timer.end({ success: false, error: true, batchId })
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'bulk_post_scheduling_job',
      batchId,
      userId,
      workspaceId,
      totalPosts: posts.length,
    })
    return {
      success: false,
      error: (error as Error).message,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString(),
      },
    }
  }
}
