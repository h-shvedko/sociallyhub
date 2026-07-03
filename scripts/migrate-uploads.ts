// One-time data + file migration to the ADR-0007 storage key layout (Phase 2, step 9).
//
// ── What it does ─────────────────────────────────────────────────────────────
// The pre-ADR-0007 world stored files in two public/private trees and pointed
// DB rows at static `/uploads/...` URLs:
//
//   • Asset (media)            file: public/uploads/media/{file}
//                                    OR {cwd}/uploads/{workspaceId}/{file}  (orphaned /api/upload)
//                              url : /uploads/media/{file}  (or /uploads/{workspaceId}/{file})
//   • TicketAttachment         file: public/uploads/tickets/{file}
//                              url : /uploads/tickets/{file}
//
// This script walks both tables and, for every row that has NOT already been
// migrated (storageKey IS NULL), moves the physical bytes into the storage
// service's key layout and rewrites the DB URL to the authenticated serving
// route:
//
//   • Asset            key = media/{workspaceId}/{file}      url = /api/files/media/{workspaceId}/{file}
//   • TicketAttachment key = tickets/{ticketId}/{file}       fileUrl = /api/files/tickets/{ticketId}/{file}
//
// Files are moved via getStorage().put(key, bytes) (which writes under
// STORAGE_LOCAL_ROOT, default {cwd}/uploads) and the source is removed only
// after the write is verified. When a row's physical file is missing (seeded
// rows and legacy rows frequently have no file on disk), the DB is still
// backfilled best-effort so the new URL scheme is consistent — a 'missing-file'
// warning is logged and the run does NOT crash.
//
// Post/PostVariant CONTENT is only SURFACED, not rewritten: any embedded
// `/uploads/` strings (e.g. an image URL pasted into post body) are counted and
// reported for the ADR-0007 runbook. Rewriting content is intentionally out of
// scope for this pass.
//
// ── Flags ────────────────────────────────────────────────────────────────────
//   (default)     dry-run — report what WOULD change; touches nothing.
//   --dry-run     explicit dry-run (same as default).
//   --apply       actually move files and write the DB.
//   --help        print usage and exit.
//
// ── Run ──────────────────────────────────────────────────────────────────────
//   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/migrate-uploads.ts            # dry-run
//   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/migrate-uploads.ts --apply    # execute
//   (self-hosted Docker, ADR-0022:
//     docker compose exec app npx tsx scripts/migrate-uploads.ts --apply)
//
// ── Safety / idempotency ─────────────────────────────────────────────────────
//   * Idempotent: a second run finds every row already storageKey-stamped and
//     writes nothing (skipped=<all>). Interrupted runs are safe to re-run —
//     each row's storageKey+url are written in a single atomic update, and a row
//     whose file already sits at the target key is detected (present) rather than
//     re-moved.
//   * Fail-safe move order: put → verify size → THEN unlink source. If the put
//     or verify fails the source is left intact.
//   * Per-row try/catch: one malformed row (e.g. an un-deriveable filename) is
//     logged and counted as an error; it never aborts the whole migration.
//   * Non-`/uploads/` URLs (external http(s)/data URIs) are left untouched and
//     counted as `foreign`.
//
// Fails closed only for setup errors: exits non-zero if DATABASE_URL is missing
// or the storage driver is misconfigured (e.g. STORAGE_DRIVER=s3, not wired —
// ADR-0022).

import fs from "fs"
import path from "path"

import { PrismaClient } from "@prisma/client"

import {
  getStorage,
  buildMediaKey,
  buildTicketKey,
  validateKey,
  defaultLocalRoot,
} from "../src/lib/storage"

const prisma = new PrismaClient()

const BATCH = 200
const API_FILES_PREFIX = "/api/files/"
const UPLOADS_PREFIX = "/uploads/"

const args = new Set(process.argv.slice(2))
if (args.has("--help") || args.has("-h")) {
  console.log(
    [
      "migrate-uploads — relocate legacy uploads into the ADR-0007 key layout.",
      "",
      "Usage:",
      "  npx tsx --tsconfig tsconfig.json scripts/migrate-uploads.ts [--apply|--dry-run]",
      "",
      "  (default)   dry-run: report what WOULD change; writes nothing.",
      "  --apply     move files + rewrite Asset.url/thumbnailUrl and TicketAttachment.fileUrl.",
      "  --dry-run   explicit dry-run.",
    ].join("\n")
  )
  process.exit(0)
}

// Dry-run is the default; only --apply turns writes on.
const APPLY = args.has("--apply")
const DRY_RUN = !APPLY

const cwd = process.cwd()

/** Move outcome for a single physical file. */
type MoveOutcome = "moved" | "present" | "missing"

interface TableStats {
  scanned: number // rows examined
  skipped: number // storageKey already set — already migrated
  moved: number // physical file relocated + DB rewritten
  backfilled: number // DB rewritten WITHOUT a move (present + missing)
  present: number // no source, but file already at target key (prior run)
  missing: number // no source anywhere — DB backfilled, warned
  foreign: number // non-/uploads/ URL (http/data) — left untouched
  errors: number // per-row failures — logged, run continues
}

const emptyStats = (): TableStats => ({
  scanned: 0,
  skipped: 0,
  moved: 0,
  backfilled: 0,
  present: 0,
  missing: 0,
  foreign: 0,
  errors: 0,
})

function warn(msg: string): void {
  console.warn(`  WARN  ${msg}`)
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Relocate the bytes for `key` from the first existing source candidate into the
 * storage service, then remove the source. Returns:
 *   'moved'   — a source file was found (and, when APPLY, moved to `key`).
 *   'present' — no source file, but `key` already exists in storage (idempotent
 *               re-run of an interrupted move).
 *   'missing' — no source file and nothing at `key` (seeded/legacy row with no
 *               bytes on disk); the caller still backfills the DB best-effort.
 * In dry-run nothing is written; the outcome reflects what WOULD happen.
 */
async function relocate(key: string, srcCandidates: string[]): Promise<MoveOutcome> {
  const storage = getStorage()
  const uniqueCandidates = [...new Set(srcCandidates)]

  let src: string | null = null
  for (const candidate of uniqueCandidates) {
    if (await exists(candidate)) {
      src = candidate
      break
    }
  }

  if (src) {
    if (APPLY) {
      const bytes = await fs.promises.readFile(src)
      await storage.put(key, bytes)
      // Verify the write landed intact BEFORE removing the source, so a partial
      // write can never destroy the only copy.
      const st = await storage.stat(key)
      if (!st || st.size !== bytes.length) {
        throw new Error(
          `post-put verification failed for key '${key}' (src '${src}', ` +
            `expected ${bytes.length} bytes, got ${st ? st.size : "none"})`
        )
      }
      await fs.promises.unlink(src)
    }
    return "moved"
  }

  // No source file — is it already sitting at the target key?
  const st = await storage.stat(key)
  return st ? "present" : "missing"
}

async function migrateAssets(): Promise<TableStats> {
  const stats = emptyStats()
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.asset.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        workspaceId: true,
        url: true,
        thumbnailUrl: true,
        storageKey: true,
      },
    })
    if (rows.length === 0) break

    for (const asset of rows) {
      stats.scanned++
      try {
        // Already migrated.
        if (asset.storageKey) {
          stats.skipped++
          continue
        }

        // Partial prior run: url already rewritten to /api/files/... but the
        // storageKey column was never stamped. Recover the key from the url.
        if (asset.url.startsWith(API_FILES_PREFIX)) {
          const key = validateKey(asset.url.slice(API_FILES_PREFIX.length))
          if (APPLY) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { storageKey: key },
            })
          }
          stats.present++
          stats.backfilled++
          continue
        }

        // External or otherwise non-local URL — nothing to relocate.
        if (!asset.url.startsWith(UPLOADS_PREFIX)) {
          stats.foreign++
          warn(`asset ${asset.id}: non-upload url '${asset.url}' — left untouched`)
          continue
        }

        const file = path.posix.basename(asset.url)
        if (!file) {
          throw new Error(`could not derive a filename from url '${asset.url}'`)
        }
        const key = buildMediaKey(asset.workspaceId, file)
        const newUrl = API_FILES_PREFIX + key

        // Candidate source locations (deduped in relocate):
        //   1. public/uploads/media/{file}          (/api/media/upload)
        //   2. {cwd}/uploads/{workspaceId}/{file}   (orphaned /api/upload)
        //   3. public/{url}                          (defensive general public path)
        const srcs = [
          path.join(cwd, "public", "uploads", "media", file),
          path.join(cwd, "uploads", asset.workspaceId, file),
          path.join(cwd, "public", asset.url),
        ]
        const outcome = await relocate(key, srcs)

        // Rewrite thumbnailUrl if it still points at the old static tree. In the
        // common image case the thumbnail IS the main file (same url) → same key,
        // so no separate move is attempted.
        let newThumb = asset.thumbnailUrl
        if (asset.thumbnailUrl && asset.thumbnailUrl.startsWith(UPLOADS_PREFIX)) {
          const thumbFile = path.posix.basename(asset.thumbnailUrl)
          if (thumbFile) {
            const thumbKey = buildMediaKey(asset.workspaceId, thumbFile)
            newThumb = API_FILES_PREFIX + thumbKey
            if (thumbKey !== key) {
              const thumbOutcome = await relocate(thumbKey, [
                path.join(cwd, "public", "uploads", "media", thumbFile),
                path.join(cwd, "public", asset.thumbnailUrl),
              ])
              if (thumbOutcome === "missing") {
                warn(
                  `asset ${asset.id}: thumbnail file missing for ` +
                    `'${asset.thumbnailUrl}' — url still rewritten`
                )
              }
            }
          }
        } else if (
          asset.thumbnailUrl &&
          asset.thumbnailUrl.startsWith(API_FILES_PREFIX)
        ) {
          // Already migrated thumbnail — leave as-is.
          newThumb = asset.thumbnailUrl
        }

        if (APPLY) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { storageKey: key, url: newUrl, thumbnailUrl: newThumb },
          })
        }

        switch (outcome) {
          case "moved":
            stats.moved++
            break
          case "present":
            stats.present++
            stats.backfilled++
            break
          case "missing":
            stats.missing++
            stats.backfilled++
            warn(
              `asset ${asset.id}: source file missing for '${asset.url}' — ` +
                `DB ${DRY_RUN ? "would be " : ""}backfilled to '${newUrl}'`
            )
            break
        }
      } catch (err) {
        stats.errors++
        console.error(`  ERROR asset ${asset.id}: ${errMsg(err)}`)
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  return stats
}

async function migrateTicketAttachments(): Promise<TableStats> {
  const stats = emptyStats()
  let cursor: string | undefined

  for (;;) {
    const rows = await prisma.ticketAttachment.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        ticketId: true,
        fileUrl: true,
        storageKey: true,
      },
    })
    if (rows.length === 0) break

    for (const att of rows) {
      stats.scanned++
      try {
        if (att.storageKey) {
          stats.skipped++
          continue
        }

        if (att.fileUrl.startsWith(API_FILES_PREFIX)) {
          const key = validateKey(att.fileUrl.slice(API_FILES_PREFIX.length))
          if (APPLY) {
            await prisma.ticketAttachment.update({
              where: { id: att.id },
              data: { storageKey: key },
            })
          }
          stats.present++
          stats.backfilled++
          continue
        }

        if (!att.fileUrl.startsWith(UPLOADS_PREFIX)) {
          stats.foreign++
          warn(
            `ticketAttachment ${att.id}: non-upload url '${att.fileUrl}' — left untouched`
          )
          continue
        }

        const file = path.posix.basename(att.fileUrl)
        if (!file) {
          throw new Error(`could not derive a filename from url '${att.fileUrl}'`)
        }
        const key = buildTicketKey(att.ticketId, file)
        const newUrl = API_FILES_PREFIX + key

        const srcs = [
          path.join(cwd, "public", "uploads", "tickets", file),
          path.join(cwd, "public", att.fileUrl),
        ]
        const outcome = await relocate(key, srcs)

        if (APPLY) {
          await prisma.ticketAttachment.update({
            where: { id: att.id },
            data: { storageKey: key, fileUrl: newUrl },
          })
        }

        switch (outcome) {
          case "moved":
            stats.moved++
            break
          case "present":
            stats.present++
            stats.backfilled++
            break
          case "missing":
            stats.missing++
            stats.backfilled++
            warn(
              `ticketAttachment ${att.id}: source file missing for ` +
                `'${att.fileUrl}' — DB ${DRY_RUN ? "would be " : ""}backfilled to '${newUrl}'`
            )
            break
        }
      } catch (err) {
        stats.errors++
        console.error(`  ERROR ticketAttachment ${att.id}: ${errMsg(err)}`)
      }
    }

    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) break
  }

  return stats
}

/**
 * Surface (do NOT rewrite) embedded `/uploads/` references in post and variant
 * content. Reported so the runbook operator can decide how to fix copied-in URLs
 * — content rewriting is out of scope for this pass (ADR-0007 Risks section).
 */
async function reportEmbeddedContent(): Promise<{
  posts: number
  variants: number
}> {
  const [posts, variants] = await Promise.all([
    prisma.post.count({ where: { baseContent: { contains: UPLOADS_PREFIX } } }),
    prisma.postVariant.count({ where: { text: { contains: UPLOADS_PREFIX } } }),
  ])
  return { posts, variants }
}

function printTable(label: string, s: TableStats): void {
  console.log(
    `\n${label} — scanned=${s.scanned} skipped=${s.skipped} ` +
      `moved=${s.moved} backfilled=${s.backfilled} ` +
      `(present=${s.present}, missing=${s.missing}) ` +
      `foreign=${s.foreign} errors=${s.errors}`
  )
  if (DRY_RUN && (s.moved > 0 || s.backfilled > 0)) {
    console.log(
      `  (dry-run: ${s.moved} file(s) WOULD move, ${s.backfilled} row(s) WOULD be backfilled)`
    )
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "migrate-uploads: DATABASE_URL is not set (export it from .env.local)."
    )
    process.exit(1)
  }

  // Surface storage-driver misconfiguration early (e.g. STORAGE_DRIVER=s3, which
  // is not wired yet — ADR-0022). Throws with a clear message if invalid.
  getStorage()

  console.log(
    `migrate-uploads ${APPLY ? "(APPLY: moving files + writing DB)" : "(dry-run: no writes)"}`
  )
  console.log(`  storage root : ${defaultLocalRoot()}`)
  console.log(`  cwd          : ${cwd}`)
  console.log(`  batch size   : ${BATCH}`)

  const assetStats = await migrateAssets()
  const ticketStats = await migrateTicketAttachments()
  const embedded = await reportEmbeddedContent()

  printTable("Asset", assetStats)
  printTable("TicketAttachment", ticketStats)

  console.log("\nEmbedded '/uploads/' references in content (NOT rewritten this pass):")
  console.log(
    `  Post.baseContent : ${embedded.posts} row(s)` +
      (embedded.posts > 0
        ? " — review + rewrite manually (see ADR-0007 runbook)"
        : "")
  )
  console.log(
    `  PostVariant.text : ${embedded.variants} row(s)` +
      (embedded.variants > 0
        ? " — review + rewrite manually (see ADR-0007 runbook)"
        : "")
  )

  const totalMoved = assetStats.moved + ticketStats.moved
  const totalBackfilled = assetStats.backfilled + ticketStats.backfilled
  const totalMissing = assetStats.missing + ticketStats.missing
  const totalErrors = assetStats.errors + ticketStats.errors

  console.log(
    `\nTotals: ${totalMoved} file(s) ${DRY_RUN ? "would be " : ""}moved, ` +
      `${totalBackfilled} row(s) ${DRY_RUN ? "would be " : ""}backfilled ` +
      `(${totalMissing} missing-file), ${totalErrors} error(s).`
  )
  if (DRY_RUN) {
    console.log("Re-run with --apply to perform the migration.")
  }

  await prisma.$disconnect()
  // Non-zero exit if any row hard-failed, so a CI/runbook step notices.
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error("migrate-uploads failed:", errMsg(err))
  await prisma.$disconnect()
  process.exit(1)
})
