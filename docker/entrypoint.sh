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