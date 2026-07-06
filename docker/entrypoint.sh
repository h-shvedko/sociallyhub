#!/bin/sh
# ============================================================================
# Production entrypoint (ADR-0022): wait-for-deps + assert ENCRYPTION_KEY +
# exec node server.js. Nothing else.
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
#   - SEED_DATABASE / `npx prisma db seed` → removed. tsx (the seed runner) is
#     not in the production image; seeding policy is ADR-0025.
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

echo "🎉 Starting Next.js application..."
exec node server.js
