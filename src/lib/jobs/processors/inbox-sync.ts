import { Job } from 'bullmq'
import { Prisma } from '@prisma/client'
import { JobProcessor, JobResult } from '../queue-manager'
import { prisma } from '@/lib/prisma'
import { decryptAccountTokens } from '@/lib/social/get-decrypted-account'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

// ============================================================================
// ADR-0009 Phase 1.6 — inbox-sync: real inbound ingestion for the social inbox.
//
// This BullMQ processor polls each connected account's recent mentions/replies
// and UPSERTs them into `InboxItem` (+ a 1:1 `Conversation` snapshot), deduped
// by the platform item id via the `@@unique([providerItemId, socialAccountId])`
// constraint. It is the polling half of the ingestion story; the Meta webhook
// receiver (`/api/webhooks/meta`, Phase 2.3) is the push half.
//
// HONESTY OVER COVERAGE (ADR-0009): this NEVER fabricates inbox items. Only
// Twitter/X is polled here (the ADR assigns Twitter to polling and Meta to
// webhooks). Without usable credentials it does NOTHING and never invents data:
//   - demo accounts (metadata.demoAccount) and non-Twitter accounts are skipped,
//   - accounts with no decryptable/expired token are skipped,
//   - a real API failure for an account is recorded and bounded-logged (never
//     per-item spam), and the sweep continues.
// The job returns success (it ran) with a summary; it only fails (→ BullMQ
// retry) on a database/infrastructure error, not on per-account API failures.
//
// LIVE VERIFICATION DEFERRED: exercising the real X mentions endpoint requires a
// paid X API tier + a genuinely connected account. The code is written to the
// documented v2 `GET /2/users/:id/mentions` contract; until credentials exist
// the loop finds no pollable accounts and stays idle.
// ============================================================================

/** Queue that hosts the inbox-sync job (its own worker; see job-scheduler). */
export const INBOX_SYNC_QUEUE = 'inbox-sync'
/** BullMQ job name — must match the enqueued `type` for processor dispatch. */
export const INBOX_SYNC_JOB_NAME = 'inbox_sync'
/** Stable scheduler id for the repeatable (idempotent upsert across restarts). */
export const INBOX_SYNC_SCHEDULER_ID = 'inbox-sync-repeatable'
/** Poll cadence — every 15 minutes (ADR-0009 Phase 1.6). */
export const INBOX_SYNC_INTERVAL_MS = 15 * 60 * 1000

/** X/Twitter v2 mentions endpoint (user-context bearer token). */
const TWITTER_MENTIONS_BASE = 'https://api.twitter.com/2/users'

export interface InboxSyncJobData {
  id: string
  type: 'inbox_sync'
  payload: {
    /** When set, sync only this SocialAccount; otherwise sweep all pollable ones. */
    accountId?: string
    /** Optional workspace scope. */
    workspaceId?: string
  }
  userId?: string
  workspaceId?: string
  createdAt?: string
}

export interface InboxSyncResult {
  candidates: number
  polled: number
  upserted: number
  skipped: number
  failed: number
  skipReasons: Record<string, number>
}

interface TwitterTweetLite {
  id: string
  text?: string
  author_id?: string
  conversation_id?: string
  created_at?: string
}

interface TwitterUserLite {
  id: string
  username?: string
  name?: string
  profile_image_url?: string
}

interface TwitterMentionsResponse {
  data?: TwitterTweetLite[]
  includes?: { users?: TwitterUserLite[] }
  meta?: { result_count?: number; newest_id?: string }
}

/** Aggregate a reason counter so we log a single summary, never per-item spam. */
function bump(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1)
}

export const inboxSyncProcessor: JobProcessor<InboxSyncJobData> = async (
  job: Job<InboxSyncJobData>
): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('inbox_sync_job')
  const payload = job.data?.payload ?? {}
  const { accountId, workspaceId } = payload

  try {
    // Pollable = Twitter (this ADR's polling platform), ACTIVE accounts. Demo and
    // credential-less accounts are filtered inside the loop so they can be counted.
    const accounts = await prisma.socialAccount.findMany({
      where: {
        provider: 'TWITTER',
        status: 'ACTIVE',
        ...(accountId ? { id: accountId } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      },
    })

    let polled = 0
    let upserted = 0
    let skipped = 0
    let failed = 0
    const skipReasons = new Map<string, number>()
    let firstErrorMessage: string | null = null

    for (const acct of accounts) {
      // Skip fabricated demo accounts — they carry no real credentials.
      const meta = (acct.metadata ?? {}) as Record<string, unknown>
      if (meta.demoAccount === true || acct.accountId.startsWith('demo-')) {
        skipped++
        bump(skipReasons, 'demo')
        continue
      }

      // Decrypt the stored token (ADR-0006). A decryption failure is a real
      // config/tamper problem — skip honestly, never poll with a bad token.
      let accessToken: string
      try {
        accessToken = decryptAccountTokens(acct).accessToken
      } catch {
        skipped++
        bump(skipReasons, 'undecryptable_token')
        continue
      }
      if (!accessToken) {
        skipped++
        bump(skipReasons, 'no_token')
        continue
      }
      if (acct.tokenExpiry && acct.tokenExpiry.getTime() <= Date.now()) {
        skipped++
        bump(skipReasons, 'token_expired')
        continue
      }

      try {
        upserted += await syncTwitterMentions(acct, accessToken)
        polled++
      } catch (error) {
        failed++
        if (!firstErrorMessage) {
          firstErrorMessage = error instanceof Error ? error.message : String(error)
        }
        // Bounded logging: record only the first failure in detail; the summary
        // event below carries the aggregate count so we never spam per account.
      }
    }

    if (failed > 0 && firstErrorMessage) {
      ErrorLogger.logExternalServiceError('twitter', new Error(firstErrorMessage), {
        operation: 'inbox_sync_poll',
        failedAccounts: failed,
        note: 'first failure shown; per-account errors aggregated to avoid log spam',
      })
    }

    const result: InboxSyncResult = {
      candidates: accounts.length,
      polled,
      upserted,
      skipped,
      failed,
      skipReasons: Object.fromEntries(skipReasons),
    }

    BusinessLogger.logSystemEvent('inbox_sync_completed', {
      ...result,
      scoped: accountId ? 'single_account' : 'sweep',
      durationMs: timer.getDuration(),
    })
    timer.end({ success: true, ...result })

    return { success: true, result }
  } catch (error) {
    // A database/infrastructure error (not a per-account API failure) → let the
    // job fail so BullMQ retries the whole sweep.
    timer.end({ success: false, error: true })
    ErrorLogger.logUnexpectedError(error as Error, { context: 'inbox_sync_job' })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'inbox-sync failed',
    }
  }
}

type PollableAccount = Prisma.SocialAccountGetPayload<Record<string, never>>

/**
 * Poll one Twitter account's recent mentions and upsert them into the inbox.
 * Uses `since_id` (the newest mention we already stored) so each run ingests
 * only new items. Returns the number of items upserted. Throws on API failure
 * (the caller records it as a per-account failure — the sweep continues).
 */
async function syncTwitterMentions(
  acct: PollableAccount,
  accessToken: string
): Promise<number> {
  // Cursor: the most recently ingested mention id for this account. Tweet ids are
  // monotonic snowflakes, so the newest stored providerItemId is a valid since_id.
  const latest = await prisma.inboxItem.findFirst({
    where: { socialAccountId: acct.id, type: 'MENTION' },
    orderBy: { createdAt: 'desc' },
    select: { providerItemId: true },
  })
  const sinceId = latest?.providerItemId

  const params = new URLSearchParams({
    // First sync: keep the window small so we don't backfill an entire history.
    max_results: sinceId ? '100' : '25',
    'tweet.fields': 'created_at,author_id,conversation_id',
    expansions: 'author_id',
    'user.fields': 'username,name,profile_image_url',
  })
  if (sinceId && /^\d+$/.test(sinceId)) {
    params.set('since_id', sinceId)
  }

  const url = `${TWITTER_MENTIONS_BASE}/${encodeURIComponent(acct.accountId)}/mentions?${params.toString()}`
  // Bound the request so a hung connection can never stall the unattended worker.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new Error(`Twitter mentions request failed: HTTP ${res.status} ${body}`)
  }

  const json = (await res.json()) as TwitterMentionsResponse
  const tweets = json.data ?? []
  if (tweets.length === 0) return 0

  const usersById = new Map<string, TwitterUserLite>()
  for (const u of json.includes?.users ?? []) usersById.set(u.id, u)

  let count = 0
  for (const tweet of tweets) {
    const author = tweet.author_id ? usersById.get(tweet.author_id) : undefined
    await upsertMentionItem(acct, tweet, author)
    count++
  }
  return count
}

/**
 * Upsert a single mention into `InboxItem` + a 1:1 `Conversation` snapshot,
 * deduped by (providerItemId, socialAccountId). Existing rows are left untouched
 * (`update: {}`) so re-polls never overwrite triage state (assignee, status,
 * notes) or churn the stored thread snapshot.
 */
async function upsertMentionItem(
  acct: PollableAccount,
  tweet: TwitterTweetLite,
  author: TwitterUserLite | undefined
): Promise<void> {
  const inboxItem = await prisma.inboxItem.upsert({
    where: {
      providerItemId_socialAccountId: {
        providerItemId: tweet.id,
        socialAccountId: acct.id,
      },
    },
    create: {
      workspaceId: acct.workspaceId,
      socialAccountId: acct.id,
      type: 'MENTION',
      providerThreadId: tweet.conversation_id ?? null,
      providerItemId: tweet.id,
      content: tweet.text ?? '',
      authorName: author?.name ?? null,
      authorHandle: author?.username ? `@${author.username}` : null,
      authorAvatar: author?.profile_image_url ?? null,
      // sentiment intentionally left null — we do NOT fabricate a value here.
      status: 'OPEN',
      tags: [],
    },
    update: {},
    select: { id: true },
  })

  const threadData: Prisma.InputJsonValue = {
    source: 'twitter_mentions_poll',
    providerThreadId: tweet.conversation_id ?? null,
    tweet: {
      id: tweet.id,
      text: tweet.text ?? '',
      author_id: tweet.author_id ?? null,
      conversation_id: tweet.conversation_id ?? null,
      created_at: tweet.created_at ?? null,
    },
  }

  await prisma.conversation.upsert({
    where: { inboxItemId: inboxItem.id },
    create: { inboxItemId: inboxItem.id, threadData },
    update: {},
  })
}
