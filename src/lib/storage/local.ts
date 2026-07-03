// Local-disk storage driver (ADR-0007 Phase 1).
//
// Stores objects on the filesystem under STORAGE_LOCAL_ROOT (default
// `{cwd}/uploads`, the directory prod already mounts a volume at — see
// docker-compose.prod.yml `uploads:/app/uploads`). This is the default and only
// wired driver; the S3-compatible driver is ADR-0022. The local driver is
// documented single-replica-only (a ReadWriteOnce PVC / a single Docker host);
// ADR-0022 gates multi-replica deployment on STORAGE_DRIVER=s3.

import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"

import type {
  NodeReadable,
  PutData,
  PutOptions,
  StorageDriver,
  StorageStat,
} from "./index"
import { validateKey } from "./keys"

/** Default root when STORAGE_LOCAL_ROOT is unset (see .env.example). */
export function defaultLocalRoot(): string {
  return process.env.STORAGE_LOCAL_ROOT || path.join(process.cwd(), "uploads")
}

/**
 * Defense-in-depth path resolver. Resolves a key against `root` and asserts the
 * result stays inside `root` — so even if `validateKey` ever missed a vector,
 * an escaping path still throws. Exported for direct unit testing of the escape
 * guard (feed it a raw `../..` key, which `validateKey` would reject upstream,
 * to prove this second layer fires on its own).
 */
export function resolveWithinRoot(root: string, key: string): string {
  const absRoot = path.resolve(root)
  const full = path.resolve(absRoot, key)
  const rootWithSep = absRoot.endsWith(path.sep) ? absRoot : absRoot + path.sep
  if (full !== absRoot && !full.startsWith(rootWithSep)) {
    throw new Error(
      `Resolved storage path escapes root: key '${key}' -> '${full}'`
    )
  }
  return full
}

function isWebReadableStream(x: unknown): x is ReadableStream {
  return (
    x != null &&
    typeof (x as { getReader?: unknown }).getReader === "function"
  )
}

function isNodeReadable(x: unknown): x is Readable {
  return (
    x != null &&
    typeof (x as { pipe?: unknown }).pipe === "function" &&
    typeof (x as { on?: unknown }).on === "function"
  )
}

export class LocalStorageDriver implements StorageDriver {
  readonly root: string

  constructor(root?: string) {
    this.root = path.resolve(root ?? defaultLocalRoot())
  }

  /** validateKey (traversal guard) + resolveWithinRoot (escape guard). */
  private resolve(key: string): string {
    validateKey(key)
    return resolveWithinRoot(this.root, key)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async put(key: string, data: PutData, _opts?: PutOptions): Promise<void> {
    const full = this.resolve(key)
    await fs.promises.mkdir(path.dirname(full), { recursive: true })

    if (isNodeReadable(data)) {
      await pipeline(data, fs.createWriteStream(full))
      return
    }
    if (isWebReadableStream(data)) {
      await pipeline(Readable.fromWeb(data as never), fs.createWriteStream(full))
      return
    }
    // Buffer or Uint8Array — writeFile accepts both.
    await fs.promises.writeFile(full, data)
  }

  async getStream(key: string): Promise<NodeReadable> {
    const full = this.resolve(key)
    // Fail fast (reject the promise) when the object is missing, so callers can
    // map it to a 404 instead of receiving a stream that errors mid-flight.
    await fs.promises.access(full, fs.constants.R_OK)
    return fs.createReadStream(full)
  }

  async getBuffer(key: string): Promise<Buffer> {
    const full = this.resolve(key)
    return fs.promises.readFile(full)
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key)
    try {
      await fs.promises.unlink(full)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return
      throw err
    }
  }

  async stat(key: string): Promise<StorageStat | null> {
    const full = this.resolve(key)
    try {
      const s = await fs.promises.stat(full)
      return { size: s.size, mtime: s.mtime }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
      throw err
    }
  }
}
