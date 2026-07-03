// Grant (or revoke) the ADR-0004 platform-admin flag for a single user.
//
// This is the production-grade counterpart to the seed-time
// PLATFORM_ADMIN_EMAILS allowlist (prisma/seed.ts): seeding never runs
// against a production database, so operators use this one-off instead
// (ADR-0004 Phase 0 step 3, ADR-0022 self-hosted deployment runbook).
//
// Usage (host, DATABASE_URL exported from .env.local):
//   npx tsx scripts/grant-platform-admin.ts <email>            # grant
//   npx tsx scripts/grant-platform-admin.ts <email> --revoke   # revoke
//
// Usage (self-hosted Docker deployment, per ADR-0022):
//   docker compose exec app npx tsx scripts/grant-platform-admin.ts admin@example.com
//   docker compose exec app npx tsx scripts/grant-platform-admin.ts admin@example.com --revoke
//
// Exit codes: 0 on success (including no-op re-grants), 1 when the user does
// not exist or arguments are invalid.
//
// NOTE ("claim for UI, DB for API", ADR-0004): API enforcement reads this
// flag from the DB on every request, so a grant/revoke takes effect on the
// API immediately. The session JWT claim (admin UI navigation) refreshes on
// the user's next sign-in / token rotation.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const revoke = args.includes('--revoke')
  const positional = args.filter((arg) => !arg.startsWith('--'))
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--revoke')

  if (positional.length !== 1 || unknownFlags.length > 0) {
    console.error('Usage: npx tsx scripts/grant-platform-admin.ts <email> [--revoke]')
    if (unknownFlags.length > 0) {
      console.error(`Unknown flag(s): ${unknownFlags.join(', ')}`)
    }
    process.exit(1)
  }

  const email = positional[0].trim().toLowerCase()
  const target = !revoke

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  })

  if (!user) {
    console.error(`❌ No user found with email: ${email}`)
    process.exit(1)
  }

  console.log(`User:   ${user.email}${user.name ? ` (${user.name})` : ''}`)
  console.log(`Before: isPlatformAdmin = ${user.isPlatformAdmin}`)

  if (user.isPlatformAdmin === target) {
    console.log(`After:  isPlatformAdmin = ${user.isPlatformAdmin} (no change needed)`)
    return
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: target },
    select: { isPlatformAdmin: true },
  })

  console.log(`After:  isPlatformAdmin = ${updated.isPlatformAdmin}`)
  console.log(`✅ ${target ? 'Granted' : 'Revoked'} platform admin for ${user.email}`)
}

main()
  .catch((error) => {
    console.error('❌ grant-platform-admin failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
