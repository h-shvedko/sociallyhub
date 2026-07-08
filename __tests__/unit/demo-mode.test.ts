/**
 * @jest-environment node
 *
 * ADR-0025 Track F1 — the ONE demo switch (src/lib/config/demo.ts).
 *
 * Proves:
 *  - isDemoMode() is true ONLY when DEMO_MODE === 'true' — and that the two
 *    removed backdoors are GONE: NODE_ENV=development does NOT enable demo, and
 *    ENABLE_DEMO='true' does NOT enable demo.
 *  - getDemoCredentialsMessage() is null when demo is off, includes the
 *    DEMO_USER_PASSWORD when demo is on + a password is set, and degrades
 *    HONESTLY (no fabricated password) when demo is on + password unset.
 *  - getPublicDemoConfig() has the { demoMode, credentialsHint } handoff shape.
 *
 * The functions read process.env at CALL time, so each case mutates env and
 * asserts directly — no module isolation needed. Full env is snapshotted and
 * restored around every case (DEMO_MODE / DEMO_USER_PASSWORD / ENABLE_DEMO /
 * NODE_ENV).
 */
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals'

import {
  isDemoMode,
  getDemoCredentialsMessage,
  getPublicDemoConfig,
  DEMO_USER_EMAIL,
} from '@/lib/config/demo'

const ORIGINAL_ENV = { ...process.env }

function setEnv(key: string, value: string) {
  ;(process.env as Record<string, string | undefined>)[key] = value
}
function deleteEnv(key: string) {
  delete (process.env as Record<string, string | undefined>)[key]
}

/** Known baseline: demo off, no demo password, no backdoor vars, NODE_ENV=test. */
function resetDemoEnv() {
  deleteEnv('DEMO_MODE')
  deleteEnv('DEMO_USER_PASSWORD')
  deleteEnv('ENABLE_DEMO')
  setEnv('NODE_ENV', 'test')
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
  resetDemoEnv()
})

afterAll(() => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
})

// ---------------------------------------------------------------------------
// isDemoMode() — DEMO_MODE is the only gate; backdoors are gone
// ---------------------------------------------------------------------------

describe('isDemoMode()', () => {
  it('is false when DEMO_MODE is unset', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('is false when DEMO_MODE="false"', () => {
    setEnv('DEMO_MODE', 'false')
    expect(isDemoMode()).toBe(false)
  })

  it('is true when DEMO_MODE="true"', () => {
    setEnv('DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
  })

  it('is strict: DEMO_MODE="TRUE" (wrong case) does NOT enable demo', () => {
    setEnv('DEMO_MODE', 'TRUE')
    expect(isDemoMode()).toBe(false)
  })

  it('BACKDOOR GONE: NODE_ENV=development without DEMO_MODE does NOT enable demo', () => {
    setEnv('NODE_ENV', 'development')
    expect(isDemoMode()).toBe(false)
  })

  it('BACKDOOR GONE: ENABLE_DEMO="true" without DEMO_MODE does NOT enable demo', () => {
    setEnv('ENABLE_DEMO', 'true')
    expect(isDemoMode()).toBe(false)
  })

  it('BACKDOOR GONE: ENABLE_DEMO="true" + NODE_ENV=development together still do NOT enable demo', () => {
    setEnv('ENABLE_DEMO', 'true')
    setEnv('NODE_ENV', 'development')
    expect(isDemoMode()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getDemoCredentialsMessage() — null off / real pw / honest degrade
// ---------------------------------------------------------------------------

describe('getDemoCredentialsMessage()', () => {
  it('is null when demo mode is off', () => {
    expect(getDemoCredentialsMessage()).toBeNull()
  })

  it('is null when demo is off even if DEMO_USER_PASSWORD is set', () => {
    setEnv('DEMO_USER_PASSWORD', 'super-secret-demo')
    expect(getDemoCredentialsMessage()).toBeNull()
  })

  it('includes the demo email AND the DEMO_USER_PASSWORD when demo is on + password set', () => {
    setEnv('DEMO_MODE', 'true')
    setEnv('DEMO_USER_PASSWORD', 'p@ssw0rd-shown')
    const msg = getDemoCredentialsMessage()
    expect(msg).not.toBeNull()
    expect(msg).toContain(DEMO_USER_EMAIL)
    expect(msg).toContain('p@ssw0rd-shown')
  })

  it('degrades honestly (no fabricated password) when demo is on + password unset', () => {
    setEnv('DEMO_MODE', 'true')
    deleteEnv('DEMO_USER_PASSWORD')
    const msg = getDemoCredentialsMessage()
    expect(msg).not.toBeNull()
    // Points the operator at the env var rather than printing a fake password.
    expect(msg).toContain('DEMO_USER_PASSWORD')
    expect(msg).toContain(DEMO_USER_EMAIL)
    // No "email / password" credential pair is shown.
    expect(msg).not.toMatch(new RegExp(`${DEMO_USER_EMAIL}\\s*/\\s*\\S`))
  })

  it('treats an empty/whitespace DEMO_USER_PASSWORD as unset (honest degrade)', () => {
    setEnv('DEMO_MODE', 'true')
    setEnv('DEMO_USER_PASSWORD', '   ')
    const msg = getDemoCredentialsMessage()
    expect(msg).not.toBeNull()
    expect(msg).toContain('DEMO_USER_PASSWORD')
    // The whitespace value must never leak into the hint as a "password".
    expect(msg).not.toMatch(new RegExp(`${DEMO_USER_EMAIL}\\s*/\\s`))
  })
})

// ---------------------------------------------------------------------------
// getPublicDemoConfig() — server→client handoff shape
// ---------------------------------------------------------------------------

describe('getPublicDemoConfig()', () => {
  it('returns { demoMode:false, credentialsHint:null } when demo is off', () => {
    const cfg = getPublicDemoConfig()
    expect(cfg).toEqual({ demoMode: false, credentialsHint: null })
  })

  it('returns { demoMode:true, credentialsHint:<includes pw> } when demo is on + password set', () => {
    setEnv('DEMO_MODE', 'true')
    setEnv('DEMO_USER_PASSWORD', 'handoff-pw')
    const cfg = getPublicDemoConfig()
    expect(cfg.demoMode).toBe(true)
    expect(typeof cfg.credentialsHint).toBe('string')
    expect(cfg.credentialsHint).toContain('handoff-pw')
    // Shape: exactly the two documented keys.
    expect(Object.keys(cfg).sort()).toEqual(['credentialsHint', 'demoMode'])
  })

  it('mirrors isDemoMode() / getDemoCredentialsMessage() exactly', () => {
    setEnv('DEMO_MODE', 'true')
    const cfg = getPublicDemoConfig()
    expect(cfg.demoMode).toBe(isDemoMode())
    expect(cfg.credentialsHint).toBe(getDemoCredentialsMessage())
  })
})
