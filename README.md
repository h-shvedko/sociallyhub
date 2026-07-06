# SociallyHub

Social media management platform: manage multiple social accounts from a single interface,
with multi-tenant workspaces, role-based access control, content scheduling, a unified inbox,
team collaboration, analytics, client management, AI assistance, and a built-in Help Center
and Support system.

> **Project status:** under active remediation. The honest, code-verified status of every
> subsystem lives in **`CLAUDE.md` → "Current State"**; the decision record and fix plan live
> in **`ADR/README.md`**. Do not treat this README (or any other doc) as a completeness claim.

## Documentation map

| Doc | What it's for |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Status ground truth** — verified code audit, subsystem reality table, security posture |
| [`TODO.md`](TODO.md) | The single open-work roadmap (each item cross-referenced to its ADR) |
| [`ADR/README.md`](ADR/README.md) | Architecture Decision Records — index and implementation order |
| [`STRUCTURE.md`](STRUCTURE.md) | Detailed page-by-page / route-by-route codebase map |
| [`docs/api-conventions.md`](docs/api-conventions.md) | API route conventions (auth helpers, error responses) |
| [`SOCIAL_INTEGRATION_GUIDE.md`](SOCIAL_INTEGRATION_GUIDE.md) | Setting up real social platform OAuth credentials |

## Tech stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, NextAuth.js
- **Database**: PostgreSQL 15 with Prisma ORM (migration-first — see below)
- **Jobs & realtime**: Redis 7, BullMQ worker (`src/worker.ts`), SSE over Redis pub/sub
- **Email (dev)**: Mailhog
- **Dev/deploy**: Docker Compose (self-hosted deployment target)

## Quickstart

```bash
./dev-local.sh                 # start everything (Postgres, Redis, Mailhog, app, worker)
./dev-local.sh --force-update  # force schema update (migrate deploy) & restart
# full reset:
docker-compose down -v && ./dev-local.sh
```

### Services & ports

| Service | URL / port |
|---|---|
| App | http://localhost:3099 |
| Mailhog UI (dev email) | http://localhost:8025 (SMTP 1025) |
| Prisma Studio (optional, `tools` profile) | http://localhost:5555 |
| PostgreSQL | 5432 |
| Redis | 6379 |

### Demo login

Seeded by `prisma/seed.ts` (~30k rows) and printed by the dev scripts:

- **demo@sociallyhub.com / demo123456** — OWNER of workspace `demo-workspace`
- All 50 generated mock users share password `password123`

## Key commands

```bash
# Development
docker-compose up -d
docker-compose logs -f app
npm run dev                    # if running the app outside Docker

# Database — MIGRATION-FIRST (ADR-0002). `prisma db push` is banned; CI fails on drift.
npx prisma migrate dev --name <change>   # create + apply a new migration (dev)
npx prisma migrate deploy                # apply committed migrations (CI/existing envs)
npx prisma generate
npm run db:check                         # validate schema + migration drift check
                                         # (needs SHADOW_DATABASE_URL → empty throwaway DB)
npm run db:seed

# Quality
npm run lint
npm run type-check
npm test
npm run build
```

## Environment

Key variables (dev values are wired into `docker-compose.yml` / `.env.local`):

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` — NextAuth.js
- `REDIS_URL` — Redis (jobs, realtime, rate limiting)
- `ENCRYPTION_KEY` — **required in every env** (AES-256-GCM token/credential encryption, ADR-0006; fail-closed)
- `SMTP_HOST` / `SMTP_PORT` — Mailhog in dev (localhost:1025)
- `OPENAI_API_KEY` — optional; AI features fall back to a heuristic provider without it
- Social platform OAuth credentials — see `SOCIAL_INTEGRATION_GUIDE.md`. Without real
  credentials the providers are stubs and publish jobs **fail honestly** (no fabricated results).
- Feature flags: `FEATURE_COMMUNITY`, `FEATURE_DOCS_MANAGEMENT`, `FEATURE_DISCORD` — deferred
  subsystems, off by default (their routes 404; ADR-0013/0014/0015)

## Architecture notes

- **Multi-tenant**: `User` ↔ `Workspace` via `UserWorkspace` with roles
  (OWNER, ADMIN, PUBLISHER, ANALYST, CLIENT_VIEWER); platform tier is the explicit
  `User.isPlatformAdmin` flag (ADR-0004).
- **API conventions**: auth via `requireSession`/`requirePlatformAdmin` from `@/lib/auth`,
  responses via `jsonError`/`handleApiError` from `@/lib/api/respond`, prisma from
  `@/lib/prisma` — see `docs/api-conventions.md` (enforced by ESLint rules).
- **Publishing**: `/api/posts` enqueues BullMQ `publish:{postId}` jobs; a dedicated worker
  container processes them and writes true per-variant outcomes (ADR-0008/0009).
- **Storage**: one storage service (`src/lib/storage/`) behind authenticated
  `GET /api/files/[...key]` — no world-readable uploads (ADR-0007).
- **Notifications/realtime**: persist-first `notifyUser()`, SSE stream at
  `/api/notifications/stream` over Redis pub/sub, web-push via VAPID (ADR-0010).

## Testing

- Unit tests: Jest (`npm test`) — the test infrastructure has known gaps being fixed under
  ADR-0021 (broken module alias config, coverage gate, E2E web server in CI).
- E2E: Playwright (`e2e/`), runs against the seeded dev environment.
- Manual smoke: start `./dev-local.sh`, check Mailhog at :8025, sign in with the demo user.

## Contributing / working in this repo

1. Read `CLAUDE.md` "Current State" first — it is the only trusted status source.
2. Pick work from `TODO.md`; read the owning ADR before starting.
3. Schema changes ship as committed migrations (`npx prisma migrate dev --name <change>`).
4. Follow `docs/api-conventions.md` for any API route you touch.
5. Deferred subsystems (Community, Docs Management, Discord) stay behind their flags —
   don't build on them until their ADR un-defer criteria are met.
