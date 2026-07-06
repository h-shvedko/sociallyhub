# ADR-0027: Workspace Switching (Session-Scoped Active Workspace)

- **Date:** 2026-07-06
- **Status:** Proposed (stub — deferred from ADR-0017 Decision E4)
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

## Context

ADR-0017 (Decision E4) deleted `/dashboard/workspace` and its "Switch Workspace"
header entry because the page was a mock: a hardcoded `mockWorkspaces` array whose
"Switch" button only mutated local component state and whose "Create" dialog
persisted nothing. A real switcher is not a wiring task — it needs a concept the
codebase does not yet have: a **session-scoped active workspace**.

Today every route resolves "the" workspace on its own, typically via
`userWorkspace.findFirst` (even `GET /api/user/workspace` just returns the first
membership). There is no notion of "the workspace the user is currently acting in."
Building a switcher means introducing that concept coherently across ~299 routes,
which is an ADR-0004-scale cross-cutting design, not a page rewrite.

## Scope to decide when picked up

- **Active-workspace source of truth**: a value on the JWT/session (set at login,
  changed by a switch action) vs. a per-request header vs. a DB `User.
  activeWorkspaceId`. Must compose with ADR-0004's `requireWorkspaceRole` helpers.
- **Switch endpoint**: `POST /api/user/active-workspace` validating membership
  (ADR-0004) and updating the session; a real workspace-create flow that persists
  `Workspace` + owner `UserWorkspace`.
- **Route migration**: replace ad-hoc `findFirst` workspace resolution with a
  single `getActiveWorkspace(session)` helper; sequence the migration so no route
  silently reads the wrong workspace mid-rollout.
- **UI**: a real switcher (header menu + a workspaces page) fed by the user's
  `UserWorkspace` memberships, restoring the capability ADR-0017 removed.

## Related ADRs

- ADR-0004 (authorization helpers this must build on — prerequisite),
  ADR-0017 (removed the mock page + nav entry that this restores),
  ADR-0003 (route conventions), ADR-0012 (admin workspace management overlap).
