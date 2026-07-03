#!/bin/sh
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

# Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case of schema changes)
echo "🔄 Generating Prisma client..."
npx prisma generate

# Seed database if SEED_DATABASE is set
if [ "$SEED_DATABASE" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed || echo "⚠️ Database seeding failed or not configured"
fi

echo "🎉 Starting Next.js application..."
exec node server.js