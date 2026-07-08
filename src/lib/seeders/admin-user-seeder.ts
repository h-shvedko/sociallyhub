import type { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * ADR-0025 D3/D4 — MINIMAL tier: platform-admin bootstrap.
 *
 * Grants `User.isPlatformAdmin` (the ADR-0004/0012 two-tier authorization gate)
 * from the `PLATFORM_ADMIN_EMAILS` comma-separated allowlist:
 *   - existing user  → set isPlatformAdmin = true (idempotent).
 *   - missing user   → CREATE it with a password from `ADMIN_INITIAL_PASSWORD`
 *                      (if set) else a fresh `crypto.randomBytes(24).base64url`,
 *                      bcrypt cost 12, emailVerified = now, isPlatformAdmin = true.
 *                      A GENERATED password is printed ONCE with a loud banner
 *                      (there is no forcePasswordChange column — the banner is the
 *                      change-on-first-login signal, per the ADR-0025 contract).
 *
 * Credential policy (ADR-0025 D4): NO committed constant passwords. The only
 * passwords here are operator-supplied (`ADMIN_INITIAL_PASSWORD`) or generated
 * per run and shown once.
 *
 * Fail-loud contract:
 *   - `PLATFORM_ADMIN_EMAILS` SET but zero platform admins exist afterwards
 *     → THROW (a real misconfiguration must not boot silently).
 *   - `PLATFORM_ADMIN_EMAILS` UNSET and zero platform admins exist
 *     → LOUD WARN pointing at scripts/grant-platform-admin.ts, but DO NOT throw
 *     (a fresh install without the env must not brick boot).
 */

function parseAdminEmails(raw: string | undefined): string[] {
  return Array.from(
    new Set(
      (raw ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export async function seedAdminUser(
  prisma: PrismaClient,
): Promise<{ admins: string[]; created: string[]; generatedPassword: string | null }> {
  const emails = parseAdminEmails(process.env.PLATFORM_ADMIN_EMAILS)
  const wasConfigured = emails.length > 0

  const admins: string[] = []
  const created: string[] = []
  // The last GENERATED (not operator-supplied) password, returned as a
  // convenience for the caller. The per-user banner below is the source of
  // truth — when multiple admins are created with generated passwords, each is
  // printed. Null when ADMIN_INITIAL_PASSWORD was supplied or nothing generated.
  let generatedPassword: string | null = null

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD
  const hasSuppliedPassword = !!initialPassword && initialPassword.trim() !== ''

  for (const email of emails) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, isPlatformAdmin: true },
    })

    if (existing) {
      if (!existing.isPlatformAdmin) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { isPlatformAdmin: true },
        })
        console.log(`   🛡️  Granted platform admin to existing user: ${existing.email}`)
      }
      admins.push(existing.email)
      continue
    }

    // Create the admin account.
    const plainPassword = hasSuppliedPassword
      ? (initialPassword as string)
      : randomBytes(24).toString('base64url')
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        password: passwordHash,
        emailVerified: new Date(),
        isPlatformAdmin: true,
      },
    })
    admins.push(email)
    created.push(email)

    if (!hasSuppliedPassword) {
      generatedPassword = plainPassword
      // Loud one-time banner — the ONLY place this secret is ever printed.
      console.log('')
      console.log('==================================================================')
      console.log(`⚠️  SEEDED ADMIN PASSWORD — change on first login: ${email} / ${plainPassword}`)
      console.log('==================================================================')
      console.log('')
    } else {
      console.log(`   🛡️  Created platform admin ${email} using ADMIN_INITIAL_PASSWORD (not printed).`)
    }
  }

  // Assertion: how many platform admins exist now, across the whole DB.
  const adminCount = await prisma.user.count({ where: { isPlatformAdmin: true } })

  if (adminCount === 0) {
    if (wasConfigured) {
      // Emails were configured but no admin resulted — a real misconfiguration.
      throw new Error(
        `PLATFORM_ADMIN_EMAILS was set (${emails.join(', ')}) but no platform admin exists after seeding. ` +
          'Refusing to boot with a broken admin bootstrap.',
      )
    }
    // Unset + zero admins: warn loudly, but do not brick a fresh install.
    console.warn('')
    console.warn('==================================================================')
    console.warn('⚠️  NO PLATFORM ADMIN EXISTS and PLATFORM_ADMIN_EMAILS is unset.')
    console.warn('    The admin dashboard (ADR-0004/0012) will be inaccessible.')
    console.warn('    Set PLATFORM_ADMIN_EMAILS before seeding, or run:')
    console.warn('        npx tsx scripts/grant-platform-admin.ts <email>')
    console.warn('==================================================================')
    console.warn('')
  } else {
    console.log(
      `   ✅ Platform admin bootstrap: ${adminCount} admin(s) in DB; ` +
        `${admins.length} from allowlist (${created.length} newly created).`,
    )
  }

  return { admins, created, generatedPassword }
}
