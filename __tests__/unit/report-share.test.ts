/**
 * @jest-environment node
 *
 * Unit tests for src/lib/sharing/report-share.ts (ADR-0020 Phase 1 — share
 * token/password/cookie primitives).
 *
 * Pure crypto/time helpers only. resolveUsableShareLink (the DB lookup) is
 * exercised end-to-end by the integration suite
 * (__tests__/api/report-share-links.test.ts) via the public share routes.
 */
import { describe, it, expect, beforeAll } from '@jest/globals'

import crypto from 'crypto'

import {
  generateShareToken,
  hashShareToken,
  isPlausibleShareToken,
  shareLinkExpiry,
  isShareLinkUsable,
  hashSharePassword,
  verifySharePassword,
  buildShareUrl,
  shareAccessCookieName,
  createShareAccessCookieValue,
  verifyShareAccessCookieValue,
  DEFAULT_EXPIRY_DAYS,
} from '@/lib/sharing/report-share'

const DAY_MS = 24 * 60 * 60 * 1000
/** Tolerance for "now + N days" assertions (test runtime slack). */
const CLOCK_SLACK_MS = 10_000

beforeAll(() => {
  // Cookie mint/verify is HMAC-keyed on NEXTAUTH_SECRET (fail-closed without
  // it). jest.setup.js normally provides 'test-secret'; keep a fallback so
  // the suite also runs standalone.
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = 'unit-test-secret'
  }
})

// ---------------------------------------------------------------------------
// Token generation + hashing
// ---------------------------------------------------------------------------

describe('generateShareToken', () => {
  it('produces a base64url token of at least 40 chars (32 random bytes)', () => {
    const { token } = generateShareToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(token.length).toBeLessThanOrEqual(64)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('tokenHash is exactly sha256(token) in lowercase hex', () => {
    const { token, tokenHash } = generateShareToken()
    const expected = crypto.createHash('sha256').update(token, 'utf8').digest('hex')
    expect(tokenHash).toBe(expected)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('100 generations are all unique (tokens AND hashes)', () => {
    const tokens = new Set<string>()
    const hashes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const { token, tokenHash } = generateShareToken()
      tokens.add(token)
      hashes.add(tokenHash)
    }
    expect(tokens.size).toBe(100)
    expect(hashes.size).toBe(100)
  })
})

describe('hashShareToken', () => {
  it('is deterministic: same input → same digest', () => {
    const { token } = generateShareToken()
    expect(hashShareToken(token)).toBe(hashShareToken(token))
  })

  it('different tokens hash to different digests', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(hashShareToken(a.token)).not.toBe(hashShareToken(b.token))
  })
})

// ---------------------------------------------------------------------------
// Plausibility shape check (pre-DB gate)
// ---------------------------------------------------------------------------

describe('isPlausibleShareToken', () => {
  it('accepts a freshly generated token', () => {
    expect(isPlausibleShareToken(generateShareToken().token)).toBe(true)
  })

  it('accepts a 40-char base64url string (lower bound)', () => {
    expect(isPlausibleShareToken('a'.repeat(40))).toBe(true)
  })

  it('rejects the empty string', () => {
    expect(isPlausibleShareToken('')).toBe(false)
  })

  it('rejects short strings', () => {
    expect(isPlausibleShareToken('abc')).toBe(false)
    expect(isPlausibleShareToken('a'.repeat(39))).toBe(false)
  })

  it('rejects over-long strings', () => {
    expect(isPlausibleShareToken('a'.repeat(65))).toBe(false)
  })

  it('rejects non-base64url characters', () => {
    expect(isPlausibleShareToken('!'.repeat(43))).toBe(false)
    expect(isPlausibleShareToken(`${'a'.repeat(42)}+`)).toBe(false)
    expect(isPlausibleShareToken(`${'a'.repeat(42)}/`)).toBe(false)
    expect(isPlausibleShareToken(`${'a'.repeat(42)}=`)).toBe(false)
    expect(isPlausibleShareToken(`${'a'.repeat(21)} ${'a'.repeat(21)}`)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isPlausibleShareToken(null)).toBe(false)
    expect(isPlausibleShareToken(undefined)).toBe(false)
    expect(isPlausibleShareToken(12345)).toBe(false)
    expect(isPlausibleShareToken({})).toBe(false)
    expect(isPlausibleShareToken(['a'.repeat(43)])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Expiry resolution
// ---------------------------------------------------------------------------

describe('shareLinkExpiry', () => {
  it('undefined → the 30-day default', () => {
    const expiry = shareLinkExpiry(undefined)
    expect(expiry).toBeInstanceOf(Date)
    const delta = expiry!.getTime() - Date.now()
    expect(Math.abs(delta - DEFAULT_EXPIRY_DAYS * DAY_MS)).toBeLessThan(CLOCK_SLACK_MS)
  })

  it('explicit null → no expiry (null)', () => {
    expect(shareLinkExpiry(null)).toBeNull()
  })

  it('7 → now + ~7 days', () => {
    const expiry = shareLinkExpiry(7)
    const delta = expiry!.getTime() - Date.now()
    expect(Math.abs(delta - 7 * DAY_MS)).toBeLessThan(CLOCK_SLACK_MS)
  })

  it('caps at 365 days', () => {
    const expiry = shareLinkExpiry(1000)
    const delta = expiry!.getTime() - Date.now()
    expect(Math.abs(delta - 365 * DAY_MS)).toBeLessThan(CLOCK_SLACK_MS)
  })

  it('zero/negative fall back to the 30-day default (route validation rejects them upstream)', () => {
    for (const days of [0, -5]) {
      const expiry = shareLinkExpiry(days)
      const delta = expiry!.getTime() - Date.now()
      expect(Math.abs(delta - DEFAULT_EXPIRY_DAYS * DAY_MS)).toBeLessThan(CLOCK_SLACK_MS)
    }
  })
})

// ---------------------------------------------------------------------------
// Usability
// ---------------------------------------------------------------------------

describe('isShareLinkUsable', () => {
  it('fresh link (future expiry, not revoked) → usable', () => {
    expect(
      isShareLinkUsable({ revokedAt: null, expiresAt: new Date(Date.now() + DAY_MS) })
    ).toBe(true)
  })

  it('revoked link → not usable (even with a future expiry)', () => {
    expect(
      isShareLinkUsable({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + DAY_MS),
      })
    ).toBe(false)
  })

  it('expired link → not usable', () => {
    expect(
      isShareLinkUsable({ revokedAt: null, expiresAt: new Date(Date.now() - 1000) })
    ).toBe(false)
  })

  it('null expiry → usable forever (until revoked)', () => {
    expect(isShareLinkUsable({ revokedAt: null, expiresAt: null })).toBe(true)
  })

  it('honors an injected "now"', () => {
    const expiresAt = new Date('2026-01-01T00:00:00Z')
    const link = { revokedAt: null, expiresAt }
    expect(isShareLinkUsable(link, new Date('2025-12-31T23:59:59Z'))).toBe(true)
    expect(isShareLinkUsable(link, new Date('2026-01-01T00:00:00Z'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Password hash + verify
// ---------------------------------------------------------------------------

describe('share password hashing', () => {
  it('round-trips: hash then verify with the same password', async () => {
    const hash = await hashSharePassword('s3cret-Passw0rd!')
    expect(hash).not.toContain('s3cret-Passw0rd!') // never plaintext
    expect(hash.startsWith('$2')).toBe(true) // bcrypt format
    await expect(verifySharePassword('s3cret-Passw0rd!', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashSharePassword('correct-horse')
    await expect(verifySharePassword('wrong-horse', hash)).resolves.toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe('buildShareUrl', () => {
  it('builds an absolute /share/reports/<token> URL from NEXTAUTH_URL', () => {
    const { token } = generateShareToken()
    const base = (process.env.NEXTAUTH_URL || 'http://localhost:3099').replace(/\/+$/, '')
    expect(buildShareUrl(token)).toBe(`${base}/share/reports/${token}`)
  })
})

// ---------------------------------------------------------------------------
// Password-access cookie mint/verify
// ---------------------------------------------------------------------------

describe('share-access cookie', () => {
  const LINK_ID = 'clnk_test_link_id'

  it('cookie name is sh_access_ + first 16 chars of the token hash', () => {
    const { tokenHash } = generateShareToken()
    expect(shareAccessCookieName(tokenHash)).toBe(`sh_access_${tokenHash.slice(0, 16)}`)
  })

  it('valid mint → verify round-trip', () => {
    const value = createShareAccessCookieValue(LINK_ID)
    expect(verifyShareAccessCookieValue(value, LINK_ID)).toBe(true)
  })

  it('cookie minted for one link does not verify for another', () => {
    const value = createShareAccessCookieValue(LINK_ID)
    expect(verifyShareAccessCookieValue(value, 'clnk_other_link')).toBe(false)
  })

  it('tampered signature fails verification', () => {
    const value = createShareAccessCookieValue(LINK_ID)
    const lastChar = value.slice(-1)
    const tampered = value.slice(0, -1) + (lastChar === 'A' ? 'B' : 'A')
    expect(verifyShareAccessCookieValue(tampered, LINK_ID)).toBe(false)
  })

  it('tampered payload (linkId swap keeping the old signature) fails', () => {
    const value = createShareAccessCookieValue(LINK_ID)
    const [, exp, sig] = value.split('.')
    expect(verifyShareAccessCookieValue(`clnk_other_link.${exp}.${sig}`, 'clnk_other_link')).toBe(
      false
    )
  })

  it('expired cookie (minted with negative ttl) fails verification', () => {
    const value = createShareAccessCookieValue(LINK_ID, -1)
    expect(verifyShareAccessCookieValue(value, LINK_ID)).toBe(false)
  })

  it('malformed values fail verification', () => {
    expect(verifyShareAccessCookieValue('', LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue(null, LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue(undefined, LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue('garbage', LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue('a.b', LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue('a.b.c.d', LINK_ID)).toBe(false)
    expect(verifyShareAccessCookieValue(`${LINK_ID}.notanumber.sig`, LINK_ID)).toBe(false)
  })
})
