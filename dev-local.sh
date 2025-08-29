#!/bin/bash

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
PORTS_TO_CHECK=(3000 3099 5432 6379)
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

echo "🐳 Starting Docker services (database & Redis)..."
# Stop any running containers first
docker-compose down 2>/dev/null || true

# Start only database services (not the app container)
# The app will run locally via npm for better development experience
if ! docker-compose up -d postgres redis; then
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

# Check if database has been initialized
echo "🔍 Checking database status..."
DB_INITIALIZED=$(docker-compose exec -T postgres psql -U sociallyhub -d sociallyhub -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "$DB_INITIALIZED" = "0" ] || [ -z "$DB_INITIALIZED" ]; then
    echo "🆕 Database is empty. Running initial setup..."
    
    # Run migrations
    echo "🔄 Running database migrations..."
    if npm run prisma:migrate; then
        echo "✅ Migrations completed successfully"
        
        # Run seeding
        echo "🌱 Seeding database with demo data..."
        if npm run db:seed; then
            echo "✅ Database seeded successfully"
            echo ""
            echo "📧 Demo credentials created:"
            echo "   Email: demo@sociallyhub.com"
            echo "   Password: demo123456"
        else
            echo "⚠️  Seeding failed, but you can still use the app"
            echo "   Run 'npm run db:seed' manually to add demo data"
        fi
    else
        echo "❌ Migration failed. Please check your database configuration"
        exit 1
    fi
else
    echo "✅ Database already initialized ($DB_INITIALIZED tables found)"
    
    # Ask if user wants to run migrations
    read -p "🤔 Run any pending migrations? [y/N]: " run_migrations
    if [[ $run_migrations =~ ^[Yy]$ ]]; then
        echo "🔄 Running database migrations..."
        if npm run prisma:migrate; then
            echo "✅ Migrations completed"
            
            # Ask about seeding only if migrations succeeded
            read -p "🌱 Run database seeding? (This will add/update demo data) [y/N]: " run_seeding
            if [[ $run_seeding =~ ^[Yy]$ ]]; then
                echo "🌱 Seeding database..."
                if npm run db:seed; then
                    echo "✅ Database seeded successfully"
                else
                    echo "⚠️  Seeding failed, continuing anyway..."
                fi
            fi
        else
            echo "⚠️  Migrations failed, but continuing..."
        fi
    fi
fi

echo ""
echo "🌟 Starting Next.js development server..."
echo ""
echo "📍 Service URLs:"
echo "   🌐 Application: http://localhost:3099"
echo "   📊 Prisma Studio: http://localhost:5555 (run 'npm run prisma:studio' in another terminal)"
echo "   🗄️  PostgreSQL: localhost:5432"
echo "   🔴 Redis: localhost:6379"
echo ""
echo "🔑 Demo Account:"
echo "   📧 Email: demo@sociallyhub.com"
echo "   🔒 Password: demo123456"
echo ""
echo "💡 Useful Commands:"
echo "   📊 Open Prisma Studio: npm run prisma:studio"
echo "   🌱 Re-run seeding: npm run db:seed"
echo "   🔄 Run migrations: npm run prisma:migrate"
echo "   📝 View Docker logs: docker-compose logs -f [postgres|redis]"
echo "   🛑 Stop Docker services: docker-compose down"
echo "   🐳 Run full stack in Docker: docker-compose up -d (includes app container)"
echo ""
echo "⌨️  Press Ctrl+C to stop the development server"
echo "────────────────────────────────────────────────"
echo ""

# Start the development server
npm run dev