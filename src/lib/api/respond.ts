// Shared API response helpers (ADR-0003).
//
// Every API error response uses the single envelope
// `{ error: string, code?: string, details?: unknown }` — the shape the
// overwhelming majority of existing routes already emit. Produce it via
// `jsonError`; convert thrown errors via `handleApiError` in a route's
// catch block. See docs/api-conventions.md.

import { NextResponse } from "next/server"

import { ApiError } from "@/lib/auth"

export interface JsonErrorOptions {
  code?: string
  details?: unknown
}

export interface ErrorEnvelope {
  error: string
  code?: string
  details?: unknown
}

/**
 * Build a JSON error response in the standard envelope.
 *
 *   return jsonError(404, 'Client not found')
 *   return jsonError(400, 'Invalid request body', { details: parsed.error.flatten() })
 */
export function jsonError(
  status: number,
  message: string,
  opts?: JsonErrorOptions
): NextResponse<ErrorEnvelope> {
  const body: ErrorEnvelope = { error: message }
  if (opts?.code !== undefined) body.code = opts.code
  if (opts?.details !== undefined) body.details = opts.details
  return NextResponse.json(body, { status })
}

/**
 * Convert a thrown error into a response.
 *
 * - `ApiError` (thrown by requireSession/requireAdmin or route logic) maps to
 *   its own status + message + code.
 * - Anything else maps to a generic 500. Internals (stack traces, Prisma
 *   messages, etc.) are logged server-side and NEVER leaked to the client
 *   (ADR-0005).
 */
export function handleApiError(err: unknown): NextResponse<ErrorEnvelope> {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message, { code: err.code })
  }
  console.error("Unhandled API error:", err)
  return jsonError(500, "Internal server error", { code: "INTERNAL_ERROR" })
}
