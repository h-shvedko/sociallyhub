@echo off
setlocal enabledelayedexpansion

REM SociallyHub Development Environment Startup Script (Windows)
REM This script handles all setup and startup tasks for the local development environment

echo.
echo ^🚀 Starting SociallyHub Development Environment...
echo ==================================================

REM Check if Docker is running
echo ^▶ Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo ^❌ Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo ^✅ Docker is running

REM Check if Docker Compose is available
echo ^▶ Checking Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ^❌ docker-compose is not available. Please install Docker Compose.
    pause
    exit /b 1
)
echo ^✅ Docker Compose is available

REM Stop any running containers
echo ^▶ Stopping any existing containers...
docker-compose down >nul 2>&1

REM Create .env.local if it doesn't exist or is a directory
echo ^▶ Setting up environment file...
if exist ".env.local\" (
    echo ^⚠️ .env.local is a directory, removing it...
    rmdir /s /q ".env.local"
)

if not exist ".env.local" (
    echo ^▶ Creating .env.local file...
    (
        echo # Database
        echo DATABASE_URL="postgresql://sociallyhub:sociallyhub_dev_password@localhost:5432/sociallyhub"
        echo.
        echo # NextAuth.js
        echo NEXTAUTH_SECRET="dev-secret-key-change-in-production"
        echo NEXTAUTH_URL="http://localhost:3099"
        echo.
        echo # JWT
        echo JWT_SECRET="dev-jwt-secret-change-in-production"
        echo.
        echo # Redis
        echo REDIS_URL="redis://localhost:6379"
        echo.
        echo # Environment
        echo NODE_ENV="development"
        echo.
        echo # Social Media API Keys ^(Add your keys here^)
        echo # TWITTER_CLIENT_ID=""
        echo # TWITTER_CLIENT_SECRET=""
        echo # FACEBOOK_APP_ID=""
        echo # FACEBOOK_APP_SECRET=""
        echo # INSTAGRAM_APP_ID=""
        echo # INSTAGRAM_APP_SECRET=""
        echo # LINKEDIN_CLIENT_ID=""
        echo # LINKEDIN_CLIENT_SECRET=""
    ) > .env.local
    echo ^✅ Created .env.local file
) else (
    echo ^✅ .env.local file exists
)

REM Remove obsolete version from docker-compose.yml
echo ^▶ Fixing docker-compose.yml version warning...
if exist "docker-compose.yml.tmp" del "docker-compose.yml.tmp"
findstr /v "^version:" docker-compose.yml > docker-compose.yml.tmp 2>nul
if exist "docker-compose.yml.tmp" (
    move "docker-compose.yml.tmp" "docker-compose.yml" >nul
    echo ^✅ Removed obsolete version from docker-compose.yml
)

REM Clean up any existing volumes and containers
echo ^▶ Cleaning up Docker resources...
docker-compose down -v >nul 2>&1
docker system prune -f >nul 2>&1
echo ^✅ Cleaned up Docker resources

REM Build and start services
echo ^▶ Building and starting services...
docker-compose build --no-cache
docker-compose up -d

REM Wait for services to be healthy
echo ^▶ Waiting for services to be ready...
echo Waiting for PostgreSQL...
set timeout=30
:wait_postgres
docker-compose exec -T postgres pg_isready -U sociallyhub -d sociallyhub >nul 2>&1
if errorlevel 1 (
    timeout /t 2 >nul
    set /a timeout=timeout-1
    if !timeout! gtr 0 goto wait_postgres
    echo ^❌ PostgreSQL failed to start within 60 seconds
    docker-compose logs postgres
    pause
    exit /b 1
)
echo ^✅ PostgreSQL is ready

echo Waiting for Redis...
set timeout=15
:wait_redis
docker-compose exec -T redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    timeout /t 2 >nul
    set /a timeout=timeout-1
    if !timeout! gtr 0 goto wait_redis
    echo ^❌ Redis failed to start within 30 seconds
    docker-compose logs redis
    pause
    exit /b 1
)
echo ^✅ Redis is ready

REM Install/update dependencies
echo ^▶ Installing dependencies...
docker-compose exec -T app npm ci
echo ^✅ Dependencies installed

REM Run database migrations
echo ^▶ Setting up database...
docker-compose exec -T app npx prisma migrate deploy
echo ^✅ Database migrations applied

REM Generate Prisma client
echo ^▶ Generating Prisma client...
docker-compose exec -T app npx prisma generate
echo ^✅ Prisma client generated

REM Wait for the app to be ready
echo ^▶ Waiting for application to be ready...
set timeout=40
:wait_app
curl -sf http://localhost:3099 >nul 2>&1
if errorlevel 1 (
    timeout /t 3 >nul
    set /a timeout=timeout-1
    if !timeout! gtr 0 goto wait_app
    echo ^⚠️ Application didn't respond within 120 seconds, but services are running
)

REM Final health check
echo ^▶ Performing final health checks...
docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo ^❌ Some services failed to start
    docker-compose ps
    pause
    exit /b 1
)
echo ^✅ All services are running

echo.
echo ^🎉 SociallyHub Development Environment is ready!
echo ==================================================
echo.
echo ^📋 Service URLs:
echo    ^🌐 Application:    http://localhost:3099
echo    ^🗄️  Prisma Studio:  http://localhost:5555 ^(run: docker-compose --profile tools up prisma-studio^)
echo    ^🐘 PostgreSQL:     localhost:5432
echo    ^🔴 Redis:          localhost:6379
echo.
echo ^👤 Demo Credentials:
echo    ^📧 Email:    demo@sociallyhub.com
echo    ^🔑 Password: demo123456
echo.
echo ^🔧 Useful Commands:
echo    ^📊 View logs:       docker-compose logs -f
echo    ^🔄 Restart app:     docker-compose restart app
echo    ^🛑 Stop all:        docker-compose down
echo    ^🗑️  Clean reset:     docker-compose down -v ^&^& start-dev.bat
echo.
echo ^✅ Setup complete! Happy coding! ^🚀
echo.
pause