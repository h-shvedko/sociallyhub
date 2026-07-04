// Meta (Facebook Pages + Instagram) webhook receiver — ADR-0009 Phase 2.3.
//
// PUBLIC endpoint (Meta calls it server-to-server; there is no session) but
// token- and signature-gated. Two verbs:
//
//   GET  — Meta subscription verification handshake. Meta appends
//          `hub.mode=subscribe`, `hub.verify_token=<the value you configured in
//          the App dashboard>`, `hub.challenge=<random>`. We echo the raw
//          `hub.challenge` as text/plain 200 iff the mode is `subscribe` AND the
//          token matches `META_WEBHOOK_VERIFY_TOKEN` (constant-time). Otherwise
//          403. Fails closed when the env var is unset.
//
//   POST — Event delivery. We read the RAW body, validate
//          `X-Hub-Signature-256 = sha256=HMAC-SHA256(rawBody, META_APP_SECRET)`
//          BEFORE parsing. Invalid/missing signature → 401 (never parsed).
//          Valid → parse, map to normalized inbox candidates
//          (`mapMetaEventToInboxItems`), resolve each candidate's owning
//          `SocialAccount` by (provider, accountId=entry.id), and UPSERT
//          `InboxItem` rows deduped on the `@@unique([providerItemId,
//          socialAccountId])` index. Always answer 200 fast once the signature
//          verified — Meta retries aggressively on non-200, so ingestion is
//          best-effort-with-logging rather than a source of retry storms.
//
// Security (ADR-0005): signature verified before parse; body size-limited;
// `X-Robots-Tag: noindex` + `Cache-Control: no-store` already applied by
// `src/middleware.ts`. No session, no CSRF surface (server-to-server, HMAC).
//
// DEFERRED (needs a live Meta app; out of scope for this phase): calling Meta to
// SUBSCRIBE a page/IG account to this endpoint, and Graph-API enrichment of
// mention/DM events that arrive id-only. This file is the RECEIVER and is fully
// testable today via simulated signed payloads.

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  mapMetaEventToInboxItems,
  verifyMetaSignature,
  timingSafeStringEqual,
  type MappedMetaInboxItem,
} from "@/lib/social/meta-webhook"

// Needs Node crypto + Prisma — not the edge runtime. Never cache.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Hard ceiling on the webhook body (ADR-0005). Meta payloads are small (KBs). */
const MAX_WEBHOOK_BYTES = 1_000_000 // 1 MB

// ---------------------------------------------------------------------------
// GET — subscription verification handshake
// ---------------------------------------------------------------------------

export function GET(request: NextRequest): NextResponse {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (
    mode === "subscribe" &&
    verifyToken &&
    timingSafeStringEqual(token, verifyToken)
  ) {
    // Echo the challenge verbatim as plain text — this is what Meta expects.
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  // Wrong mode, wrong/absent token, or unconfigured server → refuse. No detail.
  return new NextResponse("Forbidden", { status: 403 })
}

// ---------------------------------------------------------------------------
// POST — event delivery
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    // Fail closed: without the secret we cannot verify anything, so we must not
    // accept — but this is a server misconfiguration, not a bad caller.
    console.error(
      "[webhooks/meta] META_APP_SECRET is not configured; cannot verify signatures"
    )
    return NextResponse.json(
      { error: "Webhook not configured", code: "WEBHOOK_NOT_CONFIGURED" },
      { status: 503 }
    )
  }

  // Cheap pre-read guard on the declared size (ADR-0005).
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json(
      { error: "Payload too large", code: "PAYLOAD_TOO_LARGE" },
      { status: 413 }
    )
  }

  // Read the RAW bytes untouched — the signature is over these exact bytes.
  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body", code: "BAD_REQUEST" },
      { status: 400 }
    )
  }

  // Post-read size enforcement (in case content-length was absent/lying).
  if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json(
      { error: "Payload too large", code: "PAYLOAD_TOO_LARGE" },
      { status: 413 }
    )
  }

  // Verify BEFORE parsing. A missing/invalid signature is never trusted.
  const signature = request.headers.get("x-hub-signature-256")
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json(
      { error: "Invalid signature", code: "INVALID_SIGNATURE" },
      { status: 401 }
    )
  }

  // Signature valid → safe to parse.
  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload", code: "BAD_REQUEST" },
      { status: 400 }
    )
  }

  const candidates = mapMetaEventToInboxItems(payload)

  // Best-effort ingestion; NEVER let it turn a verified delivery into a non-200
  // (Meta would retry-storm). Errors are logged, not surfaced.
  let ingested = 0
  try {
    ingested = await ingestInboxItems(candidates)
  } catch (err) {
    console.error("[webhooks/meta] ingestion error (acknowledged anyway):", err)
  }

  // Acknowledge fast. `received`/`ingested` aid local debugging; Meta ignores
  // the body and only cares about the 200.
  return NextResponse.json({
    ok: true,
    received: candidates.length,
    ingested,
  })
}

// ---------------------------------------------------------------------------
// Ingestion — resolve accounts, upsert InboxItem rows
// ---------------------------------------------------------------------------

/**
 * Resolve each candidate's owning `SocialAccount`(s) and upsert an `InboxItem`.
 *
 * A single Meta page/IG account may be connected in more than one workspace
 * (the `SocialAccount` unique key includes `workspaceId`), so a webhook event
 * fans out to every matching account. Resolution is cached per
 * `(provider, accountRef)` to keep the DB round-trips minimal. Candidates whose
 * account is not connected here are silently skipped (not our page/account).
 */
async function ingestInboxItems(
  candidates: MappedMetaInboxItem[]
): Promise<number> {
  if (candidates.length === 0) return 0

  // Batch-resolve every referenced account once.
  type Account = { id: string; workspaceId: string }
  const accountCache = new Map<string, Account[]>()
  const keyOf = (c: MappedMetaInboxItem) => `${c.provider}:${c.accountRef}`

  const uniqueRefs = new Map<
    string,
    { provider: "FACEBOOK" | "INSTAGRAM"; accountRef: string }
  >()
  for (const c of candidates) {
    uniqueRefs.set(keyOf(c), { provider: c.provider, accountRef: c.accountRef })
  }

  for (const [key, { provider, accountRef }] of uniqueRefs) {
    const accounts = await prisma.socialAccount.findMany({
      where: { provider, accountId: accountRef },
      select: { id: true, workspaceId: true },
    })
    accountCache.set(key, accounts)
  }

  let ingested = 0
  for (const c of candidates) {
    const accounts = accountCache.get(keyOf(c)) ?? []
    if (accounts.length === 0) {
      // Event for a page/account we don't have connected. Honest no-op.
      continue
    }

    for (const account of accounts) {
      try {
        await prisma.inboxItem.upsert({
          where: {
            providerItemId_socialAccountId: {
              providerItemId: c.providerItemId,
              socialAccountId: account.id,
            },
          },
          create: {
            workspaceId: account.workspaceId,
            socialAccountId: account.id,
            type: c.type,
            providerItemId: c.providerItemId,
            providerThreadId: c.providerThreadId,
            content: c.content,
            authorName: c.authorName,
            authorHandle: c.authorHandle,
            authorAvatar: c.authorAvatar,
            status: "OPEN",
          },
          // On re-delivery, refresh mutable fields but DO NOT reopen/reassign a
          // triaged item (leave status/assignee/notes as the team left them).
          update: {
            content: c.content,
            authorName: c.authorName,
            authorHandle: c.authorHandle,
            authorAvatar: c.authorAvatar,
            providerThreadId: c.providerThreadId,
          },
        })
        ingested += 1
      } catch (err) {
        console.error(
          `[webhooks/meta] failed to upsert inbox item ${c.providerItemId} for account ${account.id}:`,
          err
        )
      }
    }
  }

  return ingested
}
