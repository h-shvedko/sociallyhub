/**
 * @jest-environment node
 *
 * ADR-0025 Track F1 — idempotency of the minimal-tier settings-defaults seeder
 * (src/lib/seeders/settings-defaults-seeder.ts) against the REAL dev Postgres.
 *
 * The rows this seeder maintains (global SystemConfiguration / SecurityConfig /
 * BackupConfiguration defaults, the three DISABLED deferral FeatureFlags, the
 * 'system' attribution user, system EmailTemplates) are LEGITIMATE idempotent
 * platform rows that the running app relies on — so this suite deliberately
 * does NOT delete them (deleting would remove real seeded state). It proves the
 * seeder is a safe no-op on re-run: running twice creates no duplicate global
 * FeatureFlags and the second run creates zero new flags.
 */
import { describe, it, expect, afterAll } from '@jest/globals'

import { seedSettingsDefaults } from '@/lib/seeders/settings-defaults-seeder'
import { testPrisma, disconnectTestPrisma } from '../utils/integration'

const DEFERRAL_KEYS = ['community', 'documentation-management', 'discord'] as const
const COUNT_KEYS = ['configs', 'flags', 'templates'] as const

afterAll(async () => {
  await disconnectTestPrisma()
})

describe('seedSettingsDefaults — idempotent minimal-tier defaults', () => {
  it('runs twice with no duplicate global FeatureFlags and a zero-create second run', async () => {
    const run1 = await seedSettingsDefaults(testPrisma)

    // Return shape: a numeric counts object.
    for (const k of COUNT_KEYS) {
      expect(typeof run1[k]).toBe('number')
      expect(run1[k]).toBeGreaterThanOrEqual(0)
    }

    // After run1 each GLOBAL deferral flag exists EXACTLY once (nullable-ws
    // @@unique is not upsert-idempotent — the seeder uses findFirst→create).
    for (const key of DEFERRAL_KEYS) {
      const c = await testPrisma.featureFlag.count({ where: { workspaceId: null, key } })
      expect(c).toBe(1)
    }

    const run2 = await seedSettingsDefaults(testPrisma)

    // Idempotency: everything already existed → the second run creates NO flags.
    expect(run2.flags).toBe(0)
    for (const k of COUNT_KEYS) {
      expect(typeof run2[k]).toBe('number')
    }

    // Still exactly one of each global flag — no duplication introduced.
    for (const key of DEFERRAL_KEYS) {
      const c = await testPrisma.featureFlag.count({ where: { workspaceId: null, key } })
      expect(c).toBe(1)
    }
  })

  it('creates the three deferral flags DISABLED (isActive:false), global (workspaceId:null)', async () => {
    await seedSettingsDefaults(testPrisma)
    for (const key of DEFERRAL_KEYS) {
      const flag = await testPrisma.featureFlag.findFirst({ where: { workspaceId: null, key } })
      expect(flag).not.toBeNull()
      expect(flag?.isActive).toBe(false)
      expect(flag?.workspaceId).toBeNull()
    }
  })

  it('ensures the login-disabled "system" attribution user exists (password null)', async () => {
    await seedSettingsDefaults(testPrisma)
    const system = await testPrisma.user.findUnique({ where: { id: 'system' } })
    expect(system).not.toBeNull()
    expect(system?.password).toBeNull() // can never sign in — attribution anchor only
    expect(system?.isPlatformAdmin).toBe(false)
  })
})
