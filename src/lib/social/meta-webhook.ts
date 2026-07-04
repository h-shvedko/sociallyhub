// Meta (Facebook Pages + Instagram) webhook helpers — ADR-0009 Phase 2.3.
//
// PURE, dependency-light functions used by the `/api/webhooks/meta` receiver.
// Kept free of Next.js, Prisma, and any I/O so they are directly unit-testable
// against simulated payloads and signatures (the receiver route itself is only
// fully verifiable end-to-end once a live Meta app + public subscription exist,
// which is DEFERRED — but every branch here is exercisable in-process today).
//
// Two responsibilities, both HONEST (never fabricate, never mask failure):
//   1. verifyMetaSignature — validate `X-Hub-Signature-256` against the raw
//      request body using HMAC-SHA256 keyed by the Meta App Secret, in constant
//      time (crypto.timingSafeEqual). Fails CLOSED on any missing/malformed
//      input, so an unsigned or tampered payload can never be trusted.
//   2. mapMetaEventToInboxItems — translate a verified Meta webhook payload into
//      normalized inbox candidates. It does NOT touch the DB; it emits an
//      `accountRef` (the page / IG-account id from `entry.id`) that the route
//      resolves to a `SocialAccount`, and a stable `providerItemId` the route
//      dedupes on via the `@@unique([providerItemId, socialAccountId])` index.
//
// Reference payload shapes (Meta Graph API webhooks):
//   Facebook Page feed:  { object:'page', entry:[{ id:PAGE_ID, changes:[{ field:'feed',
//                          value:{ item:'comment', verb:'add', comment_id, post_id,
//                          message, from:{ id, name }, parent_id } }] }] }
//   Facebook mention:    field:'mention', value:{ post_id, comment_id, sender_id,
//                          sender_name, item, verb }
//   Facebook Messenger:  entry:[{ id:PAGE_ID, messaging:[{ sender:{ id }, recipient:{ id },
//                          message:{ mid, text, is_echo } }] }]
//   Instagram comments:  { object:'instagram', entry:[{ id:IG_ID, changes:[{ field:'comments',
//                          value:{ id, text, from:{ id, username }, media:{ id },
//                          parent_id } }] }] }
//   Instagram mentions:  field:'mentions', value:{ comment_id, media_id }
//   Instagram DMs:       entry:[{ id:IG_ID, messaging:[{ sender:{ id }, message:{ mid, text } }] }]

import crypto from "crypto"

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Validate a Meta `X-Hub-Signature-256` header against the raw request body.
 *
 * Meta signs the EXACT raw bytes it POSTed: `sha256=` + hex(HMAC-SHA256(rawBody,
 * appSecret)). The comparison is constant-time and fails closed on every
 * anomaly (no header, no secret, wrong prefix, wrong length, bad hex). Callers
 * MUST verify BEFORE parsing the body — a `false` result means "do not trust,
 * do not parse".
 *
 * `rawBody` must be the untouched bytes (pass a Buffer to avoid any
 * re-encoding); a string is UTF-8 encoded for hashing, which matches Meta only
 * when the payload was UTF-8 (it always is), so Buffer is preferred.
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined
): boolean {
  if (!appSecret || typeof appSecret !== "string") return false
  if (!signatureHeader || typeof signatureHeader !== "string") return false

  const prefix = "sha256="
  if (!signatureHeader.startsWith(prefix)) return false

  const providedHex = signatureHeader.slice(prefix.length)
  // A valid SHA-256 hex digest is 64 lowercase hex chars. Reject early on any
  // malformed hex so `Buffer.from(..,'hex')` can't silently truncate.
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) return false

  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")

  const provided = Buffer.from(providedHex, "hex")
  const expected = Buffer.from(expectedHex, "hex")
  // Lengths are both 32 here, but guard anyway — timingSafeEqual throws on
  // mismatch. A length mismatch is itself a verification failure.
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(provided, expected)
}

/**
 * Constant-time string comparison for the GET subscription `hub.verify_token`.
 * Fails closed when either side is empty. Not signature-grade, but avoids
 * leaking the token length/prefix through early-exit timing.
 */
export function timingSafeStringEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

// ---------------------------------------------------------------------------
// Payload → normalized inbox candidates
// ---------------------------------------------------------------------------

/** Inbox item kinds this receiver produces (subset of the `InboxItemType` enum). */
export type MetaInboxType = "COMMENT" | "MENTION" | "DIRECT_MESSAGE"

/**
 * One normalized inbox candidate extracted from a webhook payload. Field names
 * mirror `InboxItem` columns; `provider` + `accountRef` let the route resolve
 * the owning `SocialAccount` (by `provider` + `accountId === accountRef`), and
 * `providerItemId` is the dedupe key within that account.
 */
export interface MappedMetaInboxItem {
  /** Owning platform — FACEBOOK for `object:'page'`, INSTAGRAM for `object:'instagram'`. */
  provider: "FACEBOOK" | "INSTAGRAM"
  /** `entry.id`: the Page id / IG-business-account id → `SocialAccount.accountId`. */
  accountRef: string
  /** Maps to `InboxItem.type`. */
  type: MetaInboxType
  /** Platform comment/message id → `InboxItem.providerItemId` (dedupe key). */
  providerItemId: string
  /** Parent post/media/conversation id → `InboxItem.providerThreadId`. */
  providerThreadId: string | null
  /** Text body → `InboxItem.content` ('' when the event carries no text yet). */
  content: string
  authorName: string | null
  authorHandle: string | null
  authorAvatar: string | null
}

/**
 * Change verbs that represent a removal/hide rather than new inbound
 * engagement — skipped so we never create inbox rows for deletions.
 */
const SKIP_VERBS = new Set([
  "remove",
  "delete",
  "hide",
  "unhide",
  "block",
  "unblock",
])

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * Translate a verified Meta webhook payload into normalized inbox candidates.
 *
 * Pure and defensive: unknown `object`s, malformed entries, non-comment feed
 * items (likes/reactions/shares), and removal verbs all yield nothing rather
 * than throwing. Returns `[]` for anything it cannot confidently ingest.
 */
export function mapMetaEventToInboxItems(
  payload: unknown
): MappedMetaInboxItem[] {
  const root = asRecord(payload)
  if (!root) return []

  const object = asString(root.object)
  let provider: "FACEBOOK" | "INSTAGRAM" | null = null
  if (object === "page") provider = "FACEBOOK"
  else if (object === "instagram") provider = "INSTAGRAM"
  if (!provider) return []

  const entries = Array.isArray(root.entry) ? root.entry : []
  const items: MappedMetaInboxItem[] = []

  for (const entryRaw of entries) {
    const entry = asRecord(entryRaw)
    if (!entry) continue
    const accountRef = asString(entry.id)
    if (!accountRef) continue

    // Feed / comment / mention change events.
    if (Array.isArray(entry.changes)) {
      for (const changeRaw of entry.changes) {
        const change = asRecord(changeRaw)
        if (!change) continue
        const field = asString(change.field)
        const value = asRecord(change.value)
        if (!field || !value) continue
        const mapped =
          provider === "FACEBOOK"
            ? mapFacebookChange(accountRef, field, value)
            : mapInstagramChange(accountRef, field, value)
        if (mapped) items.push(mapped)
      }
    }

    // Messenger / Instagram Direct message events.
    if (Array.isArray(entry.messaging)) {
      for (const msgRaw of entry.messaging) {
        const msg = asRecord(msgRaw)
        if (!msg) continue
        const mapped = mapMessagingEvent(provider, accountRef, msg)
        if (mapped) items.push(mapped)
      }
    }
  }

  return items
}

function isSkippedVerb(value: Record<string, unknown>): boolean {
  const verb = asString(value.verb)
  return !!verb && SKIP_VERBS.has(verb.toLowerCase())
}

function mapFacebookChange(
  accountRef: string,
  field: string,
  value: Record<string, unknown>
): MappedMetaInboxItem | null {
  if (isSkippedVerb(value)) return null

  if (field === "feed") {
    // Only comments become inbox items; skip likes, reactions, shares, statuses.
    if (asString(value.item) !== "comment") return null
    const providerItemId = asString(value.comment_id)
    if (!providerItemId) return null
    const from = asRecord(value.from)
    return {
      provider: "FACEBOOK",
      accountRef,
      type: "COMMENT",
      providerItemId,
      providerThreadId: asString(value.post_id),
      content: asString(value.message) ?? "",
      authorName: from ? asString(from.name) : null,
      authorHandle: from ? asString(from.id) : null,
      authorAvatar: null,
    }
  }

  if (field === "mention") {
    const providerItemId =
      asString(value.comment_id) ?? asString(value.post_id)
    if (!providerItemId) return null
    return {
      provider: "FACEBOOK",
      accountRef,
      type: "MENTION",
      providerItemId,
      providerThreadId: asString(value.post_id),
      content: asString(value.message) ?? "",
      authorName: asString(value.sender_name),
      authorHandle: asString(value.sender_id),
      authorAvatar: null,
    }
  }

  return null
}

function mapInstagramChange(
  accountRef: string,
  field: string,
  value: Record<string, unknown>
): MappedMetaInboxItem | null {
  if (isSkippedVerb(value)) return null

  if (field === "comments") {
    const providerItemId = asString(value.id)
    if (!providerItemId) return null
    const from = asRecord(value.from)
    const media = asRecord(value.media)
    return {
      provider: "INSTAGRAM",
      accountRef,
      type: "COMMENT",
      providerItemId,
      providerThreadId: media ? asString(media.id) : null,
      content: asString(value.text) ?? "",
      // IG comment webhooks expose `from.username`; the numeric id is the handle
      // fallback the route can later enrich via Graph API.
      authorName: from ? asString(from.username) : null,
      authorHandle: from ? asString(from.id) : null,
      authorAvatar: null,
    }
  }

  if (field === "mentions") {
    // IG mention webhooks carry only ids; the text is fetched later via Graph
    // API. We still record an honest, empty-content placeholder so the mention
    // is not lost — never fabricated text.
    const providerItemId =
      asString(value.comment_id) ?? asString(value.media_id)
    if (!providerItemId) return null
    return {
      provider: "INSTAGRAM",
      accountRef,
      type: "MENTION",
      providerItemId,
      providerThreadId: asString(value.media_id),
      content: "",
      authorName: null,
      authorHandle: null,
      authorAvatar: null,
    }
  }

  return null
}

function mapMessagingEvent(
  provider: "FACEBOOK" | "INSTAGRAM",
  accountRef: string,
  msg: Record<string, unknown>
): MappedMetaInboxItem | null {
  const message = asRecord(msg.message)
  if (!message) return null
  // Ignore echoes of messages the page/account itself sent.
  if (message.is_echo === true) return null
  const providerItemId = asString(message.mid)
  if (!providerItemId) return null
  const sender = asRecord(msg.sender)
  const senderId = sender ? asString(sender.id) : null
  return {
    provider,
    accountRef,
    type: "DIRECT_MESSAGE",
    providerItemId,
    // Conversation is keyed by the sender PSID / IGSID.
    providerThreadId: senderId,
    content: asString(message.text) ?? "",
    authorName: null,
    authorHandle: senderId,
    authorAvatar: null,
  }
}
