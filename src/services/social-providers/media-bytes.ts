// Media-bytes resolver for real provider uploads (ADR-0009 Phase 1.2 / 2.1).
//
// Providers that perform a real binary upload (Twitter chunked v1.1 media/upload,
// Facebook Page /photos|/videos multipart `source`) need the actual file BYTES.
// The bytes live in the ADR-0007 storage layer, keyed by the Asset's
// `storageKey` (`media/{workspaceId}/{uuid}{ext}`). A `MediaItem` handed to a
// provider carries `url` — which for locally-uploaded assets is `/api/files/{key}`
// (see /api/media/upload) — so the storage key is recoverable from the URL alone.
//
// HONESTY RULE (ADR-0009): this NEVER fabricates bytes. If the key/URL cannot be
// resolved to real bytes, it THROWS — the calling `uploadMedia` maps that to
// `success:false`, never a fake media id. This is the single seam that replaced
// the old `mock_media_/fb_media_/ig_media_` fabricated-id stubs.

import { getStorage, validateKey } from "@/lib/storage"
import type { MediaItem } from "./types"

/** URL prefix under which locally-stored assets are served (see /api/files). */
const API_FILES_PREFIX = "/api/files/"

export interface ResolvedMediaBytes {
  buffer: Buffer
  /** Best-effort MIME type (from the storage URL/extension or an HTTP header). */
  mimeType: string
  byteLength: number
}

/** Map a file extension / MediaItem.type to a MIME type (best effort). */
function inferMimeType(url: string, fallbackType: MediaItem["type"]): string {
  const clean = (url.split("?")[0] || "").toLowerCase()
  const dot = clean.lastIndexOf(".")
  const ext = dot >= 0 ? clean.slice(dot + 1) : ""
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  }
  if (byExt[ext]) return byExt[ext]
  if (fallbackType === "video") return "video/mp4"
  if (fallbackType === "gif") return "image/gif"
  return "image/jpeg"
}

/**
 * Derive an ADR-0007 storage key from a MediaItem, or null when the media is not
 * a local/stored object (e.g. an external absolute URL). Order of preference:
 *   1. An explicit `storageKey` field, if a caller attached one.
 *   2. A `/api/files/{key}` serving URL (strip the prefix).
 *   3. A bare relative key like `media/{ws}/{uuid}.png`.
 * Every candidate is run through `validateKey` (the traversal guard) so a
 * malformed value is rejected rather than trusted.
 */
function toStorageKey(media: MediaItem): string | null {
  const explicit = (media as { storageKey?: unknown }).storageKey
  if (typeof explicit === "string" && explicit.length > 0) {
    try {
      return validateKey(explicit)
    } catch {
      /* fall through to URL-based resolution */
    }
  }

  const url = media.url ?? ""
  if (url.startsWith(API_FILES_PREFIX)) {
    try {
      return validateKey(url.slice(API_FILES_PREFIX.length))
    } catch {
      return null
    }
  }

  // Bare relative key (not absolute, not root-relative to another route).
  if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    try {
      return validateKey(url)
    } catch {
      return null
    }
  }

  return null
}

/**
 * Resolve a MediaItem to its real bytes. Prefers the ADR-0007 storage layer
 * (`getStorage().getBuffer(key)`); falls back to an HTTP GET for absolute
 * `http(s)://` URLs (externally hosted media). THROWS when neither path yields
 * bytes — the caller must surface an honest `success:false`, never a fake id.
 */
export async function resolveMediaBytes(
  media: MediaItem
): Promise<ResolvedMediaBytes> {
  const key = toStorageKey(media)
  if (key) {
    // getBuffer rejects if the object does not exist → honest failure.
    const buffer = await getStorage().getBuffer(key)
    return {
      buffer,
      mimeType: inferMimeType(media.url || key, media.type),
      byteLength: buffer.byteLength,
    }
  }

  if (media.url && /^https?:\/\//i.test(media.url)) {
    const res = await fetch(media.url)
    if (!res.ok) {
      throw new Error(
        `Failed to fetch media bytes from ${media.url}: HTTP ${res.status}`
      )
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const headerType = res.headers.get("content-type")
    const mimeType = headerType
      ? headerType.split(";")[0].trim()
      : inferMimeType(media.url, media.type)
    return { buffer, mimeType, byteLength: buffer.byteLength }
  }

  throw new Error(
    `Cannot resolve media bytes: media.url ('${media.url ?? ""}') is neither a ` +
      `known storage key nor an absolute URL. Media must be stored via the ` +
      `ADR-0007 storage layer or hosted at a fetchable URL.`
  )
}
