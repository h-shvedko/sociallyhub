# API Route Conventions

Status: binding for all routes under `src/app/api/**` (ratified by
[ADR-0003](../ADR/ADR-0003-auth-helpers-and-route-conventions.md)).
The repair tracks ADR-0011 (support) and ADR-0012 (admin RBAC) adopt these
conventions first; every new or rewritten route must follow them. ESLint
rules (`no-restricted-imports`, `no-floating-promises`, `no-misused-promises`
for `src/app/api/**`) enforce them in CI (ADR-0021/ADR-0022).

## 1. Handler order

Every handler follows the same sequence:

1. **`await params`** — Next 15 `Promise` form (dynamic routes only).
2. **Authenticate** — `requireSession()` or `requireAdmin()` from `@/lib/auth`.
3. **Authorize** — workspace/resource-level checks (does this user's workspace
   own the resource?). Semantics are being consolidated under ADR-0004; until
   then keep checks explicit and scoped to the workspace.
4. **Validate input** — zod-parse the body / query params.
5. **Do the work** — Prisma queries, business logic.
6. **Respond** — `NextResponse.json(...)` on success; the shared error
   envelope on failure.

Authentication **always precedes body parsing**. Never read or parse the
request body before the session check has passed.

## 2. Async params everywhere (Next 15)

Dynamic routes declare params as a `Promise` and `await` them:

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ...
}
```

The legacy sync form `{ params: { id: string } }` is **banned**. It is
deprecated on Next 15.5 and slated for removal.

## 3. Auth: helpers only — never `getServerSession` directly

Routes **never call `getServerSession()` directly** — and never with zero
arguments (that skips the app's session callback, so `session.user.id` is
never populated and the route 401s unconditionally). Use the helpers from
the canonical barrel:

```ts
import { requireSession, requireAdmin, getAuthenticatedUser, ApiError } from '@/lib/auth'
```

| Helper | Behavior |
|---|---|
| `getAuthenticatedUser()` | Returns `AuthUser \| null`; never throws. For routes with optional auth. |
| `requireSession()` | Returns `AuthUser`; throws `ApiError(401)` when unauthenticated. |
| `requireAdmin()` | `requireSession()` + interim OWNER/ADMIN-in-any-workspace gate; throws `ApiError(403)`. Body will be replaced by ADR-0004. |

The helpers resolve the session **and** the legacy demo-id normalization
exactly once. `normalizeUserId` must not appear in route code — it lives
inside `getAuthenticatedUser()` until ADR-0025 deletes it.

`@/lib/auth` is the **only** permitted auth import path. Banned:
`@/lib/auth/utils`, `@/lib/auth-utils`, `@/lib/auth/auth-options` (deleted),
`@/lib/auth/demo-user`, `@/lib/auth/config` (outside `src/lib/auth/**`), and
`authOptions` from `@/app/api/auth/[...nextauth]/route` (the route file does
not export it).

## 4. Validation with zod

Request bodies and query params are parsed with zod using `safeParse`;
failures return **400** with flattened issues in `details`. Schemas live
next to the route or in `src/lib/validations/`.

```ts
const parsed = updateSchema.safeParse(await request.json())
if (!parsed.success) {
  return jsonError(400, 'Invalid request body', {
    code: 'VALIDATION_ERROR',
    details: parsed.error.flatten(),
  })
}
```

## 5. Error envelope

All error responses use one shape:

```json
{ "error": "Human-readable message", "code": "OPTIONAL_CODE", "details": {} }
```

Produced only via the shared helpers in `@/lib/api/respond`:

- `jsonError(status, message, opts?)` — build an envelope response directly.
- `handleApiError(err)` — use in every `catch` block. Converts a thrown
  `ApiError` to its status/message/code and **anything else to a generic
  500**. Stack traces, Prisma error messages, and other internals are logged
  server-side and never leaked to the client (ADR-0005).

Do not hand-roll `{ message: ... }`, bare-string bodies, or pass raw `error`
objects into responses.

## 6. Prisma import

Named import only — `src/lib/prisma.ts` has no default export:

```ts
import { prisma } from '@/lib/prisma'   // ✅
import prisma from '@/lib/prisma'       // ❌ does not resolve
```

## 7. Exemplary route template

Copy this structure for new routes (including generated code). It is written
against the real `Client` model; note that `src/app/api/clients/[id]/route.ts`
itself has NOT yet been migrated to this shape (it still calls
`getServerSession(authOptions)` directly — ADR-0011/0012 scope), so treat the
template below, not that file, as the reference:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireSession, ApiError } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

const updateClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(), // Client.email is a required String — never null
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
})

/** Resolve the client iff it belongs to a workspace the user is a member of. */
async function findAuthorizedClient(userId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      workspace: { users: { some: { userId } } },
    },
  })
  if (!client) {
    // 404 (not 403) so we do not reveal the resource exists.
    throw new ApiError(404, 'Client not found', 'NOT_FOUND')
  }
  return client
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params                  // 1. await params
    const user = await requireSession()          // 2. authenticate
    const client = await findAuthorizedClient(user.id, id) // 3. authorize
    return NextResponse.json({ client })         // 6. respond
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params                  // 1. await params
    const user = await requireSession()          // 2. authenticate
    await findAuthorizedClient(user.id, id)      // 3. authorize

    const parsed = updateClientSchema.safeParse(await request.json()) // 4. validate
    if (!parsed.success) {
      return jsonError(400, 'Invalid request body', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const client = await prisma.client.update({  // 5. work
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json({ client })         // 6. respond
  } catch (err) {
    return handleApiError(err)
  }
}
```

Notes on the template:

- The `catch` block is `handleApiError(err)` and nothing else — `ApiError`
  thrown anywhere inside (helpers, authorization, business logic) maps to its
  own status; unexpected errors become a generic 500.
- Admin routes swap `requireSession()` for `requireAdmin()`; everything else
  is identical.
- Query-param validation follows the same pattern:
  `schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))`.
