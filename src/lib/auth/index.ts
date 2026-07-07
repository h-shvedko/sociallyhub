// Canonical auth barrel (ADR-0003).
// `@/lib/auth` is the ONLY permitted import path for auth in application
// code. `./config` remains the definition site for authOptions but must be
// imported only by this index and the NextAuth route.
export { authOptions } from "./config"
// Authorization doctrine (ADR-0004): "claim for UI, DB for API" — the
// session's `isPlatformAdmin` claim gates UI/navigation only; API handlers
// must enforce via requirePlatformAdmin()/requireWorkspaceRole(), which
// re-check the database. See src/lib/auth/session.ts.
export {
  getAuthenticatedUser,
  requireSession,
  requireAdmin,
  requirePlatformAdmin,
  requireWorkspaceRole,
  requireClientViewer,
  ApiError,
} from "./session"
export type { AuthUser, WorkspaceMembership, ClientViewerContext } from "./session"
// TEMPORARY (until ADR-0025 removes demo-id mapping): keep old names
// compiling during the Phase 2/3 codemods. Do NOT add new usages — routes
// must use getAuthenticatedUser()/requireSession() instead. These
// re-exports are removed once grep shows zero route-level imports.
export { normalizeUserId, isDemoUser, getDemoUser, getDemoUserId } from "./demo-user"
