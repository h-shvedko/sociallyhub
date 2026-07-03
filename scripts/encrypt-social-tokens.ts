// One-shot batch encryption of legacy plaintext SocialAccount tokens (ADR-0006 Phase 3).
//
// ── When to run ──────────────────────────────────────────────────────────────
// Once, as a release step, after deploying the code that encrypts tokens on
// write (src/app/api/accounts/callback/route.ts). Because deploys are not atomic
// with this run, decryptToken() also tolerates plaintext during a bounded
// window; re-running this script is safe and closes that window.
//
//   DATABASE_URL=... ENCRYPTION_KEY=<64 hex> npx tsx scripts/encrypt-social-tokens.ts
//   (self-hosted Docker, ADR-0022:
//     docker compose exec app npx tsx scripts/encrypt-social-tokens.ts)
//
// ── What it does ─────────────────────────────────────────────────────────────
// Walks SocialAccount in id-ordered batches and, for every accessToken /
// refreshToken value that does NOT already start with the `enc:v1:` prefix,
// re-writes it as an enc:v1 AES-256-GCM ciphertext via encryptToken(). Values
// already on the current scheme are left untouched.
//
// ── Safety / idempotency ─────────────────────────────────────────────────────
//   * Idempotent: a second run finds every value already `enc:`-prefixed and
//     writes nothing (encrypted=0, skipped=<all>).
//   * null / undefined / empty tokens are left as-is (counted as empty).
//   * `--dry-run` reports the counts without writing.
//   * Never logs secret material — only counts.
//
// Fails closed: exits non-zero if DATABASE_URL or ENCRYPTION_KEY is missing/
// malformed, or if any row update throws. This is NOT rotation (that is
// scripts/rotate-encryption-key.ts); this only encrypts still-plaintext values.

import { PrismaClient } from '@prisma/client'

import { encryptToken, isEncrypted, isEncryptionConfigured } from '../src/lib/encryption'

const prisma = new PrismaClient()

const BATCH = 200
const DRY_RUN = process.argv.includes('--dry-run')

interface FieldStats {
  scanned: number // non-empty values seen
  encrypted: number // plaintext values re-written as enc:v1
  skipped: number // already enc:v1 — left untouched
  empty: number // null / undefined / '' — left as-is
}

const emptyStats = (): FieldStats => ({ scanned: 0, encrypted: 0, skipped: 0, empty: 0 })

const FIELDS = ['accessToken', 'refreshToken'] as const

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('encrypt-social-tokens: DATABASE_URL is not set (export it from .env.local).')
    process.exit(1)
  }
  if (!isEncryptionConfigured()) {
    console.error('encrypt-social-tokens: ENCRYPTION_KEY is missing or malformed (need 64 hex chars).')
    process.exit(1)
  }
  console.log(`encrypt-social-tokens${DRY_RUN ? ' (dry-run: no writes)' : ''} — batch=${BATCH}`)

  const stats = { accessToken: emptyStats(), refreshToken: emptyStats() }
  let rowsScanned = 0
  let rowsWritten = 0
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.socialAccount.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, accessToken: true, refreshToken: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      rowsScanned++
      const data: Record<string, string> = {}

      for (const field of FIELDS) {
        const value = row[field]
        const s = stats[field]
        if (value === null || value === undefined || value === '') {
          s.empty++
          continue
        }
        s.scanned++
        if (isEncrypted(value)) {
          s.skipped++
          continue
        }
        // Legacy plaintext token → encrypt onto the current key.
        s.encrypted++
        data[field] = encryptToken(value)
      }

      if (!DRY_RUN && Object.keys(data).length > 0) {
        await prisma.socialAccount.update({ where: { id: row.id }, data })
        rowsWritten++
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  console.log(`\nSocialAccount — scanned ${rowsScanned} rows`)
  for (const field of FIELDS) {
    const s = stats[field]
    console.log(
      `  ${field.padEnd(14)} values=${s.scanned} encrypted=${s.encrypted} ` +
        `skipped(already enc:)=${s.skipped} empty=${s.empty}`
    )
  }
  const totalEncrypted = stats.accessToken.encrypted + stats.refreshToken.encrypted
  console.log(
    `\nTotals: ${rowsWritten} rows ${DRY_RUN ? 'would be ' : ''}written | ` +
      `${totalEncrypted} token value(s) ${DRY_RUN ? 'would be ' : ''}encrypted`
  )
  if (totalEncrypted === 0) {
    console.log('No plaintext tokens found — every SocialAccount token is already enc:v1.')
  }

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('encrypt-social-tokens failed:', err instanceof Error ? err.message : err)
  await prisma.$disconnect()
  process.exit(1)
})
