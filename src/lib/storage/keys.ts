// Storage key scheme + traversal guard (ADR-0007 Phase 1).
//
// A "key" is the driver-agnostic, forward-slash-delimited path that identifies
// a stored object (e.g. `media/demo-workspace/8f3c...e1.png`). The same key is
// used by the local-disk driver (as a path under STORAGE_LOCAL_ROOT) and, in
// ADR-0022, by the S3 driver (as an object key). Because keys become
// filesystem paths, `validateKey` is the single traversal guard for the whole
// storage layer: every driver method runs the key through it before touching
// disk. The local driver adds a second, defense-in-depth check
// (`resolveWithinRoot` in ./local) so a bug here can never escape the root.
//
// Key scheme (ADR-0007 Decision Outcome §1):
//   media/{workspaceId}/{uuid}{ext}          — workspace media (private)
//   tickets/{ticketId}/{uuid}{ext}           — support attachments (private)
//   help/{videos|thumbnails|articles}/{...}  — help content (public)

import path from "path"

/** The three help-content namespaces permitted under `help/` (ADR-0007 §1). */
export const HELP_KINDS = ["videos", "thumbnails", "articles"] as const
export type HelpKind = (typeof HELP_KINDS)[number]

/**
 * Assert that `value` is a single, safe path segment (one name, no separators,
 * no traversal, no NUL). Used to sanitize caller-supplied ids/filenames before
 * they are joined into a key. Throws on anything unsafe.
 *
 * Rejected: empty, `.`/`..`, forward slash, backslash, and NUL byte. (A forward
 * slash is legal in a *key* — it is the separator — but never inside a single
 * segment a caller passes to a builder.)
 */
export function assertSegment(value: string, label = "segment"): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid storage ${label}: must be a non-empty string`)
  }
  if (value.includes("\0")) {
    throw new Error(`Invalid storage ${label}: contains a NUL byte`)
  }
  if (value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid storage ${label}: contains a path separator`)
  }
  if (value === "." || value === "..") {
    throw new Error(`Invalid storage ${label}: '.' and '..' are not allowed`)
  }
  return value
}

/**
 * The traversal guard. Validates a full storage key and returns it unchanged.
 * Throws on anything that could escape the storage root or confuse a driver:
 *   - non-string / empty
 *   - NUL byte
 *   - backslash (a valid filename char on Linux, so `path.resolve` alone would
 *     NOT catch it — this is why we reject it explicitly)
 *   - leading `/` or an OS-absolute path
 *   - any empty segment (`//`, leading/trailing `/`)
 *   - any `.` or `..` segment (`a/../../b`, `../etc/passwd`, ...)
 */
export function validateKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Invalid storage key: must be a non-empty string")
  }
  if (key.includes("\0")) {
    throw new Error("Invalid storage key: contains a NUL byte")
  }
  if (key.includes("\\")) {
    throw new Error("Invalid storage key: contains a backslash")
  }
  if (key.startsWith("/") || path.isAbsolute(key)) {
    throw new Error(`Invalid storage key: must be relative, got '${key}'`)
  }
  for (const segment of key.split("/")) {
    if (segment === "") {
      throw new Error(`Invalid storage key: empty path segment in '${key}'`)
    }
    if (segment === "." || segment === "..") {
      throw new Error(`Invalid storage key: traversal segment in '${key}'`)
    }
  }
  return key
}

/** `media/{workspaceId}/{filename}` — workspace media (private). */
export function buildMediaKey(workspaceId: string, filename: string): string {
  assertSegment(workspaceId, "workspaceId")
  assertSegment(filename, "filename")
  return validateKey(`media/${workspaceId}/${filename}`)
}

/** `tickets/{ticketId}/{filename}` — support attachment (private, ADR-0011). */
export function buildTicketKey(ticketId: string, filename: string): string {
  assertSegment(ticketId, "ticketId")
  assertSegment(filename, "filename")
  return validateKey(`tickets/${ticketId}/${filename}`)
}

/**
 * `help/{kind}/{...parts}` — public help content. `kind` must be one of
 * HELP_KINDS; every part is validated as a single safe segment.
 */
export function buildHelpKey(kind: HelpKind, ...parts: string[]): string {
  if (!HELP_KINDS.includes(kind)) {
    throw new Error(
      `Invalid help key kind '${kind}': expected one of ${HELP_KINDS.join(", ")}`
    )
  }
  if (parts.length === 0) {
    throw new Error("Invalid help key: at least one path part is required")
  }
  parts.forEach((part, i) => assertSegment(part, `part[${i}]`))
  return validateKey(["help", kind, ...parts].join("/"))
}
