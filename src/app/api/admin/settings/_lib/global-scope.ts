// ADR-0004 (Phase 2, item 9) — shared scope guard for /api/admin/settings/**.
//
// Global-scope (workspaceId = null) settings rows are platform-tier
// resources: every global-scope mutation AND every global-scope read in
// these routes requires `User.isPlatformAdmin` (blanket admin-surface rule;
// ADR-0016 may later relax reads of masked, non-secret values). Workspace
// rows stay behind requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN']).
//
// Mixed-scope list handlers (?workspaceId=...&includeGlobal=true) must NOT
// fail the whole request when the caller lacks platform rights — instead the
// query is silently restricted to the workspace scope the caller is
// authorized for. This helper is the DB-verified check used for that
// downgrade decision ("claim for UI, DB for API" — session claims are never
// trusted for enforcement).

import { prisma } from "@/lib/prisma"

/** True iff the user may access global-scope (workspaceId = null) settings. */
export async function canAccessGlobalScope(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  })
  return user?.isPlatformAdmin === true
}
