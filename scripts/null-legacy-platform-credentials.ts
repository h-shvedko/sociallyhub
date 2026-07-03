// One-off cleanup of un-decryptable legacy PlatformCredentials (ADR-0006 Phase 4, step 12).
//
// ── WHY this exists ──────────────────────────────────────────────────────────
// Every PlatformCredentials.credentials value written before the ADR-0006
// Phase 1 crypto rewrite is UNRECOVERABLE by construction. The previous
// src/lib/encryption.ts used the removed `crypto.createCipher('aes-256-gcm')`
// primitive: it never captured the GCM auth tag, generated an IV it never
// passed to the cipher, and silently fell back to a hardcoded key. On Node >= 22
// (this repo runs v23) `createCipher` does not even exist, so those rows are
// stored objects like `{ encrypted, iv, algorithm }` that no key can decrypt —
// decryption NEVER succeeded for any of them. There is nothing to salvage.
//
// So rather than leave dead ciphertext (or accidental plaintext) sitting in the
// DB pretending to be usable credentials, this script nulls the secret blob and
// flips the row into a "needs re-entry" state. The `/api/platform-credentials`
// routes now use the fixed, signature-compatible encryptCredentials/
// decryptCredentials helpers, so any NEW value the owner re-enters round-trips
// correctly (stored as an `enc:v1:...` string). Owners simply re-enter the
// credentials once; nothing of value is lost because nothing was ever readable.
//
// ── Model reality (adapted from the ADR's generic field names) ───────────────
// PlatformCredentials does NOT have separate clientSecret/accessToken/
// refreshToken columns, nor an `isConfigured` flag. All secret material lives in
// a single required `credentials Json` column; the "configured" concept maps to
// `isActive` + `validationStatus`. A cleaned row therefore gets:
//     credentials      -> JSON null (Prisma.JsonNull; the column is non-nullable)
//     isActive         -> false
//     validationStatus -> 'invalid'
//     validationError  -> explanatory note directing re-entry
//     lastValidated    -> null
//
// ── What counts as "legacy / needs cleaning" ─────────────────────────────────
// Any non-null `credentials` value that is NOT one of our `enc:v1:` ciphertext
// strings: broken-scheme objects (`{ encrypted, iv, algorithm }`), raw plaintext
// credential objects, or any non-encrypted string. Properly-encrypted `enc:v1:`
// strings (post-fix writes) and already-nulled rows are left untouched.
//
// ── Safety ───────────────────────────────────────────────────────────────────
//   * Idempotent: a second run finds every row either enc:v1-encrypted or
//     already JSON-null and cleans 0.
//   * `--dry-run` reports what WOULD be cleaned without writing.
//   * Never logs secret material (only platform + workspaceId of cleaned rows).
//   * Setup runs this as a release step (ADR-0006 Phase 4). Do NOT run it here.
//
// Usage:
//   DATABASE_URL=... npx tsx scripts/null-legacy-platform-credentials.ts [--dry-run]
//   (self-hosted Docker, ADR-0022:
//     docker compose exec app npx tsx scripts/null-legacy-platform-credentials.ts)

import { Prisma, PrismaClient } from '@prisma/client'

import { isEncrypted } from '../src/lib/encryption'

const prisma = new PrismaClient()

const BATCH = 200
const DRY_RUN = process.argv.includes('--dry-run')

interface Stats {
  total: number // rows examined
  encrypted: number // enc:v1: string -> left untouched
  alreadyNull: number // credentials already JSON null -> left untouched (idempotent)
  cleaned: number // legacy/plaintext -> nulled + marked needs-re-entry
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      'null-legacy-platform-credentials: DATABASE_URL is not set (export it from .env.local).'
    )
    process.exit(1)
  }

  console.log(
    `null-legacy-platform-credentials${DRY_RUN ? ' (dry-run: no writes)' : ''} — ` +
      'nulling un-decryptable legacy PlatformCredentials (ADR-0006 Phase 4).'
  )

  const stats: Stats = { total: 0, encrypted: 0, alreadyNull: 0, cleaned: 0 }
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.platformCredentials.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, platform: true, workspaceId: true, credentials: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      stats.total++
      const raw = row.credentials

      // Already cleared (JSON null) — idempotent no-op.
      if (raw === null || raw === undefined) {
        stats.alreadyNull++
        continue
      }

      // Properly-encrypted post-fix value — leave it exactly as-is.
      if (isEncrypted(raw)) {
        stats.encrypted++
        continue
      }

      // Everything else is legacy broken-scheme / plaintext — unrecoverable.
      stats.cleaned++
      console.log(
        `  cleaning legacy credentials: platform=${row.platform} workspaceId=${row.workspaceId}`
      )
      if (!DRY_RUN) {
        await prisma.platformCredentials.update({
          where: { id: row.id },
          data: {
            // credentials is a required Json column, so "null it out" == store
            // JSON null (Prisma.JsonNull), not a DB NULL (Prisma.DbNull).
            credentials: Prisma.JsonNull,
            isActive: false,
            validationStatus: 'invalid',
            validationError:
              'Legacy credentials cleared by ADR-0006 cleanup (previous encryption ' +
              'scheme was never decryptable). Please re-enter these credentials.',
            lastValidated: null,
          },
        })
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  console.log(
    `\nPlatformCredentials: examined=${stats.total} ` +
      `encrypted(kept)=${stats.encrypted} alreadyNull(kept)=${stats.alreadyNull} ` +
      `cleaned=${stats.cleaned}${DRY_RUN ? ' (would clean; no writes made)' : ''}`
  )
  if (stats.cleaned === 0) {
    console.log('No legacy credentials found — nothing to clean.')
  } else {
    console.log(
      `${DRY_RUN ? 'Would clear' : 'Cleared'} ${stats.cleaned} legacy row(s). ` +
        'Affected workspace owners must re-enter their platform credentials.'
    )
  }

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(
    'null-legacy-platform-credentials failed:',
    err instanceof Error ? err.message : err
  )
  await prisma.$disconnect()
  process.exit(1)
})
