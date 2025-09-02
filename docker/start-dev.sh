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

# Start the development server
echo "🌐 Starting Next.js development server..."
exec npx next dev -p 3000