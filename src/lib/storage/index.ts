// Storage service — driver interface + singleton (ADR-0007 Phase 1).
//
// One code path for every uploaded file (workspace media, support attachments,
// help content). All bytes are written and read through a `StorageDriver`, keyed
// by the scheme in ./keys. The local-disk driver is the default and only wired
// driver; the S3-compatible driver is a config flip in ADR-0022. Access control
// is enforced by the callers/serving route (ADR-0007 Phase 2), NOT here — the
// driver only moves bytes and refuses to escape its root.
//
//   import { getStorage, buildMediaKey } from "@/lib/storage"
//   const key = buildMediaKey(workspaceId, `${uuid}${ext}`)
//   await getStorage().put(key, buffer, { contentType: mime })

import type { Readable } from "stream"

import { LocalStorageDriver } from "./local"

/** A Node stream returned by the local driver's read/getStream path. */
export type NodeReadable = Readable

/** Accepted payload types for `put`. Streams are preferred for large files. */
export type PutData = Buffer | Uint8Array | ReadableStream | Readable

export interface PutOptions {
  /**
   * MIME type hint. The local driver ignores it (the filesystem has no notion
   * of content type); the S3 driver (ADR-0022) will set it as object metadata.
   */
  contentType?: string
}

export interface StorageStat {
  size: number
  mtime: Date
}

/**
 * Driver contract. Implementations MUST validate the key (traversal guard) on
 * every method before touching the backing store, and MUST fail closed.
 */
export interface StorageDriver {
  /** Write `data` at `key`, creating parent "directories" as needed. */
  put(key: string, data: PutData, opts?: PutOptions): Promise<void>
  /**
   * Open a readable stream for `key`. Rejects if the object does not exist, so
   * callers can map the rejection to a 404. Returns a web `ReadableStream`
   * (S3) or a Node `Readable` (local); serving code that needs a web stream can
   * wrap a Node stream with `Readable.toWeb()`.
   */
  getStream(key: string): Promise<ReadableStream | NodeReadable>
  /** Read the full object into a Buffer. Rejects if it does not exist. */
  getBuffer(key: string): Promise<Buffer>
  /** Delete `key`. A no-op (resolves) if the object does not exist. */
  delete(key: string): Promise<void>
  /** Size + mtime, or `null` if the object does not exist. */
  stat(key: string): Promise<StorageStat | null>
}

let cached: StorageDriver | null = null

/**
 * The process-wide storage driver, chosen by `STORAGE_DRIVER`:
 *   - `local` (default) → LocalStorageDriver rooted at STORAGE_LOCAL_ROOT
 *   - `s3`              → throws (not yet wired — ADR-0022); the seam exists so
 *                         the config value is recognized, but nothing is
 *                         half-built.
 * Anything else throws a clear configuration error.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached

  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase()
  switch (driver) {
    case "local":
      cached = new LocalStorageDriver()
      return cached
    case "s3":
      throw new Error(
        "S3 storage driver not yet wired (ADR-0022). Set STORAGE_DRIVER=local."
      )
    default:
      throw new Error(
        `Unknown STORAGE_DRIVER '${driver}' (expected 'local' or 's3').`
      )
  }
}

/**
 * Test-only: drop the cached singleton so a subsequent `getStorage()` re-reads
 * env. Not used in production code.
 */
export function __resetStorageForTests(): void {
  cached = null
}

export { LocalStorageDriver, resolveWithinRoot, defaultLocalRoot } from "./local"
export {
  validateKey,
  assertSegment,
  buildMediaKey,
  buildTicketKey,
  buildHelpKey,
  HELP_KINDS,
} from "./keys"
export type { HelpKind } from "./keys"
