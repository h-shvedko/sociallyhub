/**
 * @jest-environment node
 *
 * ADR-0025 Track F1 — integration tests for the platform-admin bootstrap
 * seeder (src/lib/seeders/admin-user-seeder.ts) against the REAL dev Postgres.
 *
 * Uses the integration harness's testPrisma (points at the dev DB from
 * .env.local). Every user this suite creates uses a uid()-prefixed
 * @integration.test email so it never collides with seeded data, and is
 * deleted in afterAll. PLATFORM_ADMIN_EMAILS / ADMIN_INITIAL_PASSWORD are
 * snapshotted and restored around each case.
 *
 * NOTE on the "throw when misconfigured" contract: the seeder CREATES missing
 * emails, so a creatable email can never leave zero admins — it never throws
 * for that input. We therefore assert the RETURN contract + created-user
 * fields (grant / create+generated-pw / create+ADMIN_INITIAL_PASSWORD) and the
 * unset-env non-throwing path, which is the observable surface here.
 */
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals'

import bcrypt from 'bcryptjs'

import { seedAdminUser } from '@/lib/seeders/admin-user-seeder'
import { testPrisma, disconnectTestPrisma, uid } from '../utils/integration'

const ORIGINAL_ENV = { ...process.env }
const createdEmails: string[] = []

function setEnv(key: string, value: string) {
  ;(process.env as Record<string, string | undefined>)[key] = value
}
function deleteEnv(key: string) {
  delete (process.env as Record<string, string | undefined>)[key]
}

function newEmail(prefix: string): string {
  const email = `${uid(prefix)}@integration.test`.toLowerCase()
  createdEmails.push(email)
  return email
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
  deleteEnv('PLATFORM_ADMIN_EMAILS')
  deleteEnv('ADMIN_INITIAL_PASSWORD')
})

afterAll(async () => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
  if (createdEmails.length > 0) {
    await testPrisma.user.deleteMany({ where: { email: { in: createdEmails } } })
  }
  await disconnectTestPrisma()
})

describe('seedAdminUser — platform-admin bootstrap', () => {
  it('grants isPlatformAdmin to an EXISTING user listed in PLATFORM_ADMIN_EMAILS', async () => {
    const email = newEmail('adminexist')
    await testPrisma.user.create({
      data: { email, name: 'Existing Non-Admin', emailVerified: new Date(), isPlatformAdmin: false },
    })

    setEnv('PLATFORM_ADMIN_EMAILS', email)
    const res = await seedAdminUser(testPrisma)

    expect(res.admins).toContain(email)
    expect(res.created).not.toContain(email) // existing → not created
    expect(res.generatedPassword).toBeNull() // no new account → nothing generated

    const u = await testPrisma.user.findFirst({ where: { email } })
    expect(u?.isPlatformAdmin).toBe(true)
  })

  it('CREATES a missing user with a generated password (returns it; stores a valid bcrypt hash)', async () => {
    const email = newEmail('admingen')
    deleteEnv('ADMIN_INITIAL_PASSWORD') // force generation

    setEnv('PLATFORM_ADMIN_EMAILS', email)
    const res = await seedAdminUser(testPrisma)

    expect(res.created).toContain(email)
    expect(res.admins).toContain(email)
    expect(typeof res.generatedPassword).toBe('string')
    expect((res.generatedPassword ?? '').length).toBeGreaterThan(0)

    const u = await testPrisma.user.findFirst({ where: { email } })
    expect(u).not.toBeNull()
    expect(u?.isPlatformAdmin).toBe(true)
    expect(u?.emailVerified).not.toBeNull()
    expect(u?.password).toBeTruthy()
    expect((u?.password ?? '').startsWith('$2')).toBe(true) // bcrypt hash prefix
    // The RETURNED plaintext verifies against the STORED hash.
    expect(await bcrypt.compare(res.generatedPassword as string, u!.password as string)).toBe(true)
  })

  it('CREATES a missing user with ADMIN_INITIAL_PASSWORD (does not generate/print a password)', async () => {
    const email = newEmail('adminfixed')
    const supplied = 'Sup3r-Str0ng-Operator-Pw'
    setEnv('ADMIN_INITIAL_PASSWORD', supplied)

    setEnv('PLATFORM_ADMIN_EMAILS', email)
    const res = await seedAdminUser(testPrisma)

    expect(res.created).toContain(email)
    expect(res.generatedPassword).toBeNull() // operator-supplied → not generated

    const u = await testPrisma.user.findFirst({ where: { email } })
    expect(u?.isPlatformAdmin).toBe(true)
    expect(await bcrypt.compare(supplied, u!.password as string)).toBe(true)
  })

  it('when PLATFORM_ADMIN_EMAILS is set, at least one platform admin exists afterwards (no throw)', async () => {
    const email = newEmail('adminatleast')
    setEnv('PLATFORM_ADMIN_EMAILS', email)

    await expect(seedAdminUser(testPrisma)).resolves.toBeDefined()

    const adminCount = await testPrisma.user.count({ where: { isPlatformAdmin: true } })
    expect(adminCount).toBeGreaterThanOrEqual(1)
  })

  it('when PLATFORM_ADMIN_EMAILS is UNSET it does NOT throw and returns empty allowlist arrays', async () => {
    deleteEnv('PLATFORM_ADMIN_EMAILS')
    const res = await seedAdminUser(testPrisma)

    expect(res.admins).toEqual([])
    expect(res.created).toEqual([])
    expect(res.generatedPassword).toBeNull()
  })
})
