#!/bin/sh
# ============================================================================
# Production entrypoint (ADR-0022 + ADR-0025): wait-for-deps + assert
# ENCRYPTION_KEY + seed (node dist/seed.js, app container only) + exec node
# server.js.
#
# What MOVED OUT of here, and where it went:
#   - `npx prisma migrate deploy`  → the explicit one-shot `migrate` service in
#     docker-compose.prod.yml (runs the bundled Prisma CLI via
#     `node node_modules/prisma/build/index.js migrate deploy`; app/worker
#     start only after it completes). Migrations are a deploy-time step, not a
#     per-container-boot side effect — and `npx` in the standalone image would
#     have tried to download the prisma CLI from the registry at runtime.
#   - `npx prisma generate`        → build time only (Dockerfile.prod builder
#     stage). The generated client is baked into the image; regenerating at
#     runtime is impossible (no prisma CLI dev tooling) and pointless (the
#     schema cannot change inside a built image).
#   - SEED_DATABASE / `npx prisma db seed` → REPLACED (ADR-0025 D5). tsx is not
#     in the production image, so seeding now runs the esbuild-bundled
#     `node dist/seed.js` (Dockerfile.prod), tier-selected by SEED_TIER
#     (default: minimal — prod-safe + idempotent). See the seed block below.
#
# WHO seeds: ONLY this entrypoint, i.e. ONLY the `app` container. The `worker`
# service overrides the image CMD with `node dist/worker.js`, so it never runs
# this script and never seeds — no double-run. Migrations are already applied
# by the one-shot `migrate` service the app depends_on
# (service_completed_successfully), so the schema exists by the time we seed.
#
# `nc` is busybox nc, present in the node:20-alpine base — no extra package.
# ============================================================================
set -e

echo "🚀 Starting SociallyHub Production..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until nc -z "${DATABASE_HOST:-localhost}" "${DATABASE_PORT:-5432}"; do
    echo "Database is unavailable - sleeping"
    sleep 2
done
echo "✅ Database is up!"

# Fail closed on a missing/malformed encryption key (ADR-0006). Asserting here
# means misconfiguration breaks deployment, not the first user request. We only
# report presence/shape — the key value is never printed.
echo "🔐 Verifying ENCRYPTION_KEY..."
if [ -z "${ENCRYPTION_KEY}" ]; then
    echo "❌ ENCRYPTION_KEY is not set. It is REQUIRED (no fallback)."
    echo "   Generate one with: openssl rand -hex 32"
    echo "   Then provide it via your env file / secret (32 bytes = 64 hex chars)."
    exit 1
fi
if ! printf '%s' "${ENCRYPTION_KEY}" | grep -Eq '^[0-9a-fA-F]{64}$'; then
    echo "❌ ENCRYPTION_KEY is malformed: expected exactly 64 hexadecimal characters (32 bytes)."
    echo "   Generate a valid key with: openssl rand -hex 32"
    exit 1
fi
echo "✅ ENCRYPTION_KEY present and well-formed."

# Wait for Redis to be ready
echo "⏳ Waiting for Redis connection..."
until nc -z "${REDIS_HOST:-localhost}" "${REDIS_PORT:-6379}"; do
    echo "Redis is unavailable - sleeping"
    sleep 2
done
echo "✅ Redis is up!"

# Seed the database (ADR-0025 D5) — runs AFTER the one-shot `migrate` service
# has applied migrations (compose depends_on: migrate service_completed_successfully),
# so the schema is present. The `minimal` tier (default) is prod-safe and
# idempotent (find-or-create / upsert by natural key), so re-running it on every
# app restart is a no-op. Seeding FAILS LOUD: `set -e` (top of file) turns any
# non-zero exit into a boot failure — there is intentionally NO `|| echo` mask
# (the old failure-swallowing behavior is what ADR-0025 D5 removes).
#
# DEMO_MODE is intentionally NOT set in docker-compose.prod.yml, so even if
# SEED_TIER were mis-set to `demo` the demo seeder hard-aborts (it requires
# DEMO_MODE=true) — prod cannot fabricate showcase data.
#
# SEED_ON_BOOT=false opts a deployment OUT of boot-seeding. It exists for the
# CI e2e compose (docker-compose.ci.yml), which has NO `migrate` one-shot
# service — the CI runner applies migrations + seeds fixtures from the host
# AFTER `docker compose up -d`, so a boot-seed here would race ahead of the
# migrations and hit "relation \"public.users\" does not exist". Prod leaves it
# unset (defaults to true).
if [ "${SEED_ON_BOOT:-true}" = "false" ]; then
  echo "⏭️  SEED_ON_BOOT=false — skipping boot-seed (migrations/seed handled externally)."
else
  echo "🌱 Seeding database (tier=${SEED_TIER:-minimal})..."
  node dist/seed.js --tier="${SEED_TIER:-minimal}"
  echo "✅ Seed complete."
fi

echo "🎉 Starting Next.js application..."
exec node server.js
