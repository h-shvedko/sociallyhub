#!/bin/sh

# Development startup script for Docker container
set -e

echo "🚀 Starting SociallyHub development server..."

# Ensure dependencies are installed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/next" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Generate Prisma client if needed
if [ ! -d "node_modules/.prisma" ]; then
    echo "🔄 Generating Prisma client..."
    npx prisma generate
fi

# Check if database is ready (non-destructive connectivity check)
echo "⏳ Waiting for database to be ready..."
for i in $(seq 1 30); do
    if printf 'SELECT 1;' | npx prisma db execute --url "$DATABASE_URL" --stdin >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database connection failed after 30 attempts"
        exit 1
    fi
    sleep 2
done

# Check if application tables exist (ignoring _prisma_migrations) to decide on seeding
echo "🔍 Checking database schema..."
TABLE_COUNT=$(node <<'EOF'
(async () => {
  let prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
    const rows = await prisma.$queryRawUnsafe("SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'");
    console.log(rows[0].c);
  } catch (e) {
    // A query failure is NOT the same as "no tables" - report it and fail
    console.error("Table-count query failed: " + (e && e.message ? e.message : e));
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect().catch(() => {});
  }
})();
EOF
) || {
    echo "❌ Could not determine database schema state (table-count query failed)"
    echo "   Refusing to treat a database error as a fresh install."
    exit 1
}

# Migration-first workflow (ADR-0002): apply committed migrations with
# `prisma migrate deploy`. Never use `prisma db push` here — schema changes
# must be captured as migrations via `npx prisma migrate dev --name <change>`.
if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
    echo "📊 Database is empty - applying migrations..."
    npx prisma migrate deploy

    # ADR-0025: seed the DEMO tier for a populated local showcase. This container
    # already carries DEMO_MODE=true + SEED_TIER=demo via docker-compose.yml; the
    # inline prefix makes the tier selection explicit and self-documenting.
    echo "🌱 Seeding database with demo data (demo tier)..."
    SEED_TIER=demo DEMO_MODE=true npm run db:seed || {
        echo "⚠️  Seeding failed, but continuing anyway..."
        echo "   You can run 'SEED_TIER=demo DEMO_MODE=true npm run db:seed' manually later"
    }
else
    echo "✅ Database schema exists (found $TABLE_COUNT tables)"

    # Apply any pending migrations to keep the schema in sync
    echo "🔄 Applying pending migrations..."
    npx prisma migrate deploy || {
        echo "❌ 'prisma migrate deploy' failed"
        echo "   If this dev database has drifted (e.g. from old 'db push' runs),"
        echo "   reset it with: npx prisma migrate reset --force"
        exit 1
    }
fi

# Start the development server
echo "🌐 Starting Next.js development server..."
exec npx next dev -p 3000