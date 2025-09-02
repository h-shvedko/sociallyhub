#!/bin/bash

# SociallyHub Development Environment Startup Script
# This script handles all setup and startup tasks for the local development environment

set -e  # Exit on any error

# Check for clean start flag
CLEAN_START=false
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
    CLEAN_START=true
    echo "🧹 Clean start requested - will remove all volumes and rebuild from scratch"
fi

echo "🚀 Starting SociallyHub Development Environment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
print_step "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
print_success "Docker is running"

# Check if Docker Compose is available
print_step "Checking Docker Compose..."
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not available. Please install Docker Compose."
    exit 1
fi
print_success "Docker Compose is available"

# Stop any running containers
print_step "Stopping any existing containers..."
docker-compose down > /dev/null 2>&1 || true
print_success "Stopped existing containers"

# Create .env.local if it doesn't exist or is a directory
print_step "Setting up environment file..."
if [ -d ".env.local" ]; then
    print_warning ".env.local is a directory, removing it..."
    rm -rf ".env.local"
fi

if [ ! -f ".env.local" ]; then
    print_step "Creating .env.local file..."
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://sociallyhub:sociallyhub_dev_password@localhost:5432/sociallyhub"

# NextAuth.js
NEXTAUTH_SECRET="dev-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3099"

# JWT
JWT_SECRET="dev-jwt-secret-change-in-production"

# Redis
REDIS_URL="redis://localhost:6379"

# Environment
NODE_ENV="development"

# Social Media API Keys (Add your keys here)
# TWITTER_CLIENT_ID=""
# TWITTER_CLIENT_SECRET=""
# FACEBOOK_APP_ID=""
# FACEBOOK_APP_SECRET=""
# INSTAGRAM_APP_ID=""
# INSTAGRAM_APP_SECRET=""
# LINKEDIN_CLIENT_ID=""
# LINKEDIN_CLIENT_SECRET=""

EOF
    print_success "Created .env.local file"
else
    print_success ".env.local file exists"
fi

# Remove obsolete version from docker-compose.yml
print_step "Fixing docker-compose.yml version warning..."
if grep -q "version:" docker-compose.yml; then
    sed -i '/^version:/d' docker-compose.yml 2>/dev/null || sed -i.bak '/^version:/d' docker-compose.yml
    print_success "Removed obsolete version from docker-compose.yml"
fi

# Clean up Docker resources based on mode
if [ "$CLEAN_START" = true ]; then
    print_step "Performing clean start - removing all volumes and containers..."
    docker-compose down -v > /dev/null 2>&1 || true
    docker system prune -f > /dev/null 2>&1 || true
    print_success "Cleaned up all Docker resources"
else
    print_step "Cleaning up Docker containers (preserving volumes)..."
    docker-compose down > /dev/null 2>&1 || true
    print_success "Cleaned up Docker containers"
fi

# Build and start services
print_step "Building and starting services..."
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
print_step "Waiting for services to be ready..."
echo "Waiting for PostgreSQL..."
timeout=60
while ! docker-compose exec -T postgres pg_isready -U sociallyhub -d sociallyhub > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        print_error "PostgreSQL failed to start within 60 seconds"
        docker-compose logs postgres
        exit 1
    fi
done
print_success "PostgreSQL is ready"

echo "Waiting for Redis..."
timeout=30
while ! docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        print_error "Redis failed to start within 30 seconds"
        docker-compose logs redis
        exit 1
    fi
done
print_success "Redis is ready"

# Ensure dependencies are properly installed
print_step "Ensuring dependencies are up to date..."
docker-compose exec -T app npm ci --only=production=false
print_success "Dependencies verified and updated"

# Run database migrations
print_step "Setting up database..."
docker-compose exec -T app npx prisma migrate deploy
print_success "Database migrations applied"

# Generate Prisma client
print_step "Generating Prisma client..."
docker-compose exec -T app npx prisma generate
print_success "Prisma client generated"

# Optional: Seed database with demo data
print_step "Checking for database seed..."
if docker-compose exec -T app test -f "prisma/seed.ts" || docker-compose exec -T app test -f "prisma/seed.js"; then
    print_step "Seeding database with demo data..."
    docker-compose exec -T app npx prisma db seed || print_warning "Seeding failed or no seed script found"
else
    print_warning "No seed script found, skipping database seeding"
fi

# Wait for the app to be ready
print_step "Waiting for application to be ready..."
timeout=120
while ! curl -sf http://localhost:3099 > /dev/null 2>&1; do
    sleep 3
    timeout=$((timeout - 3))
    if [ $timeout -le 0 ]; then
        print_warning "Application didn't respond within 120 seconds, but services are running"
        break
    fi
done

# Final health check
print_step "Performing final health checks..."
if docker-compose ps | grep -q "Up"; then
    print_success "All services are running"
else
    print_error "Some services failed to start"
    docker-compose ps
    exit 1
fi

echo ""
echo "🎉 SociallyHub Development Environment is ready!"
echo "=================================================="
echo ""
echo "📋 Service URLs:"
echo "   🌐 Application:    http://localhost:3099"
echo "   🗄️  Prisma Studio:  http://localhost:5555 (run: docker-compose --profile tools up prisma-studio)"
echo "   🐘 PostgreSQL:     localhost:5432"
echo "   🔴 Redis:          localhost:6379"
echo ""
echo "👤 Demo Credentials:"
echo "   📧 Email:    demo@sociallyhub.com"
echo "   🔑 Password: demo123456"
echo ""
echo "🔧 Useful Commands:"
echo "   📊 View logs:       docker-compose logs -f"
echo "   🔄 Restart app:     docker-compose restart app"
echo "   🛑 Stop all:        docker-compose down"
echo "   🗑️  Clean reset:     ./start-dev.sh --clean"
echo "   🔧 Normal restart:  ./start-dev.sh"
echo ""
print_success "Setup complete! Happy coding! 🚀"