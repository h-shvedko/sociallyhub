// Application-level encryption at rest (ADR-0006, Phase 1).
//
// Replaces the previous broken implementation, which used the removed
// `crypto.createCipher('aes-256-gcm', key)` primitive (never captured the GCM
// auth tag, never round-tripped) and silently fell back to a hardcoded key.
// This module uses `createCipheriv`/`createDecipheriv` with a random 12-byte IV
// and a captured 16-byte auth tag, and FAILS CLOSED: if `ENCRYPTION_KEY` is
// missing or malformed, the first encrypt/decrypt call throws — there is no
// default key, ever.
//
// ── Ciphertext format ────────────────────────────────────────────────────────
//   enc:v1:<keyId>:<iv_b64url>:<ct_b64url>:<tag_b64url>
//     v1     = AES-256-GCM, 12-byte random IV, 16-byte auth tag
//     keyId  = which key encrypted the value: `k1` = ENCRYPTION_KEY (current),
//              `k0` = ENCRYPTION_KEY_PREVIOUS (decrypt-only, rotation)
//   The `enc:` prefix makes plaintext-vs-ciphertext detection trivial during
//   migration — no legitimate OAuth token or credential begins with `enc:v1:`.
//   The b64url segments use no padding and no `:`, so the value always splits
//   into exactly 6 colon-separated parts. The keyId label is NOT covered by the
//   GCM tag (no AAD); the rotation tooling relies on that to re-select keys.
//
// ── Key management ───────────────────────────────────────────────────────────
//   ENCRYPTION_KEY          (required) 64 hex chars = 32 bytes; `openssl rand -hex 32`.
//   ENCRYPTION_KEY_PREVIOUS (optional) same format; decrypt-only during rotation.
//   New encryptions ALWAYS use ENCRYPTION_KEY and tag `k1`. Key validation is
//   LAZY (first use, not import time) so `next build`/tooling do not need prod
//   secrets; `docker/entrypoint.sh` + `/api/health` assert presence at startup
//   via `isEncryptionConfigured()`.
//
// ── Rotation ─────────────────────────────────────────────────────────────────
//   Set ENCRYPTION_KEY_PREVIOUS = old key, ENCRYPTION_KEY = new key, deploy, run
//   `scripts/rotate-encryption-key.ts` (re-encrypts every row with the current
//   key), then remove ENCRYPTION_KEY_PREVIOUS. See that script's header.
//
// ── Transitional plaintext fallback (REMOVE NEXT RELEASE) ────────────────────
//   `decryptToken()` accepts a NON-`enc:`-prefixed value and returns it as-is
//   with a warning, to bridge the bounded window while `scripts/encrypt-social-
//   tokens.ts` batch-encrypts legacy plaintext SocialAccount tokens (ADR-0006
//   Phase 3). Per ADR-0006 Phase 3 step 10 this fallback MUST be deleted in the
//   next release; after that, non-prefixed tokens are treated as errors.
//
// Never log secret material. Pure Node `crypto`, no dependencies.

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_HEX_RE = /^[0-9a-f]{64}$/i // 64 hex chars => 32 bytes for AES-256

const PREFIX = 'enc'
const VERSION = 'v1'
/** keyId embedded in every value this module writes. */
const CURRENT_KEY_ID = 'k1'
/** Prefix every ciphertext starts with — used for plaintext detection. */
export const CIPHERTEXT_PREFIX = `${PREFIX}:${VERSION}:`

/** Map a keyId to its backing environment variable. Throws on unknown ids. */
function envForKeyId(keyId: string): { name: string; value: string | undefined } {
  switch (keyId) {
    case 'k1':
      return { name: 'ENCRYPTION_KEY', value: process.env.ENCRYPTION_KEY }
    case 'k0':
      return { name: 'ENCRYPTION_KEY_PREVIOUS', value: process.env.ENCRYPTION_KEY_PREVIOUS }
    default:
      throw new Error(`Encryption: unknown keyId '${keyId}' in ciphertext`)
  }
}

/**
 * Resolve and validate the 32-byte key for a keyId. LAZY and uncached — reads
 * the env on every call so rotation / tests that change env vars take effect
 * immediately. FAILS CLOSED: throws (never returns a fallback) if the key is
 * missing or not exactly 64 hex chars.
 */
function getKey(keyId: string): Buffer {
  const { name, value } = envForKeyId(keyId)
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(
      `Encryption: ${name} is not set (required for keyId '${keyId}'). ` +
        'Generate one with `openssl rand -hex 32`. No fallback key exists.'
    )
  }
  if (!KEY_HEX_RE.test(trimmed)) {
    throw new Error(
      `Encryption: ${name} must be 64 hex characters (32 bytes). ` +
        'Generate one with `openssl rand -hex 32`.'
    )
  }
  return Buffer.from(trimmed, 'hex')
}

/**
 * True iff `ENCRYPTION_KEY` is present and correctly shaped. Never throws — for
 * the startup/health check (ADR-0006 Phase 1 step 3) so it can report
 * `encryption: ok|misconfigured` without leaking material or crashing.
 */
export function isEncryptionConfigured(): boolean {
  const value = process.env.ENCRYPTION_KEY?.trim()
  return !!value && KEY_HEX_RE.test(value)
}

/** True iff `value` is one of our `enc:v1:` ciphertext strings. */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CIPHERTEXT_PREFIX)
}

/**
 * Encrypt a UTF-8 string to `enc:v1:k1:<iv>:<ct>:<tag>` (AES-256-GCM). Uses the
 * current key (ENCRYPTION_KEY). Throws if the key is missing/malformed.
 */
export function encryptString(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new Error('Encryption: encryptString expects a string')
  }
  const key = getKey(CURRENT_KEY_ID)
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    PREFIX,
    VERSION,
    CURRENT_KEY_ID,
    iv.toString('base64url'),
    ct.toString('base64url'),
    tag.toString('base64url'),
  ].join(':')
}

/**
 * Decrypt an `enc:v1:<keyId>:...` string. Selects the key by the embedded keyId
 * (k1=ENCRYPTION_KEY, k0=ENCRYPTION_KEY_PREVIOUS). Throws on a malformed value,
 * an unknown/unconfigured keyId, or a failed authentication (tampered
 * ciphertext, tag, or IV — GCM detects all three).
 */
export function decryptString(token: string): string {
  if (typeof token !== 'string' || !token.startsWith(CIPHERTEXT_PREFIX)) {
    throw new Error('Encryption: value is not an enc:v1 ciphertext')
  }
  const parts = token.split(':')
  // enc : v1 : keyId : iv : ct : tag
  if (parts.length !== 6 || parts[0] !== PREFIX || parts[1] !== VERSION) {
    throw new Error('Encryption: malformed ciphertext')
  }
  const [, , keyId, ivB64, ctB64, tagB64] = parts
  const key = getKey(keyId) // throws on unknown/unconfigured keyId

  const iv = Buffer.from(ivB64, 'base64url')
  const ct = Buffer.from(ctB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Encryption: malformed ciphertext (bad IV/tag length)')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  // decipher.final() throws if the tag does not authenticate (tamper/wrong key).
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

/**
 * Encrypt an arbitrary JSON-serializable credentials object to an `enc:v1`
 * string. Signature-compatible with the previous implementation (any -> any):
 * the `/api/platform-credentials` routes store the return value in the
 * `credentials` Json column and read it back through `decryptCredentials`.
 */
export function encryptCredentials(data: any): any {
  return encryptString(JSON.stringify(data))
}

/**
 * Decrypt a value produced by `encryptCredentials`. Legacy rows written by the
 * previous broken scheme (a `{ encrypted, iv, algorithm }` object) are NOT a
 * string and are unrecoverable by construction — they throw a clear error and
 * are cleaned up in ADR-0006 Phase 4.
 */
export function decryptCredentials(token: any): any {
  if (typeof token !== 'string') {
    throw new Error(
      'Encryption: decryptCredentials expected an enc:v1 string. Legacy ' +
        'broken-scheme credentials are unrecoverable (ADR-0006 Phase 4 nulls them).'
    )
  }
  return JSON.parse(decryptString(token))
}

/**
 * Encrypt a single token/secret string for storage. Always produces an
 * `enc:v1:k1:...` value. Thin wrapper over `encryptString`.
 */
export function encryptToken(plaintext: string): string {
  return encryptString(plaintext)
}

/**
 * Decrypt a stored token/secret.
 *
 * TRANSITIONAL (remove next release, ADR-0006 Phase 3 step 10): if `value` is
 * not an `enc:v1` ciphertext it is assumed to be legacy plaintext and returned
 * as-is with a warning, so reads keep working during the bounded window while
 * `scripts/encrypt-social-tokens.ts` back-fills existing rows. After removal,
 * non-prefixed tokens must be treated as errors (account -> TOKEN_EXPIRED).
 */
export function decryptToken(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return value
  }
  if (isEncrypted(value)) {
    return decryptString(value)
  }
  // Bounded transitional plaintext fallback — never logs the secret itself.
  console.warn(
    '[encryption] decryptToken received a non-encrypted (legacy plaintext) ' +
      'token; returning as-is. This fallback is removed next release (ADR-0006 Phase 3). ' +
      'Run scripts/encrypt-social-tokens.ts to back-fill.'
  )
  return value
}

// Utility to mask sensitive values for display (retained verbatim, ADR-0006).
export function maskCredentials(credentials: any): any {
  const masked = { ...credentials }

  // Common sensitive field patterns
  const sensitiveFields = [
    'secret', 'token', 'key', 'password', 'pass',
    'clientSecret', 'apiSecret', 'bearerToken', 'accessToken',
    'refreshToken', 'webhookSecret'
  ]

  for (const [key, value] of Object.entries(masked)) {
    if (typeof value === 'string' && value.length > 0) {
      const isFieldSensitive = sensitiveFields.some(pattern =>
        key.toLowerCase().includes(pattern.toLowerCase())
      )

      if (isFieldSensitive) {
        // Show first 4 and last 4 characters, mask the middle
        if (value.length > 8) {
          masked[key] = `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
        } else {
          masked[key] = '*'.repeat(value.length)
        }
      }
    }
  }

  return masked
}
