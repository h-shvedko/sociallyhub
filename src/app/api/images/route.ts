import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { createImageProcessor } from '@/lib/cdn/cdn-manager'

// Image transform endpoint (sharp resize/format via cdn-manager).
//
// SECURITY — ADR-0007 Phase 0, interim SSRF containment.
// This route previously fetched ANY value passed in the `url` query parameter
// with no authentication and returned it with `Access-Control-Allow-Origin: *`
// — an open SSRF proxy and a free transform service for arbitrary hosts.
// The interim fix keeps the sharp transform but locks the input down:
//   1. a session is required (401 without one);
//   2. `url` must be a SAME-ORIGIN RELATIVE path — it must start with '/',
//      must NOT be protocol-relative ('//host'), must NOT contain a scheme
//      ('://' or a backslash trick), and must resolve to this app's own
//      origin. Anything else is rejected 400 { error, code: 'INVALID_URL' }.
// The `*` CORS handler (and its OPTIONS branch) is removed entirely.
//
// NOTE: ADR-0007 Phase 4 (deferred) repurposes this route to accept ONLY an
// internal storage key / asset ID (`?key=media/...&w=640`), resolve it through
// the storage driver with the same access check as `/api/files`, and drop the
// outbound `fetch` altogether — removing the SSRF vector at the source. Until
// that lands, the same-origin relative guard below is the containment.
export async function GET(request: NextRequest) {
  try {
    await requireSession()

    const rawUrl = request.nextUrl.searchParams.get('url')
    if (!rawUrl) {
      return jsonError(400, 'URL parameter required', { code: 'INVALID_URL' })
    }

    // Same-origin relative paths only. Reject absolute URLs, protocol-relative
    // ('//evil.com'), any explicit scheme ('http://', 'file:', 'data:'), and
    // backslashes (WHATWG normalizes '\' to '/' for http, turning '/\evil.com'
    // into a protocol-relative host).
    if (
      !rawUrl.startsWith('/') ||
      rawUrl.startsWith('//') ||
      rawUrl.includes('://') ||
      rawUrl.includes('\\')
    ) {
      return jsonError(400, 'Invalid url', { code: 'INVALID_URL' })
    }

    // Defense in depth: resolve against this app's origin and confirm the
    // result never leaves it. Catches any residual bypass in the string checks.
    let resolved: URL
    try {
      resolved = new URL(rawUrl, request.nextUrl.origin)
    } catch {
      return jsonError(400, 'Invalid url', { code: 'INVALID_URL' })
    }
    if (resolved.origin !== request.nextUrl.origin) {
      return jsonError(400, 'Invalid url', { code: 'INVALID_URL' })
    }

    // Hand the processor a request whose `url` param is the resolved, same-origin
    // absolute URL (the downstream fetch requires an absolute URL) while
    // preserving the client's Accept header for format negotiation.
    const rewritten = new URL(request.url)
    rewritten.searchParams.set('url', resolved.toString())
    const internalRequest = new NextRequest(rewritten.toString(), {
      headers: request.headers,
    })

    const processor = await createImageProcessor()
    return processor(internalRequest)
  } catch (error) {
    return handleApiError(error)
  }
}
