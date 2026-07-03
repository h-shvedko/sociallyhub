// Unified authenticated file-serving route (ADR-0007 Phase 2, step 8).
//
// This is the SINGLE exit point for every stored file. It replaces the old
// `/api/uploads/[...path]` route (deleted in this phase) and is the only place
// access control for uploaded bytes is enforced. Files are addressed by their
// storage KEY (the driver-agnostic, forward-slash path from `@/lib/storage`),
// and access is decided from the key's PREFIX:
//
//   media/{workspaceId}/{uuid}{ext}  → Asset;            workspace member may read
//   tickets/{ticketId}/{uuid}{ext}   → TicketAttachment; session + membership in
//                                      the ticket's workspace (guest tokens are
//                                      ADR-0011 — a session is required now)
//   help/{videos|thumbnails|...}/... → PUBLIC (help content is public-facing)
//
// Bytes are STREAMED through the storage driver (no full-buffer reads of large
// files, per ADR-0007). The route fails CLOSED: unauthenticated/non-member
// access never serves a file — it returns 401/404 with the standard error
// envelope, and never leaks whether a private key exists.

import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'

import { requireSession, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { getStorage, validateKey } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

// This route touches the filesystem (local storage driver) and reads the
// session cookie, so it must run on the Node.js runtime and never be cached
// as a static response.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Extension → MIME for the `help/*` public branch (no DB record to read). */
const HELP_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
}

function extname(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function helpMimeFor(name: string): string {
  return HELP_MIME_BY_EXT[extname(name)] ?? 'application/octet-stream'
}

/** Images and videos render inline; everything else downloads (ADR-0007). */
function isInlineType(mime: string): boolean {
  return mime.startsWith('image/') || mime.startsWith('video/')
}

/**
 * Sanitize a download filename for a `Content-Disposition` header: strip the
 * characters that would break the header (quotes, backslash, CR/LF) or reopen a
 * traversal, and drop non-ASCII so the `filename=` param stays well-formed.
 */
function safeFilename(name: string | null | undefined): string {
  const base = (name ?? 'download').split(/[\\/]/).pop() || 'download'
  const cleaned = base
    // Strip control chars, non-ASCII, quotes and backslash so the header's
    // filename="…" param stays well-formed (no CR/LF header injection).
    .replace(/[\u0000-\u001f\u007f-\uffff"\\]/g, '_')
    .trim()
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'download'
}

/** Convert the driver's stream (Node `Readable` from local; web stream from S3). */
function toWebStream(stream: ReadableStream | Readable): ReadableStream {
  if (stream instanceof Readable) {
    return Readable.toWeb(stream) as unknown as ReadableStream
  }
  return stream
}

/**
 * Stream `key` from storage with the right headers. `existence` is enforced via
 * `stat()` (→ 404 when missing), which also gives an accurate `Content-Length`.
 * Access control for the key is the CALLER's responsibility — this helper runs
 * only after the branch's auth check has passed.
 */
async function serve(
  key: string,
  mimeType: string,
  downloadName: string | null,
  visibility: 'private' | 'public'
): Promise<NextResponse> {
  const storage = getStorage()

  const info = await storage.stat(key)
  if (!info) {
    throw new ApiError(404, 'File not found', 'NOT_FOUND')
  }

  let nodeOrWebStream: ReadableStream | Readable
  try {
    nodeOrWebStream = await storage.getStream(key)
  } catch {
    // Present in stat() but unreadable now (deleted between calls / perms).
    throw new ApiError(404, 'File not found', 'NOT_FOUND')
  }

  const contentType = mimeType || 'application/octet-stream'
  const dispositionType = isInlineType(contentType) ? 'inline' : 'attachment'

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Length', String(info.size))
  headers.set('X-Content-Type-Options', 'nosniff')
  // Overrides the middleware's blanket `no-store` (ADR-0005): this is the same
  // opt-in mechanism `withApiAuth` uses (set the header on the handler response).
  headers.set(
    'Cache-Control',
    visibility === 'public' ? 'public, max-age=86400' : 'private, max-age=3600'
  )
  headers.set(
    'Content-Disposition',
    `${dispositionType}; filename="${safeFilename(downloadName)}"`
  )

  return new NextResponse(toWebStream(nodeOrWebStream), { status: 200, headers })
}

/** `media/{workspaceId}/...` — any member of {workspaceId} may read. */
async function serveMedia(key: string, workspaceId: string): Promise<NextResponse> {
  // Authorize BEFORE revealing whether the asset exists: a non-member (or an
  // unauthenticated caller) gets 404/401 with no existence signal.
  await requireWorkspaceRole(workspaceId) // 401 no session, 404 non-member

  const asset = await prisma.asset.findFirst({ where: { storageKey: key } })
  if (!asset || asset.workspaceId !== workspaceId) {
    // Not found, or the key's workspace prefix disagrees with the row.
    throw new ApiError(404, 'File not found', 'NOT_FOUND')
  }

  return serve(key, asset.mimeType, asset.originalName, 'private')
}

/**
 * `tickets/{ticketId}/...` — session required (ADR-0011 defers guest tokens),
 * plus membership in the ticket's workspace. Guest tickets with no workspace
 * fail closed (404) because membership cannot be established without a session.
 */
async function serveTicket(key: string, ticketId: string): Promise<NextResponse> {
  await requireSession() // 401 when unauthenticated (before any lookup)

  const attachment = await prisma.ticketAttachment.findFirst({
    where: { storageKey: key },
    include: { ticket: { select: { id: true, workspaceId: true } } },
  })

  if (
    !attachment ||
    attachment.ticketId !== ticketId ||
    !attachment.ticket?.workspaceId
  ) {
    throw new ApiError(404, 'File not found', 'NOT_FOUND')
  }

  // Defensive: real scanning is ADR-0008. The field is null today; if a future
  // scanner ever marks a file as malware, never serve it.
  if (attachment.scanResult === 'malware') {
    throw new ApiError(404, 'File not found', 'NOT_FOUND')
  }

  // Membership in the ticket's workspace (any role may read). 404 for non-members.
  await requireWorkspaceRole(attachment.ticket.workspaceId)

  return serve(key, attachment.mimeType, attachment.originalName, 'private')
}

/** `help/...` — public help content; no auth, longer cache. */
async function serveHelp(key: string): Promise<NextResponse> {
  const filename = key.split('/').pop() ?? 'file'
  return serve(key, helpMimeFor(filename), filename, 'public')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key: segments } = await params
    const key = (segments ?? []).join('/')

    // Traversal guard (backslash, `..`, absolute, empty segments, NUL → 400).
    try {
      validateKey(key)
    } catch {
      throw new ApiError(400, 'Invalid file key', 'INVALID_KEY')
    }

    const prefix = key.split('/')[0]
    const second = key.split('/')[1]

    switch (prefix) {
      case 'help':
        return await serveHelp(key)
      case 'media':
        // A media key must carry a workspace segment.
        if (!second) throw new ApiError(404, 'File not found', 'NOT_FOUND')
        return await serveMedia(key, second)
      case 'tickets':
        // A ticket key must carry a ticket segment.
        if (!second) throw new ApiError(404, 'File not found', 'NOT_FOUND')
        return await serveTicket(key, second)
      default:
        // Unknown namespace — never reveal more than "not found".
        throw new ApiError(404, 'File not found', 'NOT_FOUND')
    }
  } catch (err) {
    return handleApiError(err)
  }
}
