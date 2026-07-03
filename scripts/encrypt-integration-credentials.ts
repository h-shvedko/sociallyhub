// Back-fill: encrypt existing IntegrationSetting secrets at rest (ADR-0006 Phase 4).
//
// The admin integration routes now encrypt `credentials` and `webhookSecret`
// on every write (POST/PUT). This one-shot script encrypts rows that predate
// that change — anything still stored as raw JSON / plaintext.
//
// ── When to run ──────────────────────────────────────────────────────────────
// As a release step, once, after deploying the Phase 4 route changes:
//     DATABASE_URL=... ENCRYPTION_KEY=<64 hex> \
//       npx tsx scripts/encrypt-integration-credentials.ts
//   (self-hosted Docker, ADR-0022:
//     docker compose exec app npx tsx scripts/encrypt-integration-credentials.ts)
//   Add --dry-run to report counts without writing.
//
// ── What it does ─────────────────────────────────────────────────────────────
// Walks integration_settings in id-ordered batches. For each row:
//   * credentials (Json?)     — a legacy raw object OR plaintext string is
//                               JSON-serialized then AES-256-GCM encrypted via
//                               encryptCredentials(); an `enc:v1:` value is left
//                               as-is; null is left as-is.
//   * webhookSecret (String?) — a plaintext string is encrypted via
//                               encryptString(); an `enc:v1:` value or null is
//                               left as-is.
// The decrypt path (`decryptCredentials` in .../[id]/test/route.ts) inverts
// exactly this, so encrypted and not-yet-encrypted rows both keep working during
// the transition window.
//
// ── Safety / idempotency ─────────────────────────────────────────────────────
//   * Idempotent: a second run finds every value already `enc:v1:` and writes
//     nothing (0 encrypted).
//   * Never logs secret material. Prints per-field counts only.
//   * Fails closed: exits 1 if DATABASE_URL or ENCRYPTION_KEY is missing/malformed.
//
// Exit code 0 = completed; 1 = misconfigured environment or an encryption error.

import { PrismaClient } from '@prisma/client'

import {
  encryptCredentials,
  encryptString,
  isEncrypted,
  isEncryptionConfigured,
} from '../src/lib/encryption'

const prisma = new PrismaClient()

const BATCH = 200
const DRY_RUN = process.argv.includes('--dry-run')

interface FieldStats {
  scanned: number // non-null values seen
  encrypted: number // newly encrypted this run
  alreadyEncrypted: number // already enc:v1: — left as-is
}

const emptyStats = (): FieldStats => ({ scanned: 0, encrypted: 0, alreadyEncrypted: 0 })

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      'encrypt-integration-credentials: DATABASE_URL is not set (export it from .env.local).'
    )
    process.exit(1)
  }
  if (!isEncryptionConfigured()) {
    console.error(
      'encrypt-integration-credentials: ENCRYPTION_KEY is missing or malformed (need 64 hex chars). ' +
        'Generate one with `openssl rand -hex 32`. No fallback key exists.'
    )
    process.exit(1)
  }

  console.log(
    `encrypt-integration-credentials${DRY_RUN ? ' (dry-run: no writes)' : ''} — ` +
      'back-filling IntegrationSetting.credentials + webhookSecret'
  )

  const credStats = emptyStats()
  const secretStats = emptyStats()
  let rowsWritten = 0
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.integrationSetting.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, credentials: true, webhookSecret: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const data: { credentials?: any; webhookSecret?: string } = {}

      // credentials (Json?) — object or string; skip null.
      const cred = row.credentials
      if (cred !== null && cred !== undefined) {
        credStats.scanned++
        if (isEncrypted(cred)) {
          credStats.alreadyEncrypted++
        } else {
          data.credentials = encryptCredentials(cred)
          credStats.encrypted++
        }
      }

      // webhookSecret (String?) — skip null/empty.
      const secret = row.webhookSecret
      if (secret) {
        secretStats.scanned++
        if (isEncrypted(secret)) {
          secretStats.alreadyEncrypted++
        } else {
          data.webhookSecret = encryptString(secret)
          secretStats.encrypted++
        }
      }

      if (Object.keys(data).length > 0) {
        rowsWritten++
        if (!DRY_RUN) {
          await prisma.integrationSetting.update({ where: { id: row.id }, data })
        }
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  console.log(
    `\ncredentials    scanned=${credStats.scanned} encrypted=${credStats.encrypted} ` +
      `alreadyEncrypted=${credStats.alreadyEncrypted}`
  )
  console.log(
    `webhookSecret  scanned=${secretStats.scanned} encrypted=${secretStats.encrypted} ` +
      `alreadyEncrypted=${secretStats.alreadyEncrypted}`
  )
  console.log(
    `\nRows ${DRY_RUN ? 'that would be ' : ''}updated: ${rowsWritten} | ` +
      `${credStats.encrypted + secretStats.encrypted} values ${DRY_RUN ? 'to encrypt' : 'encrypted'}`
  )
  if (credStats.encrypted === 0 && secretStats.encrypted === 0) {
    console.log('Nothing to do — every IntegrationSetting secret is already encrypted.')
  }

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(
    'encrypt-integration-credentials failed:',
    err instanceof Error ? err.message : err
  )
  await prisma.$disconnect()
  process.exit(1)
})
