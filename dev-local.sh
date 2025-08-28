#!/bin/bash

echo "🚀 SociallyHub Local Development Setup"
echo "======================================"
echo ""

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
echo "🐳 Starting Docker services (database & Redis only)..."
# Stop any running containers first
docker-compose down 2>/dev/null || true

# Start only database services
if ! docker-compose up -d postgres redis; then
    echo "❌ Failed to start Docker services"
    exit 1
fi

echo "⏳ Waiting for database to be ready..."
echo "   This may take a few seconds..."

# More robust database readiness check
attempt=0
max_attempts=30
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U sociallyhub -d sociallyhub >/dev/null 2>&1; then
        echo "✅ Database is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Database failed to start after $max_attempts attempts"
    echo "🔍 Check database logs with: docker-compose logs postgres"
    exit 1
fi

# Check if we need to run migrations
echo "🔄 Checking database schema..."
if ! npm run prisma:generate >/dev/null 2>&1; then
    echo "⚠️  Prisma generate failed, trying to fix..."
    npm install
    npm run prisma:generate
fi

# Optionally run migrations
read -p "🤔 Run database migrations? [y/N]: " run_migrations
if [[ $run_migrations =~ ^[Yy]$ ]]; then
    echo "🔄 Running database migrations..."
    npm run prisma:migrate || echo "⚠️  Migrations failed, but continuing..."
fi

echo ""
echo "🌟 Starting Next.js development server..."
echo "📍 App will be available at: http://localhost:3099"
echo "📊 Prisma Studio available at: http://localhost:5555"
echo "🗄️  Database: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "💡 Tips:"
echo "   - Use Ctrl+C to stop the development server"
echo "   - Use 'docker-compose down' to stop Docker services"
echo "   - Use 'docker-compose logs <service>' to view logs"
echo ""

# Start the development server
npm run dev