// Reset a user's password from the command line (ADR-0025 recovery path).
//
// This is the "generated admin password lost" recovery path called out in
// ADR-0025 Risks: the minimal-tier admin-user-seeder and the demo-tier demo
// user print a generated password exactly ONCE. If that output is lost, an
// operator uses this script to set a new one directly against the database.
//
// It sets the password for ANY user (not only platform admins) — the operator
// running it already has DB access — but it WARNS when the target is not a
// platform admin, so a mistyped email is caught before it hands out a login.
//
// Usage (host, DATABASE_URL exported from .env.local or auto-loaded below):
//   npx tsx scripts/reset-admin-password.ts <email>               # generate + print
//   npx tsx scripts/reset-admin-password.ts <email> <newPassword> # set explicit
//
// Usage (self-hosted Docker deployment, per ADR-0022):
//   docker compose exec app npx tsx scripts/reset-admin-password.ts admin@example.com
//
// Exit codes: 0 on success, 1 when the user does not exist or arguments are
// invalid. NO committed constant passwords — a generated one is random per run.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// tsx does NOT auto-load .env.local. Load it minimally when DATABASE_URL is
// absent so the documented bare command Just Works — mirrors prisma/seed-e2e.ts.
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path')
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]*)["']?\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  }
}

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const positional = args.filter((arg) => !arg.startsWith('--'))

  if (positional.length < 1 || positional.length > 2) {
    console.error('Usage: npx tsx scripts/reset-admin-password.ts <email> [newPassword]')
    process.exit(1)
  }

  const email = positional[0].trim().toLowerCase()
  const explicitPassword = positional[1]

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  })

  if (!user) {
    console.error(`❌ No user found with email: ${email}`)
    console.error('   (Nothing was changed. Check the email, or use scripts/grant-platform-admin.ts to create an admin via seeding.)')
    process.exit(1)
  }

  // Use the explicit password if given, otherwise generate a strong random one.
  const generated = explicitPassword === undefined
  const newPassword = explicitPassword ?? crypto.randomBytes(18).toString('base64url')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
  })

  const label = user.name ? `${user.email} (${user.name})` : user.email
  console.log('')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('🔑 PASSWORD RESET — change on next login')
  console.log(`   user:     ${label}`)
  console.log(`   password: ${newPassword}`)
  console.log(`   source:   ${generated ? 'generated (random, shown ONCE — copy it now)' : 'supplied on the command line'}`)
  console.log('════════════════════════════════════════════════════════════════')
  console.log('')

  if (!user.isPlatformAdmin) {
    console.warn(`⚠️  ${user.email} is NOT a platform admin (isPlatformAdmin=false).`)
    console.warn('   If you meant to reset a platform admin, double-check the email.')
    console.warn('   To grant platform-admin: npx tsx scripts/grant-platform-admin.ts ' + user.email)
  }

  console.log(`✅ Password reset for ${user.email}`)
}

main()
  .catch((error) => {
    console.error('❌ reset-admin-password failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
