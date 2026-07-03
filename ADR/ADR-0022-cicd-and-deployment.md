# ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub currently has **three contradictory deployment stories** and a CI pipeline that
cannot complete a green run. Every claim below was verified against the repository on
2026-07-02.

**The deployment target is ambiguous.** `.github/workflows/deploy.yml` deploys to Vercel
(`amondnet/vercel-action@v25`), while `docker-compose.prod.yml` describes a self-hosted
Docker stack and `k8s/` + `scripts/deploy/deploy.sh` describe a Kubernetes rollout
(`kubectl` against `ghcr.io/your-org` images). None of the three works:

- `deploy.yml` invokes CI via `uses: ./.github/workflows/ci.yml`, but `ci.yml` declares
  only `push`/`pull_request` triggers — no `workflow_call` — so the reusable-workflow call
  fails immediately. It also runs `npm run test:e2e:production`, a script that does not
  exist in `package.json`, and pins `NODE_VERSION: '18'` (as does `cron-tests.yml`) while
  `package.json` `engines` requires `node >=20` and `ci.yml`/Dockerfiles use Node 20.
- `docker-compose.prod.yml` mounts `./docker/nginx/nginx.conf`, `./docker/nginx/default.conf`,
  `./docker/nginx/ssl` (lines 115–117) and `./docker/monitoring/grafana/{dashboards,datasources}`
  (lines 164–165) — **none of these paths exist** (`docker/` contains only `entrypoint.sh`,
  `start-dev.sh`, `postgres/`, and `monitoring/{loki,prometheus,promtail}.yml`). It also
  builds `sociallyhub:latest` locally with no registry, no versioned tags, and no rollback
  path, and publishes Postgres 5432 / Redis 6379 directly to the host.
- `k8s/secrets.yaml` contains checked-in base64 placeholders (decoded:
  `please-replace-with-actual-secret`, `password`, `redispassword`);
  `k8s/app-deployment.yaml` and `k8s/ingress.yaml` hardcode `your-domain.com`. Nothing has
  ever been deployed from these manifests.

**The production image cannot even be built.** `Dockerfile.prod`'s `deps` stage runs
`npm ci --only=production` (line 21) and the `builder` stage reuses those prod-only
`node_modules` for `npm run build` — but `typescript`, Tailwind, and the other build
toolchain packages are devDependencies, so `next build` fails. (This is worse than the
audit recorded, which flagged only the seed path.) Additionally, `docker/entrypoint.sh`
runs `npx prisma generate` at **runtime** (line 28) inside a standalone-output runner image,
and its optional `npx prisma db seed` (line 33, gated by `SEED_DATABASE=true`) requires
`tsx` — a devDependency absent from the image.

**CI is structurally broken.** `ci.yml` uses `actions/upload-artifact@v3` /
`download-artifact@v3` in eight places — versions deprecated and disabled by GitHub, so the
build/e2e/performance/visual jobs fail on current runners. Even if they ran:
`playwright.config.ts` sets `webServer: process.env.CI ? undefined : {...}` (line 114) and
no workflow step starts the app, so the e2e jobs have no server to test; the inline 70%
coverage gate (ci.yml lines 219–246) is unattainable with ~7 test files (see ADR-0021); and
the `database-validation` job runs `npx prisma validate`, which **fails today** on the
current schema (~18 errors, duplicate `UserSession` model — see ADR-0002). A `deploy-preview`
job also pushes PRs to Vercel, which conflicts with the owner decision below.

**Owner decision (binding, 2026-07-02):** deployment standardizes on self-hosted Docker —
docker-compose now, Kubernetes optional later — and the Vercel workflow is removed.

The problem: define one deployment topology, one pipeline that can actually go green, and a
repeatable, reversible release process.

## Decision Drivers

- One team, one VM budget: operational simplicity beats orchestration features today.
- The pipeline must be **honest** — every gate must be passable and meaningful (ADR-0021).
- Build once, promote the same artifact: the image that passed e2e is the image deployed.
- Migration-first schema workflow (ADR-0002) must be enforced in CI, not bypassed by
  `db push`.
- Secrets never in git (ADR-0006); the checked-in k8s placeholders normalized a bad habit.
- Background worker (ADR-0008) and Stripe webhooks (ADR-0019) require a long-running
  self-hosted process — a serverless-first Vercel topology fights both.
- Rollback must be a routine operation, not an emergency improvisation.

## Considered Options

### Option 1 — Keep Vercel for the app, managed Postgres/Redis
Fix `deploy.yml`, keep Vercel previews, use Neon/Upstash.
- **Pros:** zero server ops; instant preview deployments; CDN included.
- **Cons:** the BullMQ worker (ADR-0008) and socket-based realtime (ADR-0010) need a
  separate always-on host anyway, splitting the topology; local file uploads
  (`public/uploads`, ADR-0007) are incompatible with immutable serverless filesystems;
  function timeout limits threaten report generation and scheduled runs; contradicts the
  binding owner decision.

### Option 2 — docker-compose on a single VM (chosen)
One VM runs nginx + certbot, app, worker, Postgres, Redis via `docker-compose.prod.yml`;
GitHub Actions builds a versioned image, pushes to GHCR, and deploys over SSH with
`docker compose pull && up -d` plus an explicit migration step.
- **Pros:** matches the dev environment (already compose-based); one topology for app,
  worker, cron, and webhooks; cheapest; every moving part is inspectable with `docker ps`;
  rollback = redeploy the previous tag.
- **Cons:** single point of failure; vertical scaling only; we own backups, TLS renewal,
  and OS patching; brief downtime during `up -d` container swap (acceptable at current
  traffic; can add a second app container + nginx upstream later).

### Option 3 — Fix and adopt the existing Kubernetes manifests
Repair `k8s/`, deploy to a managed cluster via `scripts/deploy/deploy.sh`.
- **Pros:** rolling deployments, HPA, self-healing; manifests partially exist.
- **Cons:** the manifests were never exercised (placeholder secrets, `your-domain.com`,
  no monitoring parity with compose); cluster cost and operational complexity are
  unjustified for a single-team product with no HA requirement; running Postgres inside
  k8s (as `k8s/postgres-deployment.yaml` does) is its own discipline.

### Option 4 — Container PaaS (Fly.io / Render / Railway)
- **Pros:** managed TLS/registry/rollbacks with container semantics.
- **Cons:** vendor lock-in and per-service pricing; volume semantics for uploads and
  Postgres vary by provider; the owner decision specifies self-hosted.

## Decision Outcome

**Option 2.** Target topology v1 is docker-compose on a single VM; Kubernetes remains a
documented later option, but the current `k8s/` tree and kubectl deploy scripts are
**deleted** (git history preserves them) rather than quarantined — unmaintained manifests
with placeholder secrets are a drift and copy-paste hazard, and they would be rewritten
against the fixed image anyway.

### Topology v1 (docker-compose.prod.yml, rewritten)

| Service | Image | Notes |
|---|---|---|
| `nginx` | `nginx:alpine` | TLS termination, proxy to `app:3099`; config in `docker/nginx/` (created by this ADR) |
| `certbot` | `certbot/certbot` | webroot renewal, shared volume with nginx |
| `app` | `ghcr.io/<org>/sociallyhub:<tag>` | Next.js standalone server, no host port; replicas=1 |
| `worker` | same image, `command: node worker.js` | BullMQ processors per ADR-0008 (entrypoint created there) |
| `migrate` | same image, one-shot `npx prisma migrate deploy` | run explicitly at deploy time, not per-container |
| `postgres` | `postgres:15-alpine` | internal network only — **remove the host port mapping** |
| `redis` | `redis:7-alpine` | internal only, `--requirepass` |

The Prometheus/Grafana/Loki/Promtail services currently in `docker-compose.prod.yml` move
behind a compose `monitoring` profile and are out of scope until ADR-0023 provides real
configs (today's Grafana mounts point at nonexistent directories).

### Pipeline (single `ci.yml`, rewritten; `deploy.yml` replaced)

1. **lint** — `npm run lint`.
2. **typecheck** — add `"typecheck": "tsc --noEmit"` to `package.json` and call it (the
   current ci.yml already runs `npx tsc --noEmit` inline in the lint job; promoting it to a
   script makes it runnable locally and keeps CI/local parity).
3. **schema** — `prisma validate`, `prisma migrate deploy` against a service Postgres, and
   a **drift check** (`prisma migrate diff --from-migrations --to-schema-datamodel
   --exit-code`) so `db push`-style drift fails CI (ADR-0002). Blocked until ADR-0002
   lands — the schema fails validation today.
4. **unit/integration** — Jest with honest thresholds per ADR-0021 (the current 70% inline
   gate and `fail_ci_if_error: true` Codecov gate are removed; ADR-0021 owns ratchets).
5. **build image once** — `docker/build-push-action` builds `Dockerfile.prod` (fixed),
   tagged `sha-<short-sha>` and `<branch>`, loaded locally for the e2e job and pushed to
   GHCR only after e2e passes on `main`. This replaces the `.next/` artifact passing that
   currently depends on disabled `*-artifact@v3` actions.
6. **e2e against the real image** — `docker compose -f docker-compose.ci.yml up` (app image
   under test + postgres + redis + mailhog), migrate + seed, then Playwright pointed at
   `http://localhost:3099`. This fixes the "webServer disabled in CI, nothing starts the
   app" hole. Gate on the smoke project only at first (ADR-0021); full matrix stays in
   `cron-tests.yml`.
7. **deploy (main only, environment-protected)** — SSH to the VM:
   `docker compose pull && docker compose run --rm migrate && docker compose up -d app worker
   && curl -fsS https://<host>/api/health`. Failure of the health gate triggers automatic
   redeploy of the previous tag.

### Versioning and rollback

- Every deploy uses an immutable `sha-<short-sha>` tag; `:latest` is never deployed.
- The VM keeps the current tag in `/opt/sociallyhub/.env` (`APP_IMAGE_TAG`); rollback is
  `APP_IMAGE_TAG=<previous> docker compose up -d app worker` — one command, no rebuild.
- Database migrations are **forward-only** (ADR-0002): rollback of app code never rolls
  back the schema; destructive migrations require an expand/contract sequence.

### Environment contract

`.env.example` already exists (169 lines) and stays the dev contract, but it must be
reconciled: standardize on `SMTP_PASSWORD` (four API routes currently read `SMTP_PASS`
while compose sets `SMTP_PASSWORD` — code fix, tracked in ADR-0024), and add the variables
other accepted ADRs introduce (`ENCRYPTION_KEY` per ADR-0006, `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` per ADR-0019, `INIT_JOBS` / worker settings per ADR-0008,
`CRON_SECRET` for `/api/client-reports/schedules/run`). A new `.env.production.example`
documents the VM-side file consumed by compose (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`,
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `APP_IMAGE_TAG`, SMTP, Stripe). CI validates that the
app boots with only documented variables set.

## Consequences

### Positive

- One deployment story; the Vercel/k8s/compose contradiction ends. Deleted manifests can't
  drift or leak placeholder-secret habits.
- The artifact tested in e2e is byte-identical to the artifact deployed.
- CI can actually reach green: disabled actions replaced, phantom scripts removed, the app
  is actually running when Playwright executes, Node 20 everywhere.
- Rollback is a one-command, sub-minute operation with immutable tags.
- The worker, Stripe webhooks (ADR-0019), and future realtime (ADR-0010) share one host and
  one process supervisor.

### Negative

- Single VM = single point of failure; HA requires future work (second app container is
  easy; Postgres HA is not). Accepted at current scale.
- Brief (seconds) downtime on container swap until a blue-green or dual-container upstream
  is added.
- We own TLS renewal, OS patching, and backups — mitigated by certbot automation and the
  retained `scripts/backup/postgres-backup.sh` on host cron.
- Losing Vercel PR previews; reviewers use the compose stack locally instead.
- k8s users must resurrect manifests from git history if that path is ever chosen.

## Implementation Plan

### Phase 0 — Remove contradictions (S)
1. Delete `.github/workflows/deploy.yml` (Vercel) and the `deploy-preview` job in `ci.yml`. (S)
2. Delete `k8s/` (all 7 manifests incl. placeholder `secrets.yaml`), `scripts/deploy/deploy.sh`,
   `scripts/deploy/rollback.sh`, `scripts/backup/backup-cron.yaml` (k8s CronJob). Keep
   `scripts/backup/postgres-backup.sh` and `redis-backup.sh` for host cron. (S)
3. Delete stale root `Dockerfile` (superseded by `Dockerfile.prod`); add `logs/` to
   `.gitignore` and remove committed winston logs (overlaps ADR-0024). (S)

### Phase 1 — Make CI honest and green (M)
4. `package.json`: add `"typecheck": "tsc --noEmit"`; remove nothing else yet. (S)
5. `ci.yml`: bump all `actions/upload-artifact@v3`/`download-artifact@v3` → `@v4`
   (interim), set jobs to Node 20 via `engines`-aligned env, drop the inline 70% coverage
   gate and `fail_ci_if_error` per ADR-0021, fix the `performance` job (it installs
   Playwright browsers but `npm run test:performance` runs Jest). (M)
6. `cron-tests.yml`: Node 18 → 20; add `npm run db:seed` before `test:all`. (S)
7. Gate: the `schema` job stays red until ADR-0002 fixes `prisma validate`; land ADR-0002
   Phase 1 first. (dependency, not a task)

### Phase 2 — Buildable, correct production image (M)
8. `Dockerfile.prod`: `deps` stage installs **all** deps (`npm ci`); add a separate
   `prod-deps` stage (`npm ci --omit=dev`) if the runner ever needs full `node_modules`
   (standalone output means it shouldn't); builder keeps `npx prisma generate` +
   `npm run build`. (M)
9. `docker/entrypoint.sh`: remove runtime `npx prisma generate` and the
   `SEED_DATABASE`/`npx prisma db seed` block (seeding policy moves to ADR-0025;
   migrations move to the deploy step). Entrypoint = wait-for-deps + `exec node server.js`. (S)
10. Create `docker/nginx/nginx.conf` and `docker/nginx/conf.d/default.conf`: HTTP→HTTPS
    redirect, ACME webroot location, `location /health` (the compose healthcheck already
    probes it), proxy to `app:3099` with websocket upgrade headers, `client_max_body_size 25m`. (M)

### Phase 3 — Rewrite the prod compose + env contract (M)
11. Rewrite `docker-compose.prod.yml`: registry image + `APP_IMAGE_TAG`, add `worker` and
    one-shot `migrate` services, add `certbot`, remove host port mappings for postgres/redis,
    move Prometheus/Grafana/Loki/Promtail behind a `monitoring` profile (configs deferred to
    ADR-0023), drop the obsolete `version: '3.8'` key. (M)
12. Reconcile `.env.example` (add ENCRYPTION_KEY, Stripe, INIT_JOBS, CRON_SECRET; note the
    `SMTP_PASS` code fix) and create `.env.production.example`. (S)

### Phase 4 — Build-once pipeline and e2e-against-image (L)
13. Create `docker-compose.ci.yml` (image under test + postgres + redis + mailhog). (S)
14. `ci.yml`: replace the build-artifact flow with `docker/build-push-action` producing
    `ghcr.io/<org>/sociallyhub:sha-<sha>`; e2e job starts the compose stack, runs
    `migrate deploy` + `db:seed`, sets a real Playwright `baseURL`, and removes the
    `webServer: CI ? undefined` hack in `playwright.config.ts` (server is external in CI). (L)
15. Push to GHCR only on `main` after e2e passes. (S)

### Phase 5 — Continuous deployment (M)
16. New `.github/workflows/deploy.yml`: `workflow_run` on CI success for `main` (or a
    `deploy` job with `environment: production`), SSH (appleboy/ssh-action or plain
    `ssh` with a deploy key) → `compose pull`, `compose run --rm migrate`,
    `compose up -d app worker`, health-gate `GET /api/health`, auto-rollback to the
    previous `APP_IMAGE_TAG` on failure, Slack notify. (M)
17. VM provisioning runbook `docs/ops/deployment.md`: Docker install, `/opt/sociallyhub`
    layout, `.env` placement, certbot bootstrap, host crontab for
    `scripts/backup/postgres-backup.sh` and the report-scheduler curl
    (`POST /api/client-reports/schedules/run` with `CRON_SECRET`). (M)

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Schema is invalid today — pipeline stays red regardless of this ADR | Sequence ADR-0002 first; land Phases 0–1 in parallel since they don't touch the schema job |
| Single-VM outage takes down app, worker, and DB | Documented restore runbook + nightly `pg_dump` off-box (S3 option already in `postgres-backup.sh`); revisit HA when revenue justifies it |
| e2e flakiness blocks every deploy | Gate on a small smoke project only (ADR-0021); full browser matrix runs in `cron-tests.yml`, non-blocking |
| Migration failure mid-deploy leaves app/schema mismatched | `migrate` runs **before** the new app containers start; forward-only + expand/contract policy (ADR-0002); health gate + tag rollback for the app layer |
| Secrets on the VM (`.env`) leak | File perms 600, deploy user without sudo, secrets never in workflow logs; rotation procedure per ADR-0006; any value ever committed (k8s placeholders) treated as burned |
| GHCR pull failures during deploy | Images retained ≥90 days; previous tag already present on host from the prior deploy, so rollback works offline |
| Seeding accidentally enabled in prod (`SEED_DATABASE` flag) | Flag and entrypoint path removed entirely in Phase 2; demo/seed policy owned by ADR-0025 |

## Related ADRs

- ADR-0001: Record Architecture Decisions — process this document follows.
- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — hard prerequisite for
  the CI `schema` job and the deploy-time `migrate` step.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — env/secret handling
  rules this pipeline enforces (`ENCRYPTION_KEY`, rotation of burned values).
- ADR-0008: Background Jobs and the Publishing Pipeline — supplies the `worker.js`
  entrypoint that the `worker` compose service runs.
- ADR-0010: Realtime Transport and Notification Delivery — nginx websocket upgrade
  headers are provisioned here for its future transport.
- ADR-0019: Billing and Subscriptions with Stripe — webhook endpoint requires the stable
  self-hosted HTTPS origin this topology provides.
- ADR-0021: Testing Strategy and Honest Quality Gates — defines which pipeline stages
  block and the coverage-ratchet replacing the fake 70% gate.
- ADR-0023: Observability: Real Metrics, Logging, and Health — will populate the
  `monitoring` compose profile and Grafana/Loki configs.
- ADR-0024: Codebase Hygiene — removal of the stale `Dockerfile`, committed `logs/`,
  duplicate next configs, and the `SMTP_PASS` mismatch fix.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — owns seeding policy after the
  prod-entrypoint seed path is removed.
