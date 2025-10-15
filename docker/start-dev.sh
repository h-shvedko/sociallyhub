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

# Check if database is ready
echo "⏳ Waiting for database to be ready..."
for i in $(seq 1 30); do
    if npx prisma db push --skip-generate >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database connection failed after 30 attempts"
        exit 1
    fi
    sleep 2
done

# Check if tables exist, if not run migrations
echo "🔍 Checking database schema..."
TABLE_COUNT=$(npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || echo "0")

if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
    echo "📊 Database is empty - running migrations..."
    npx prisma db push --skip-generate

    echo "🌱 Seeding database with demo data..."
    npm run db:seed || {
        echo "⚠️  Seeding failed, but continuing anyway..."
        echo "   You can run 'npm run db:seed' manually later"
    }
else
    echo "✅ Database schema exists (found $TABLE_COUNT tables)"

    # Still push schema to ensure it's up to date
    echo "🔄 Synchronizing database schema..."
    npx prisma db push --skip-generate || {
        echo "⚠️  Schema sync failed, continuing anyway..."
    }
fi

# Start the development server
echo "🌐 Starting Next.js development server..."
exec npx next dev -p 3000