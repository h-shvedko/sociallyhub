# Deployment Runbook — Self-Hosted Single VM (ADR-0022)

This is the operational runbook for provisioning and running SociallyHub in
production on a single VM with Docker Compose. It pairs with the
`.github/workflows/deploy.yml` continuous-deployment workflow, which does
nothing useful until a VM exists per this document.

**Architecture:** one VM runs nginx (TLS termination) + certbot, the Next.js
app (`app`), the BullMQ worker (`worker`), Postgres 15 and Redis 7 — all via
`docker-compose.prod.yml`. GitHub Actions builds the image once per green
`main` build, pushes it to `ghcr.io/h-shvedko/sociallyhub:sha-<short-sha>`, and
deploys over SSH by swapping the `APP_IMAGE_TAG` in `.env`.

> **Honesty note:** nothing in this document is hypothetical *except* where a
> LIMITATIONS entry says so. If a step references a file, that file is expected
> to exist in the repo at deploy time (`docker-compose.prod.yml`,
> `docker/nginx/`, `.env.production.example`, `scripts/backup/postgres-backup.sh`).

---

## 1. Prerequisites

- **VM:** Ubuntu LTS (22.04 or 24.04), 2+ vCPU, 4 GB+ RAM, 40 GB+ disk.
- **DNS:** an `A` record for your domain (the value you will put in
  `SERVER_NAME`) pointing at the VM's public IP.
- **Firewall:** inbound 22 (SSH), 80 (ACME + redirect), 443 (TLS). Postgres
  and Redis are **not** exposed on host ports — do not open 5432/6379.
- **Docker:** Engine + the compose plugin (v2, i.e. `docker compose`, not
  `docker-compose`):

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"   # log out/in afterwards
  docker compose version            # must print v2.x
  ```

- **Deploy user:** the SSH user used by the workflow must be in the `docker`
  group and have `bash` as its login shell (the remote deploy script uses
  `bash -s`).

## 2. Directory layout: `/opt/sociallyhub`

The deploy workflow hard-codes `cd /opt/sociallyhub`. Lay it out from a
shallow clone of the repo (easiest way to keep compose/nginx config current —
`git pull` when those files change; app code is never built on the VM, it
ships as a GHCR image):

```bash
sudo mkdir -p /opt/sociallyhub
sudo chown "$USER":"$USER" /opt/sociallyhub
git clone --depth 1 https://github.com/h-shvedko/sociallyhub.git /opt/sociallyhub
```

What matters on the VM:

```
/opt/sociallyhub/
├── docker-compose.prod.yml        # the production stack
├── docker/
│   ├── nginx/                     # nginx.conf + conf.d/ (TLS, proxy to app:3099)
│   └── postgres/init.sql          # mounted by the postgres service
├── scripts/backup/postgres-backup.sh
├── .env                           # YOU create this — never committed (ADR-0006)
└── .env.previous                  # written by the deploy workflow (rollback point)
```

## 3. GHCR pull access

The image `ghcr.io/h-shvedko/sociallyhub` is private by default. On the VM,
log in **once** with a read-only personal access token (GitHub → Settings →
Developer settings → Tokens (classic) → scope `read:packages` only):

```bash
docker login ghcr.io -u h-shvedko
# paste the read:packages PAT as the password
```

The credential persists in `~/.docker/config.json` for the deploy user.
(Alternative: make the GHCR package public and skip this.)

## 4. Create `.env`

```bash
cd /opt/sociallyhub
cp .env.production.example .env
chmod 600 .env
```

Fill in every value. Highlights (see the example file for the full list):

| Variable | Notes |
|---|---|
| `APP_IMAGE_TAG` | which image runs; set by the deploy workflow, seed it manually for the first deploy (e.g. `sha-1a2b3c4`) |
| `SERVER_NAME` | your domain, e.g. `app.example.com` — used by nginx **and** by the deploy health gate |
| `NEXTAUTH_URL` | `https://<SERVER_NAME>` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **required, fail-closed (ADR-0006)** — 64 hex chars: `openssl rand -hex 32`. Never reuse the dev/CI key. |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | `openssl rand -hex 24` each |
| `CRON_SECRET` | shared secret for the scheduler catch-up endpoint (§9): `openssl rand -hex 24` |
| SMTP vars | real SMTP relay — note the app reads `SMTP_PASS` in most routes (known `SMTP_PASSWORD`/`SMTP_PASS` inconsistency; set **both** to the same value until it is unified) |

Secrets live only in this file on the VM and in GitHub Actions secrets —
never in git (ADR-0006).

## 5. TLS bootstrap (certbot, first run only)

Chicken-and-egg: nginx's TLS server block references certificates that don't
exist yet. Bootstrap order:

1. **Start nginx serving HTTP only** (the shipped config serves
   `/.well-known/acme-challenge/` from the certbot webroot on port 80 before
   any HTTPS redirect):

   ```bash
   cd /opt/sociallyhub
   docker compose -f docker-compose.prod.yml up -d nginx
   ```

   If nginx refuses to start because the certificate files are missing, issue
   the certificate first with certbot in standalone mode (nginx stopped):

   ```bash
   docker compose -f docker-compose.prod.yml stop nginx
   docker compose -f docker-compose.prod.yml run --rm -p 80:80 certbot \
     certonly --standalone -d "$SERVER_NAME" \
     --email you@example.com --agree-tos --no-eff-email
   ```

2. **Issue the certificate via webroot** (preferred when nginx is up):

   ```bash
   docker compose -f docker-compose.prod.yml run --rm certbot \
     certonly --webroot -w /var/www/certbot -d "$SERVER_NAME" \
     --email you@example.com --agree-tos --no-eff-email
   ```

3. **Reload nginx with TLS:**

   ```bash
   docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
   ```

**Renewal:** the compose `certbot` service runs `certbot renew` on a loop
(webroot method, shared volume with nginx). nginx must re-read renewed
certificates — add the reload cron in §9.

## 6. First deploy (manual, once)

```bash
cd /opt/sociallyhub

# 1. Choose the image: any green main build. Tags are sha-<short-sha> —
#    find them under GitHub → Packages, or from a commit sha:
#    TAG="sha-$(git rev-parse --short=7 origin/main)"
sed -i "s|^APP_IMAGE_TAG=.*|APP_IMAGE_TAG=sha-XXXXXXX|" .env

# 2. Bring up the data layer + proxy
docker compose -f docker-compose.prod.yml up -d postgres redis nginx

# 3. Pull the app image
docker compose -f docker-compose.prod.yml pull app worker

# 4. Apply migrations (migration-first, ADR-0002 — NEVER `prisma db push`)
docker compose -f docker-compose.prod.yml run --rm migrate

# 5. Start the app + worker
docker compose -f docker-compose.prod.yml up -d app worker
```

Do **not** seed production. `prisma/seed.ts` creates demo users with known
passwords (`demo123456` / `password123`).

## 7. Health check

```bash
curl -fsS "https://$SERVER_NAME/api/health" | python3 -m json.tool
```

`/api/health` is real (ADR-0008): it checks Postgres, Redis, filesystem,
`ENCRYPTION_KEY` shape, and the **worker heartbeat** (a Redis key the worker
refreshes every ~20 s).

- `"status": "healthy"` → everything up, including the worker.
- `"status": "degraded"` → **HTTP 200 but something is wrong** (most commonly
  `services.worker.status: "down"`). Do not treat plain HTTP 200 as green —
  check the body. The deploy workflow's health gate asserts
  `"status":"healthy"` for exactly this reason.
- `"status": "unhealthy"` → HTTP 503, two or more services down.

## 8. Continuous deployment + rollback

### How CD works

`.github/workflows/deploy.yml` triggers when "Continuous Integration"
completes successfully on `main` (and via manual `workflow_dispatch`). It
requires GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and
runs in the `production` environment — add required reviewers to that
environment if you want each deploy manually approved.

Per deploy, on the VM: save current tag to `.env.previous` → write new
`APP_IMAGE_TAG` → `pull app worker` → `run --rm migrate` → `up -d app worker`
→ health gate (§7). If the gate fails, it automatically restores the tag from
`.env.previous` and re-ups app+worker.

### Rollback (one command)

The previous image is still on the VM's disk, so rollback needs no pull:

```bash
cd /opt/sociallyhub
sed -i "s|^APP_IMAGE_TAG=.*|APP_IMAGE_TAG=$(cut -d= -f2- .env.previous)|" .env \
  && docker compose -f docker-compose.prod.yml up -d app worker
```

Or from GitHub: run the **Deploy** workflow manually with `image_tag` set to
the previous tag.

**Migrations are NOT rolled back.** They are forward-only with an
expand/contract policy (ADR-0002): a migration must keep working with the
previous app version so a rolled-back app can run against the newer schema.

## 9. Host crontab

`crontab -e` for the deploy user. Two entries (plus the nginx reload):

```cron
# Nightly Postgres backup at 02:15 (runs the repo script INSIDE the postgres
# container — the DB has no host port, and the container ships pg_dump + bash).
# Dumps to the postgres_backups volume (/backups in-container), 7-day retention.
15 2 * * * cd /opt/sociallyhub && set -a && . ./.env && set +a && docker compose -f docker-compose.prod.yml exec -T -e BACKUP_DIR=/backups -e POSTGRES_HOST=localhost -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" postgres bash -s < scripts/backup/postgres-backup.sh >> /var/log/sociallyhub-backup.log 2>&1

# Client-report scheduler catch-up every 30 min (see below).
*/30 * * * * cd /opt/sociallyhub && set -a && . ./.env && set +a && curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" "https://$SERVER_NAME/api/client-reports/schedules/run" >> /var/log/sociallyhub-cron.log 2>&1

# Nginx reload at 04:00 so renewed certbot certificates take effect.
0 4 * * * cd /opt/sociallyhub && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload >> /var/log/sociallyhub-cron.log 2>&1
```

**About the scheduler endpoint (verified against
`src/app/api/client-reports/schedules/run/route.ts`):** primary scheduling is
NOT this cron — the worker drives `ClientReportSchedule` rows via BullMQ
repeatable jobs (ADR-0008 Phase 4). `POST /api/client-reports/schedules/run`
is a catch-up/manual trigger that enqueues one-off jobs for every active
schedule whose `nextRun <= now` — useful when the worker was down at the
scheduled moment. Auth is shared-secret only: header **`x-cron-secret:
<CRON_SECRET>`** (preferred; `Authorization: Bearer <CRON_SECRET>` also
accepted). If `CRON_SECRET` is unset in the app environment the route returns
**500** (deliberate misconfiguration signal), wrong/missing secret returns
401.

**Backups note (ADR-0016):** the app/worker also have their own `backups`
named volume (`/app/backups`) for backups triggered through the admin UI —
that is separate from the nightly `pg_dump` above, which writes to the
`postgres_backups` volume. Off-VM copies: set `S3_BUCKET` in the backup
script's environment (requires `aws` CLI in-container — **not** present in
`postgres:15-alpine`; for S3 offload, instead `docker cp` the dump out and
upload from the host, or wait for ADR-0022's S3/MinIO follow-up).

Verify a backup exists after the first night:

```bash
docker compose -f docker-compose.prod.yml exec postgres ls -lh /backups
```

## 10. Logs

```bash
cd /opt/sociallyhub
docker compose -f docker-compose.prod.yml logs -f app        # Next.js
docker compose -f docker-compose.prod.yml logs -f worker     # BullMQ jobs
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs --since 1h    # everything
```

nginx access/error logs also land in the shared `logs` named volume.

## 11. LIMITATIONS (honest)

- **Single VM = single point of failure.** Postgres, Redis, app, worker and
  TLS all die together. Mitigations: nightly dumps (§9), GHCR images retained
  so any tag can be redeployed to a fresh VM by re-running this runbook.
- **Seconds of downtime on every deploy.** `docker compose up -d` stops the
  old `app` container before the new one is healthy; there is no blue/green
  or rolling swap. In-flight requests during the swap fail.
- **Migrations run before the swap and are not reverted on rollback.** A bad
  destructive migration cannot be auto-rolled-back — the expand/contract
  discipline (ADR-0002) is the actual safety mechanism, plus the nightly dump.
- **Monitoring is not wired up.** `/api/health` and `docker compose logs` are
  the only observability today. The Prometheus/Grafana/Loki services are an
  optional compose profile at best and their alerting/dashboards are ADR-0023
  scope — do not claim monitoring exists until then.
- **Backups are on-VM by default.** The nightly dump lands on the same disk
  as the database. Off-site copies are manual until S3/MinIO offload lands.
- **TOFU host-key trust.** The deploy workflow uses
  `StrictHostKeyChecking=accept-new`; the first-ever connection from a runner
  trusts whatever host key it sees. Runners are ephemeral, so effectively
  every run is "first" — if you want strict pinning, bake a `known_hosts`
  entry into the workflow.
- **SMTP env var inconsistency** (`SMTP_PASSWORD` vs `SMTP_PASS`) is still in
  the codebase; set both (§4).
