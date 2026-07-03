// Re-encrypt every at-rest secret with the CURRENT encryption key (ADR-0006).
//
// ── When to run ──────────────────────────────────────────────────────────────
// After rotating the encryption key. The full rotation procedure:
//
//   1. Generate a new key:            openssl rand -hex 32
//   2. Move the live key to previous: ENCRYPTION_KEY_PREVIOUS=<old key>
//   3. Install the new key:           ENCRYPTION_KEY=<new key>
//   4. Deploy so the app writes new values under the new key.
//   5. Run this script to re-encrypt all existing rows onto the new key:
//        DATABASE_URL=... ENCRYPTION_KEY=<new> ENCRYPTION_KEY_PREVIOUS=<old> \
//          npx tsx scripts/rotate-encryption-key.ts
//      (self-hosted Docker, ADR-0022:
//        docker compose exec app npx tsx scripts/rotate-encryption-key.ts)
//   6. Re-run until the report shows 0 rows decrypted via the previous key (k0).
//   7. Remove ENCRYPTION_KEY_PREVIOUS from the environment and redeploy.
//
// ── What it does ─────────────────────────────────────────────────────────────
// For each encrypted column it walks the table in id-ordered batches and, per
// value, decrypts it with whichever configured key works — honoring the
// embedded keyId first, then falling back across the current/previous slots
// because a rotation makes the embedded label stale (a value written as `k1`
// under the old key must now be read via ENCRYPTION_KEY_PREVIOUS). It then
// re-encrypts with the current key and writes the row back only when the value
// was NOT already on the current key.
//
// Columns processed (ADR-0006 Phase 1 scope):
//   SocialAccount.accessToken, SocialAccount.refreshToken
//   IntegrationSetting.credentials
// (IntegrationSetting.webhookSecret joins this set once ADR-0006 Phase 4
// encrypts it on write; add it here then.)
//
// ── Safety / idempotency ─────────────────────────────────────────────────────
//   * Idempotent: a second run finds every value on the current key (k1) and
//     writes nothing.
//   * Plaintext (non-`enc:v1`) values are LEFT UNTOUCHED — encrypting legacy
//     plaintext is scripts/encrypt-social-tokens.ts's job (ADR-0006 Phase 3),
//     not rotation's. They are reported so they are visible.
//   * `--dry-run` reports the counts without writing.
//   * Never logs secret material. Prints per-keyId row counts.
//
// Exit code 0 = completed (0 on clean run and clean dry-run); 1 = a value could
// not be decrypted with any configured key, or the environment is misconfigured.

import { PrismaClient } from '@prisma/client'

import { decryptString, encryptString, isEncrypted, isEncryptionConfigured } from '../src/lib/encryption'

const prisma = new PrismaClient()

const BATCH = 200
const CURRENT_KEY_ID = 'k1'
const DRY_RUN = process.argv.includes('--dry-run')

interface FieldStats {
  total: number // encrypted values seen
  k1: number // decrypted via the current key (already rotated)
  k0: number // decrypted via the previous key -> re-encrypted onto current
  plaintext: number // non-enc:v1 value -> skipped (Phase 3's job)
  nonString: number // non-string column value -> skipped
  failed: number // undecryptable with any configured key
  written: number // rows updated
}

const emptyStats = (): FieldStats => ({
  total: 0,
  k1: 0,
  k0: 0,
  plaintext: 0,
  nonString: 0,
  failed: 0,
  written: 0,
})

type RotateResult =
  | { kind: 'plaintext' }
  | { kind: 'failed' }
  | { kind: 'ok'; via: 'k1' | 'k0'; needsWrite: boolean; value: string }

/**
 * Decrypt `value` with whichever configured key authenticates it (embedded
 * label first, then the current/previous slots to cover a stale post-rotation
 * label), then re-encrypt with the current key. `needsWrite` is false only when
 * the value already lived on the current key.
 */
function rotateEncryptedValue(value: string): RotateResult {
  if (!isEncrypted(value)) return { kind: 'plaintext' }

  const embedded = value.split(':')[2]
  const attempts = [embedded, 'k1', 'k0']
  const tried = new Set<string>()

  for (const keyId of attempts) {
    if (tried.has(keyId)) continue
    tried.add(keyId)
    const candidate = value.replace(/^enc:v1:[^:]+:/, `enc:v1:${keyId}:`)
    try {
      const plaintext = decryptString(candidate)
      const via: 'k1' | 'k0' = keyId === CURRENT_KEY_ID ? 'k1' : 'k0'
      const alreadyCurrent = via === 'k1'
      return {
        kind: 'ok',
        via,
        needsWrite: !alreadyCurrent,
        value: alreadyCurrent ? value : encryptString(plaintext),
      }
    } catch {
      // Wrong key / unconfigured slot — try the next candidate.
    }
  }
  return { kind: 'failed' }
}

function tally(stats: FieldStats, result: RotateResult) {
  stats.total++
  if (result.kind === 'plaintext') stats.plaintext++
  else if (result.kind === 'failed') stats.failed++
  else if (result.via === 'k1') stats.k1++
  else stats.k0++
}

async function rotateSocialAccounts(): Promise<Record<string, FieldStats>> {
  const stats = { accessToken: emptyStats(), refreshToken: emptyStats() }
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
      const data: Record<string, string> = {}
      for (const field of ['accessToken', 'refreshToken'] as const) {
        const value = row[field]
        if (value === null || value === undefined || value === '') continue
        const result = rotateEncryptedValue(value)
        tally(stats[field], result)
        if (result.kind === 'ok' && result.needsWrite) {
          data[field] = result.value
          stats[field].written++
        }
      }
      if (!DRY_RUN && Object.keys(data).length > 0) {
        await prisma.socialAccount.update({ where: { id: row.id }, data })
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  return stats
}

async function rotateIntegrationSettings(): Promise<Record<string, FieldStats>> {
  const stats = { credentials: emptyStats() }
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.integrationSetting.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, credentials: true },
    })
    if (rows.length === 0) break

    for (const row of rows) {
      const raw = row.credentials
      if (raw === null || raw === undefined) continue
      if (typeof raw !== 'string') {
        // Non-string JSON: not one of our enc:v1 strings — leave it alone.
        stats.credentials.nonString++
        continue
      }
      const result = rotateEncryptedValue(raw)
      tally(stats.credentials, result)
      if (result.kind === 'ok' && result.needsWrite) {
        stats.credentials.written++
        if (!DRY_RUN) {
          await prisma.integrationSetting.update({
            where: { id: row.id },
            data: { credentials: result.value },
          })
        }
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  return stats
}

function printTable(table: string, byField: Record<string, FieldStats>): FieldStats {
  const totals = emptyStats()
  console.log(`\n${table}`)
  for (const [field, s] of Object.entries(byField)) {
    console.log(
      `  ${field.padEnd(14)} total=${s.total} k1(current)=${s.k1} k0(previous)=${s.k0} ` +
        `plaintext=${s.plaintext} nonString=${s.nonString} failed=${s.failed} written=${s.written}`
    )
    for (const k of Object.keys(totals) as (keyof FieldStats)[]) totals[k] += s[k]
  }
  return totals
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('rotate-encryption-key: DATABASE_URL is not set (export it from .env.local).')
    process.exit(1)
  }
  if (!isEncryptionConfigured()) {
    console.error('rotate-encryption-key: ENCRYPTION_KEY is missing or malformed (need 64 hex chars).')
    process.exit(1)
  }
  if (!process.env.ENCRYPTION_KEY_PREVIOUS) {
    console.warn(
      'rotate-encryption-key: ENCRYPTION_KEY_PREVIOUS is not set. Values encrypted ' +
        'under a previous key CANNOT be re-encrypted and will be reported as failed. ' +
        'Set it if you are mid-rotation.'
    )
  }
  console.log(`rotate-encryption-key${DRY_RUN ? ' (dry-run: no writes)' : ''} — current key = ${CURRENT_KEY_ID}`)

  const social = await rotateSocialAccounts()
  const integration = await rotateIntegrationSettings()

  const grand = emptyStats()
  for (const totals of [printTable('SocialAccount', social), printTable('IntegrationSetting', integration)]) {
    for (const k of Object.keys(grand) as (keyof FieldStats)[]) grand[k] += totals[k]
  }

  console.log(
    `\nTotals: ${grand.total} encrypted values | ${grand.k0} rotated from previous key | ` +
      `${grand.written} rows ${DRY_RUN ? 'would be ' : ''}written | ${grand.plaintext} plaintext (Phase 3) | ${grand.failed} failed`
  )
  if (grand.k0 === 0 && grand.failed === 0) {
    console.log('All encrypted values are on the current key. Safe to remove ENCRYPTION_KEY_PREVIOUS.')
  } else if (grand.k0 > 0) {
    console.log('Re-run until "rotated from previous key" reaches 0 before removing ENCRYPTION_KEY_PREVIOUS.')
  }

  await prisma.$disconnect()
  process.exit(grand.failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error('rotate-encryption-key failed:', err instanceof Error ? err.message : err)
  await prisma.$disconnect()
  process.exit(1)
})
