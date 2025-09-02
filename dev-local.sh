#!/bin/bash

# SociallyHub Development Environment Setup Script
# 
# Usage:
#   ./dev-local.sh                 # Normal startup (detects changes automatically)
#   ./dev-local.sh --force-update  # Force database schema update and restart
#   ./dev-local.sh -f              # Short version of force update
#
# For complete reset: docker-compose down -v && ./dev-local.sh

# Parse command line arguments
FORCE_UPDATE=false
if [ "$1" = "--force-update" ] || [ "$1" = "-f" ]; then
    FORCE_UPDATE=true
    echo "🔄 Force update mode enabled - will update schema and restart services"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "🚀 SociallyHub Development Setup Script"
    echo ""
    echo "Usage:"
    echo "  ./dev-local.sh                 # Normal startup"
    echo "  ./dev-local.sh --force-update  # Force database update"
    echo "  ./dev-local.sh -f              # Short version"
    echo "  ./dev-local.sh --help          # Show this help"
    echo ""
    echo "For complete reset: docker-compose down -v && ./dev-local.sh"
    exit 0
fi

echo "🚀 SociallyHub Local Development Setup"
echo "======================================"
echo ""

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed!"
        echo "📦 Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon is not running!"
        echo "🔧 Please start Docker Desktop and try again."
        exit 1
    fi
    
    echo "✅ Docker is installed and running"
}

# Function to check if docker-compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        # Try docker compose (newer Docker Desktop versions)
        if docker compose version >/dev/null 2>&1; then
            echo "ℹ️  Using 'docker compose' (Docker Compose V2)"
            # Create an alias for consistency
            alias docker-compose='docker compose'
        else
            echo "❌ Docker Compose is not installed!"
            echo "📦 Please install Docker Compose or update Docker Desktop"
            exit 1
        fi
    else
        echo "✅ Docker Compose is installed"
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    echo "🔪 Killing processes on port $port..."
    if command -v lsof >/dev/null 2>&1; then
        # macOS/Linux
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    elif command -v netstat >/dev/null 2>&1; then
        # Windows with Git Bash
        for pid in $(netstat -ano | findstr :$port | awk '{print $5}' | sort -u); do
            if [ "$pid" != "" ] && [ "$pid" != "0" ]; then
                echo "  Killing PID: $pid"
                taskkill //PID $pid //F 2>/dev/null || true
            fi
        done
    fi
}

# Check Docker installation
echo "🐳 Checking Docker setup..."
check_docker
check_docker_compose

# Check for conflicting processes
echo "🔍 Checking for port conflicts..."
PORTS_TO_CHECK=(3000 3099 5432 6379 1025 8025)
CONFLICTS_FOUND=false

for port in "${PORTS_TO_CHECK[@]}"; do
    if check_port $port; then
        echo "⚠️  Port $port is in use"
        CONFLICTS_FOUND=true
    fi
done

if [ "$CONFLICTS_FOUND" = true ]; then
    echo ""
    echo "❓ Would you like to:"
    echo "1) Kill conflicting processes and continue"
    echo "2) Continue anyway (may cause issues)"
    echo "3) Exit and handle manually"
    echo ""
    read -p "Choose option [1-3]: " choice
    
    case $choice in
        1)
            echo "🛑 Stopping conflicting processes..."
            for port in "${PORTS_TO_CHECK[@]}"; do
                if check_port $port; then
                    kill_port $port
                fi
            done
            echo "✅ Processes stopped"
            ;;
        2)
            echo "⚠️  Continuing with potential conflicts..."
            ;;
        3)
            echo "👋 Exiting. Please stop conflicting processes manually."
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Exiting."
            exit 1
            ;;
    esac
fi

echo ""
echo "🐳 Setting up Docker environment..."

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found!"
    echo "📍 Please ensure you're running this script from the project root directory"
    exit 1
fi

# Check if this is a first-time setup by looking for existing containers
FIRST_TIME_SETUP=false
if ! docker-compose ps -q | grep -q .; then
    # No containers exist, this is first-time setup
    FIRST_TIME_SETUP=true
    echo "🆕 First-time setup detected - will run migrations and seeding"
else
    echo "🔄 Existing setup detected - skipping migrations and seeding"
fi

# Check if .env.local exists, if not create from example
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        echo "📝 Creating .env.local from .env.example..."
        cp .env.example .env.local
        echo "⚠️  Please update .env.local with your configuration"
    else
        echo "⚠️  No .env.local file found. Creating basic configuration..."
        cat > .env.local << 'EOF'
# Database
DATABASE_URL="postgresql://sociallyhub:sociallyhub_dev_password@localhost:5432/sociallyhub"

# NextAuth
NEXTAUTH_URL="http://localhost:3099"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"

# Redis
REDIS_URL="redis://localhost:6379"

# Development Mode
NODE_ENV="development"
ENABLE_DEMO="true"
EOF
        echo "✅ Created .env.local with default settings"
    fi
fi

echo "🐳 Starting full Docker stack..."
# Stop any running containers first
docker-compose down 2>/dev/null || true

# Start all Docker services (postgres, redis, and app)
if ! docker-compose up -d; then
    echo "❌ Failed to start Docker services"
    echo "💡 Tip: Check if Docker Desktop is running"
    exit 1
fi

echo "⏳ Waiting for database to be ready..."
echo "   This may take up to 30 seconds on first run..."

# More robust database readiness check
attempt=0
max_attempts=30
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U sociallyhub -d sociallyhub >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        break
    fi
    attempt=$((attempt + 1))
    if [ $((attempt % 5)) -eq 0 ]; then
        echo "   Still waiting... ($attempt/$max_attempts)"
    fi
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Database failed to start after $max_attempts attempts"
    echo "🔍 Debugging tips:"
    echo "   - Check logs: docker-compose logs postgres"
    echo "   - Verify Docker is running: docker ps"
    echo "   - Check disk space: df -h"
    exit 1
fi

# Database and application setup
if [ "$FIRST_TIME_SETUP" = true ]; then
    echo "🆕 First-time setup - running complete initialization..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm ci || npm install
    fi

    # Generate Prisma client
    echo "🔄 Generating Prisma client..."
    if ! npx prisma generate >/dev/null 2>&1; then
        echo "⚠️  Prisma generate failed, trying to fix..."
        npm install @prisma/client prisma
        npx prisma generate
    fi

    # Wait a bit longer for database to be fully ready on first setup
    echo "⏳ Waiting extra time for database initial setup..."
    sleep 5
    
    # Run migrations on first-time setup
    echo "🔄 Running database migrations..."
    if docker-compose exec -T app npm run prisma:migrate; then
        echo "✅ Migrations completed successfully"
        
        # Run seeding
        echo "🌱 Seeding database with demo data..."
        if docker-compose exec -T app npm run db:seed; then
            echo "✅ Database seeded successfully"
            echo ""
            echo "📧 Demo credentials created:"
            echo "   Email: demo@sociallyhub.com"
            echo "   Password: demo123456"
        else
            echo "⚠️  Seeding failed, but you can still use the app"
            echo "   Run 'docker-compose exec app npm run db:seed' manually to add demo data"
        fi
    else
        echo "❌ Migration failed. Please check your database configuration"
        exit 1
    fi
else
    echo "🔄 Existing setup detected - checking for updates..."
    
    # Force update mode or check if schema has changed
    NEEDS_UPDATE=false
    if [ "$FORCE_UPDATE" = true ]; then
        echo "🔄 Force update mode - applying all changes..."
        NEEDS_UPDATE=true
    else
        # Check if schema has changed (this handles code updates)
        echo "🔍 Checking for database schema changes..."
        # Run a dry-run to check if there are changes
        if ! docker-compose exec -T app npx prisma db push --help >/dev/null 2>&1; then
            echo "⚠️  Prisma command not available, forcing update..."
            NEEDS_UPDATE=true
        else
            # Check for schema drift
            if docker-compose exec -T app npx prisma db push --accept-data-loss >/dev/null 2>&1; then
                echo "✅ Database schema synchronized"
                NEEDS_UPDATE=true
            else
                echo "ℹ️  No database schema changes detected"
            fi
        fi
    fi
    
    if [ "$NEEDS_UPDATE" = true ]; then
        # Regenerate Prisma client for new models/changes
        echo "🔄 Updating Prisma client..."
        if docker-compose exec -T app npx prisma generate >/dev/null 2>&1; then
            echo "✅ Prisma client updated"
        else
            echo "⚠️  Prisma client update failed, trying to fix..."
            docker-compose exec -T app npm install @prisma/client prisma
            docker-compose exec -T app npx prisma generate
        fi
        
        # Restart app container to clear Node.js cache and load new code
        echo "🔄 Restarting app container for code changes..."
        docker-compose restart app
        
        # Wait for app to be ready after restart
        echo "⏳ Waiting for application to restart..."
        sleep 10
        
        # Verify app is responsive
        attempt=0
        max_attempts=15
        while [ $attempt -lt $max_attempts ]; do
            if docker-compose exec -T app curl -s http://localhost:3000/api/auth/session >/dev/null 2>&1; then
                echo "✅ Application is ready!"
                break
            fi
            attempt=$((attempt + 1))
            if [ $((attempt % 3)) -eq 0 ]; then
                echo "   Still starting... ($attempt/$max_attempts)"
            fi
            sleep 2
        done
        
        if [ $attempt -eq $max_attempts ]; then
            echo "⚠️  Application may still be starting. Check logs if issues occur."
        fi
    fi
    
    echo "💡 Commands:"
    echo "   🔄 Force update: ./dev-local.sh --force-update"
    echo "   🧹 Complete reset: docker-compose down -v && ./dev-local.sh"
fi

echo ""
echo "🎉 SociallyHub Development Environment Ready!"
echo ""
echo "📍 Service URLs:"
echo "   🌐 Application: http://localhost:3099"
echo "   📊 Prisma Studio: docker-compose exec app npm run prisma:studio"
echo "   📧 Mailhog (Email Testing): http://localhost:8025"
echo "   🗄️  PostgreSQL: localhost:5432"
echo "   🔴 Redis: localhost:6379"
echo ""
echo "🔑 Demo Account:"
echo "   📧 Email: demo@sociallyhub.com"
echo "   🔒 Password: demo123456"
echo ""
echo "💡 Useful Commands:"
echo "   📊 Open Prisma Studio: docker-compose exec app npm run prisma:studio"
echo "   📧 View caught emails: http://localhost:8025"
echo "   🌱 Re-run seeding: docker-compose exec app npm run db:seed"
echo "   🔄 Run migrations: docker-compose exec app npm run prisma:migrate"
echo "   📝 View app logs: docker-compose logs -f app"
echo "   📝 View database logs: docker-compose logs -f postgres"
echo "   📧 View mailhog logs: docker-compose logs -f mailhog"
echo "   🛑 Stop all services: docker-compose down"
echo "   🧹 Clean restart: docker-compose down -v && ./dev-local.sh"
echo ""
echo "🚀 All services are running in Docker containers!"
echo "📱 Open http://localhost:3099 to start using SociallyHub"
echo "📧 Test email registration at http://localhost:8025 (Mailhog catches all emails)"
echo ""
echo "🧪 Testing Checklist for Campaign Management Features:"
echo "────────────────────────────────────────────────────────"
echo "1. 📝 Sign in with demo credentials above"
echo "2. 🎯 Navigate to Dashboard → Campaigns"
echo "3. 🧪 Test A/B Test Creation:"
echo "   • Click 'A/B Testing' tab → 'Create A/B Test' button"
echo "   • Fill form and create test → Should appear in list"
echo "   • Refresh page (F5) → Test should still be there ✅"
echo ""
echo "4. 📊 Test Report Creation:"
echo "   • Click 'Reporting' tab → 'Create Report' button"
echo "   • Fill form and create report → Should appear in list"
echo "   • Refresh page (F5) → Report should still be there ✅"
echo ""
echo "5. 📋 Test Template Creation:"
echo "   • Click 'Templates' tab → 'Create Template' button"
echo "   • Fill form and create template → Should appear in list"
echo "   • Refresh page (F5) → Template should still be there ✅"
echo ""
echo "🎯 Expected Results:"
echo "   ✅ All creation buttons work (no longer disabled)"
echo "   ✅ Data persists after page refresh (saved to database)"
echo "   ✅ Items appear immediately after creation"
echo "   ✅ No errors in browser console or app logs"
echo ""
echo "🔍 Debugging Commands:"
echo "   🐛 View app errors: docker-compose logs app | tail -50"
echo "   🗄️  Check database: docker-compose exec app npm run prisma:studio"
echo "   🧹 Full reset if issues: docker-compose down -v && ./dev-local.sh"
echo "────────────────────────────────────────────────────────"