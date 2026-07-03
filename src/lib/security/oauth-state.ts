// OAuth state signing & verification (ADR-0005, Phase 4 item 12).
//
// Produces and verifies an HMAC-signed, expiring, identity-bound OAuth `state`
// parameter to defend the social-account connect flow against CSRF / login
// forgery (audit finding #7). Replaces the old `Math.random()` state, which was
// neither cryptographically random, session-bound, nor verified on callback.
//
// INTERIM KEY MANAGEMENT (ADR-0006 will formalize this): the signing key is
// derived from `OAUTH_STATE_SECRET` (preferred) or, as a fallback, the existing
// `NEXTAUTH_SECRET`. ADR-0006 owns secret storage, rotation, and per-purpose key
// derivation; until it lands, this module reads the secret directly from the
// environment and derives a fixed-length key via SHA-256 with a domain-separation
// prefix so it never collides with other uses of NEXTAUTH_SECRET.
//
// Token format: `nonce.expiryMs.hmac`
//   nonce    = 16 random bytes, hex (32 chars)
//   expiryMs = absolute expiry as unix epoch milliseconds (base-10)
//   hmac     = HMAC-SHA256(`nonce|expiryMs|userId|provider`, key), hex
//
// Because userId and provider are inside the signed payload, a token minted for
// one user/provider cannot be replayed for another: recomputing the HMAC with a
// different identity yields a different digest, so verification fails.
//
// Pure Node crypto — no external dependencies.

import crypto from "crypto"

/** Default validity window for a freshly signed state token. */
export const DEFAULT_STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

export interface OAuthStateContext {
  /** The initiating session's user id — binds the state to a single account. */
  userId: string
  /** The social platform the connect flow targets (e.g. "twitter"). */
  provider: string
}

export interface VerifyStateResult {
  valid: boolean
  /** Machine-readable reason when `valid` is false; never surfaced to clients. */
  reason?: "missing" | "malformed" | "signature_mismatch" | "expired"
}

/**
 * Derive the HMAC key from the configured secret. Throws if neither
 * `OAUTH_STATE_SECRET` nor `NEXTAUTH_SECRET` is set — we must never sign or
 * verify with an implicit/empty key (that would defeat the entire mechanism).
 */
function getKey(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      "OAuth state signing key unavailable: set OAUTH_STATE_SECRET or NEXTAUTH_SECRET"
    )
  }
  // Domain-separated SHA-256 so this key is distinct from any other derivation
  // that also happens to read NEXTAUTH_SECRET (ADR-0006 will replace this KDF).
  return crypto.createHash("sha256").update(`oauth-state:v1:${secret}`).digest()
}

function computeHmac(
  nonce: string,
  expiryMs: number,
  ctx: OAuthStateContext
): string {
  const payload = `${nonce}|${expiryMs}|${ctx.userId}|${ctx.provider}`
  return crypto.createHmac("sha256", getKey()).update(payload).digest("hex")
}

/**
 * Sign a state token bound to `ctx` (user + provider), valid for `expiryMs`
 * from now (default 10 minutes). Throws if no signing secret is configured.
 */
export function signState(
  ctx: OAuthStateContext,
  expiryMs: number = DEFAULT_STATE_EXPIRY_MS
): string {
  const nonce = crypto.randomBytes(16).toString("hex")
  const expiry = Date.now() + expiryMs
  const hmac = computeHmac(nonce, expiry, ctx)
  return `${nonce}.${expiry}.${hmac}`
}

/**
 * Verify a state token against the expected `ctx`. Returns `{ valid, reason }`
 * (never throws for malformed input — only the key derivation can throw, which
 * indicates a server misconfiguration the caller should surface as a 500).
 *
 * Checks, in order:
 *  1. structural validity (present, three dot-separated parts, numeric expiry),
 *  2. constant-time HMAC comparison over the bound identity — a mismatch covers
 *     both tampering AND a wrong userId/provider, since those change the payload,
 *  3. expiry (only trusted once the authenticated HMAC has verified it).
 */
export function verifyState(
  token: string | undefined | null,
  ctx: OAuthStateContext
): VerifyStateResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "missing" }
  }

  const parts = token.split(".")
  if (parts.length !== 3) {
    return { valid: false, reason: "malformed" }
  }

  const [nonce, expiryStr, providedHmac] = parts
  const expiryMs = Number(expiryStr)
  if (!nonce || !providedHmac || !Number.isFinite(expiryMs)) {
    return { valid: false, reason: "malformed" }
  }

  const expectedHmac = computeHmac(nonce, expiryMs, ctx)
  const provided = Buffer.from(providedHmac, "hex")
  const expected = Buffer.from(expectedHmac, "hex")

  // timingSafeEqual throws on length mismatch, so guard first. A length
  // mismatch (e.g. truncated/garbage hex) is itself a signature failure.
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return { valid: false, reason: "signature_mismatch" }
  }

  // The HMAC authenticated the expiry value, so it is now safe to trust.
  if (Date.now() > expiryMs) {
    return { valid: false, reason: "expired" }
  }

  return { valid: true }
}
