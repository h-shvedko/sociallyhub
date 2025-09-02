@echo off
echo Starting local development without Docker (Hot reload enabled)
echo =====================================================
echo.
echo This script runs the app locally for faster development
echo with instant hot reload. Docker services will still run
echo for database and Redis.
echo.

REM Start only database services in Docker
docker-compose up -d postgres redis

echo Waiting for database to be ready...
timeout /t 5 >nul

REM Run the app locally
echo.
echo Starting Next.js development server...
echo App will be available at: http://localhost:3099
echo.

npm run dev

pause