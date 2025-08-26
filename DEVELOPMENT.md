# SociallyHub Development Setup

## 🚀 One-Command Startup

To start your complete development environment, simply run ONE of these commands:

### Windows (Recommended)
```bash
start-dev.bat
```

### Linux/macOS/Git Bash
```bash
./start-dev.sh
```

## What the Script Does

The startup script automatically handles ALL of these issues:

✅ **Docker Status Check** - Ensures Docker is running  
✅ **Environment Setup** - Creates proper `.env.local` file  
✅ **Dependencies** - Installs all npm packages  
✅ **Database Setup** - Runs migrations and generates Prisma client  
✅ **Service Health Checks** - Waits for all services to be ready  
✅ **Error Resolution** - Fixes common Docker Compose warnings  
✅ **Clean Startup** - Removes old containers and volumes  

## After Running the Script

Your environment will be available at:

- **Application**: http://localhost:3099
- **Database**: PostgreSQL on port 5432
- **Redis**: Redis on port 6379
- **Prisma Studio**: Run `docker-compose --profile tools up prisma-studio` then visit http://localhost:5555

## Demo Login

- **Email**: demo@sociallyhub.com
- **Password**: demo123456

## Common Commands

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f postgres

# Restart a service
docker-compose restart app

# Stop all services
docker-compose down

# Clean reset (when things go wrong)
docker-compose down -v && start-dev.bat
```

## Troubleshooting

If you encounter any issues:

1. **Run the startup script again** - It's designed to be idempotent
2. **Clean reset**: `docker-compose down -v && start-dev.bat`
3. **Check Docker Desktop is running**
4. **Ensure ports 3099, 5432, 6379 are not in use**

## No More Manual Steps!

This script eliminates the need for:
- ❌ Manual `docker-compose up`
- ❌ Manual `npm install`
- ❌ Manual Prisma migrations
- ❌ Manual environment file creation
- ❌ Debugging Docker issues
- ❌ Waiting and wondering if services are ready

Just run the script and start coding! 🎉