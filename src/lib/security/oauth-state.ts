// OAuth state signing & verification (ADR-0005 item 12, ADR-0006 Phase 2).
//
// Produces and verifies HMAC-signed, expiring, identity-bound OAuth `state`
// parameters to defend the social-account connect flows against CSRF / login
// forgery (audit finding #7) and against workspace-binding forgery (ADR-0006
// Context §3). Replaces both the old `Math.random()` state (ADR-0005 flow) and
// the bare `JSON.stringify({workspaceId,userId,provider})` state that the
// `/api/accounts` flow trusted verbatim on callback.
//
// This module exposes TWO flavors that share ONE key derivation:
//   * signState / verifyState             — the ADR-0005 `/api/social/connect`
//     flow, where the callback already has the session identity and passes it
//     as `ctx` to re-derive the MAC (identity is bound but not carried in the
//     token; token format `nonce.expiryMs.hmac`).
//   * signAccountState / verifyAccountState — the ADR-0006 `/api/accounts`
//     flow, where the callback has NO session and must recover the trusted
//     {workspaceId, userId, provider} FROM the verified token. The payload is
//     self-contained and integrity-protected; format
//     `base64url(JSON payload).base64url(HMAC)` per ADR-0006 spec.
//
// KEY DERIVATION (ADR-0006 Phase 2): the HMAC key is derived via HKDF-SHA256
// from `NEXTAUTH_SECRET` with `info: 'oauth-state'` — no new secret to manage,
// domain-separated so it never collides with any other use of NEXTAUTH_SECRET.
// `OAUTH_STATE_SECRET` is still honored as an explicit override when set (keeps
// the ADR-0005 deployment contract working), otherwise NEXTAUTH_SECRET is
// canonical. Validation is fail-closed: no key, no signing/verification.
//
// Because userId/provider (ADR-0005) and workspaceId/userId/provider (ADR-0006)
// are inside the signed material, a token minted for one identity/workspace
// cannot be replayed for another: any change to the bound values yields a
// different digest, so verification fails.
//
// Pure Node crypto — no external dependencies.

import crypto from "crypto"

/** Default validity window for a freshly signed state token. */
export const DEFAULT_STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/** Validity window for `/api/accounts` state tokens (ADR-0006: 10 minutes). */
export const ACCOUNT_STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

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
 * Derive the 32-byte HMAC key from the configured secret via HKDF-SHA256 with
 * `info: 'oauth-state'` (ADR-0006 Phase 2). `NEXTAUTH_SECRET` is canonical;
 * `OAUTH_STATE_SECRET` is honored as an explicit override when set. Throws if
 * neither is configured — we must never sign or verify with an implicit/empty
 * key (that would defeat the entire mechanism). Lazy: only called on first
 * sign/verify, so `next build` and tooling do not need the secret at import.
 */
function getKey(): Buffer {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      "OAuth state signing key unavailable: set NEXTAUTH_SECRET (or OAUTH_STATE_SECRET)"
    )
  }
  // HKDF-SHA256 with a fixed, empty salt and an `info` label that
  // domain-separates this key from any other derivation off NEXTAUTH_SECRET.
  const derived = crypto.hkdfSync(
    "sha256",
    secret,
    Buffer.alloc(0),
    "oauth-state",
    32
  )
  return Buffer.from(derived)
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

// ---------------------------------------------------------------------------
// ADR-0006 Phase 2 — `/api/accounts` flow (self-contained, workspace-bound)
// ---------------------------------------------------------------------------

/**
 * The trusted payload carried inside an `/api/accounts` state token. Because
 * the whole serialized payload is HMAC-signed, none of these fields can be
 * altered without invalidating the token — the callback may trust them.
 */
export interface AccountStatePayload {
  /** Workspace the connected account will be bound to (validated at issue). */
  workspaceId: string
  /** The initiating session's user id. */
  userId: string
  /** The social platform the connect flow targets (e.g. "twitter"). */
  provider: string
  /** 16 random bytes (hex) — CSRF nonce / replay differentiator. */
  nonce: string
  /** Issued-at, unix epoch milliseconds. Expiry = iat + ACCOUNT_STATE_EXPIRY_MS. */
  iat: number
}

export interface SignAccountStateContext {
  workspaceId: string
  userId: string
  provider: string
}

export interface VerifyAccountStateResult {
  valid: boolean
  /** The verified, trusted payload — present only when `valid` is true. */
  payload?: AccountStatePayload
  /** Machine-readable reason when `valid` is false; never surfaced to clients. */
  reason?: "missing" | "malformed" | "signature_mismatch" | "expired"
}

/** HMAC-SHA256 over the base64url-encoded payload, itself base64url-encoded. */
function computeAccountMac(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getKey())
    .update(encodedPayload)
    .digest("base64url")
}

/**
 * Sign a self-contained `/api/accounts` state token bound to the given
 * workspace + user + provider. `issuedAt` is injectable purely so tests can
 * mint expired tokens; production callers omit it.
 *
 * Token format (ADR-0006):
 *   base64url(JSON{workspaceId,userId,provider,nonce,iat}) + '.' + base64url(HMAC)
 */
export function signAccountState(
  ctx: SignAccountStateContext,
  issuedAt: number = Date.now()
): string {
  const payload: AccountStatePayload = {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    provider: ctx.provider,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: issuedAt,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  return `${encoded}.${computeAccountMac(encoded)}`
}

/**
 * Verify an `/api/accounts` state token and, on success, return its trusted
 * payload. Never throws for malformed input — only key derivation can throw
 * (server misconfiguration). Order of checks:
 *  1. structural validity (present, exactly two dot-separated parts),
 *  2. constant-time HMAC comparison over the encoded payload (tamper defense —
 *     this is what cryptographically binds workspaceId/userId/provider),
 *  3. payload decode + shape validation,
 *  4. expiry (only trusted once the authenticated MAC has verified it).
 */
export function verifyAccountState(
  token: string | undefined | null
): VerifyAccountStateResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "missing" }
  }

  const parts = token.split(".")
  if (parts.length !== 2) {
    return { valid: false, reason: "malformed" }
  }

  const [encodedPayload, providedMac] = parts
  if (!encodedPayload || !providedMac) {
    return { valid: false, reason: "malformed" }
  }

  const expectedMac = computeAccountMac(encodedPayload)
  const provided = Buffer.from(providedMac, "base64url")
  const expected = Buffer.from(expectedMac, "base64url")

  // timingSafeEqual throws on length mismatch, so guard first. A length
  // mismatch (truncated/garbage) is itself a signature failure.
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return { valid: false, reason: "signature_mismatch" }
  }

  // MAC verified — the encoded payload is authentic; safe to decode & trust.
  let decoded: unknown
  try {
    decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    )
  } catch {
    return { valid: false, reason: "malformed" }
  }

  const payload = decoded as Partial<AccountStatePayload>
  if (
    !payload ||
    typeof payload.workspaceId !== "string" ||
    !payload.workspaceId ||
    typeof payload.userId !== "string" ||
    !payload.userId ||
    typeof payload.provider !== "string" ||
    !payload.provider ||
    typeof payload.nonce !== "string" ||
    !payload.nonce ||
    typeof payload.iat !== "number" ||
    !Number.isFinite(payload.iat)
  ) {
    return { valid: false, reason: "malformed" }
  }

  // The MAC authenticated `iat`, so it is now safe to trust for expiry.
  if (Date.now() - payload.iat > ACCOUNT_STATE_EXPIRY_MS) {
    return { valid: false, reason: "expired" }
  }

  return {
    valid: true,
    payload: {
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      provider: payload.provider,
      nonce: payload.nonce,
      iat: payload.iat,
    },
  }
}
