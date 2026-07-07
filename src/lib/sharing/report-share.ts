// Report share-link primitives (ADR-0020 Phase 1).
//
// SECURITY MODEL (do not weaken):
// - Tokens are 32 bytes from crypto.randomBytes, base64url (~43 chars),
//   shown ONCE at creation. Only sha256(token) is persisted, so a DB dump
//   yields zero working links (ADR-0006). Never reuse the cuid-default
//   pattern from TeamInvitation.token.
// - The public surface must not become an oracle: unknown, expired, and
//   revoked tokens are indistinguishable (uniform 404) — use
//   resolveUsableShareLink() and branch only on null.
// - Optional passwords are bcrypt-hashed. Successful verification is proven
//   by a short-lived HMAC-signed HttpOnly cookie (NEXTAUTH_SECRET-keyed),
//   NOT by a session — /share and /api/share never touch the auth module.

import crypto from 'crypto'

import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

import type { ReportShareLink } from '@prisma/client'

export const SHARE_TOKEN_BYTES = 32
export const DEFAULT_EXPIRY_DAYS = 30
/** Password-cookie lifetime: 1 hour. */
export const SHARE_ACCESS_COOKIE_TTL_SECONDS = 60 * 60

export interface GeneratedShareToken {
  /** Raw token for the URL — returned to the creator ONCE, never stored. */
  token: string
  /** sha256 hex digest — the only thing persisted. */
  tokenHash: string
}

/** Generate a new share token + its storable hash. */
export function generateShareToken(): GeneratedShareToken {
  const token = crypto.randomBytes(SHARE_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashShareToken(token) }
}

/** sha256 hex of a raw token (the DB lookup key). */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Cheap shape check before any DB lookup: our tokens are base64url and
 * 43 chars (32 bytes). Anything else can 404 immediately without a query.
 */
export function isPlausibleShareToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    token.length >= 40 &&
    token.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  )
}

export async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifySharePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

/**
 * Resolve the expiry for a new link. `undefined` → the 30-day default;
 * explicit `null` → no expiry; a positive day count → now + N days.
 */
export function shareLinkExpiry(expiresInDays?: number | null): Date | null {
  if (expiresInDays === null) return null
  const days =
    typeof expiresInDays === 'number' && expiresInDays > 0
      ? Math.min(expiresInDays, 365)
      : DEFAULT_EXPIRY_DAYS
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

/** Is a link currently usable (not revoked, not expired)? */
export function isShareLinkUsable(
  link: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date()
): boolean {
  if (link.revokedAt) return false
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return false
  return true
}

/**
 * The ONE public-surface lookup: raw token → usable link row, or null.
 * Unknown, malformed, expired, and revoked all return null so callers can
 * only ever produce the uniform 404 (no oracle).
 */
export async function resolveUsableShareLink(
  token: unknown
): Promise<ReportShareLink | null> {
  if (!isPlausibleShareToken(token)) return null
  const link = await prisma.reportShareLink.findUnique({
    where: { tokenHash: hashShareToken(token) },
  })
  if (!link || !isShareLinkUsable(link)) return null
  return link
}

/** Absolute share URL for a raw token. */
export function buildShareUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3099').replace(/\/+$/, '')
  return `${base}/share/reports/${token}`
}

// ---------------------------------------------------------------------------
// Password-verification cookie (proof of bcrypt success, scoped to one link)
// ---------------------------------------------------------------------------

function shareCookieSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    // Fail closed: without a signing key no cookie can be minted or verified.
    throw new Error('NEXTAUTH_SECRET is required to sign share-access cookies')
  }
  return secret
}

function signShareAccess(linkId: string, exp: number): string {
  return crypto
    .createHmac('sha256', shareCookieSecret())
    .update(`${linkId}.${exp}`, 'utf8')
    .digest('base64url')
}

/** Cookie name is derived from the token hash so links never share cookies. */
export function shareAccessCookieName(tokenHash: string): string {
  return `sh_access_${tokenHash.slice(0, 16)}`
}

/** Mint the cookie value: `<linkId>.<expEpochSeconds>.<hmac>`. */
export function createShareAccessCookieValue(
  linkId: string,
  ttlSeconds: number = SHARE_ACCESS_COOKIE_TTL_SECONDS
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${linkId}.${exp}.${signShareAccess(linkId, exp)}`
}

/** Verify a cookie value against a specific link id (constant-time compare). */
export function verifyShareAccessCookieValue(
  value: string | undefined | null,
  linkId: string
): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 3) return false
  const [cookieLinkId, expRaw, sig] = parts
  if (cookieLinkId !== linkId) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false
  const expected = signShareAccess(cookieLinkId, exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
