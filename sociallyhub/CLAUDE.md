# SociallyHub - Social Media Management Platform

## Project Overview

SociallyHub is a comprehensive social media management platform built with Next.js 14 that allows users to manage multiple social media accounts from a single interface. The platform supports multi-tenant workspaces with role-based access control and provides features for content scheduling, team collaboration, analytics, and client management.

## Tech Stack

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui component library
- **Backend**: Next.js API routes, NextAuth.js for authentication
- **Database**: PostgreSQL with Prisma ORM
- **Caching & Jobs**: Redis, BullMQ for background jobs
- **Development**: Docker Compose environment
- **Deployment**: Containerized with Docker

## Project Structure

```
sociallyhub/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── posts/         # Post management
│   │   │   ├── analytics/     # Analytics endpoints
│   │   │   └── workspaces/    # Workspace management
│   │   ├── auth/              # Auth pages (signin, signup)
│   │   ├── dashboard/         # Main dashboard
│   │   └── layout.tsx         # Root layout
│   ├── components/            # Reusable UI components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── forms/            # Form components
│   │   ├── layout/           # Layout components
│   │   └── ui/               # shadcn/ui components
│   ├── lib/                   # Utility libraries
│   │   ├── auth/             # Authentication configuration
│   │   ├── prisma.ts         # Prisma client setup
│   │   └── utils.ts          # Utility functions
│   ├── services/             # Business logic services
│   │   ├── jobs/             # Background job handlers
│   │   └── social-providers/ # Social media API integrations
│   ├── store/                # State management
│   └── types/                # TypeScript type definitions
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── docker-compose.yml        # Docker development environment
├── Dockerfile.dev           # Development Docker image
└── .env.local              # Environment variables
```

## Database Schema

The application uses a multi-tenant architecture with the following key models:

### Core Models
- **User**: User accounts with authentication
- **Workspace**: Multi-tenant workspaces
- **UserWorkspace**: User-workspace relationships with RBAC

### Social Media Management
- **SocialAccount**: Connected social media accounts
- **Post**: Content posts with scheduling
- **PostVariant**: Platform-specific post variations
- **Campaign**: Marketing campaigns

### Communication
- **InboxItem**: Unified social media inbox
- **Conversation**: Message threads

### Analytics & Monitoring
- **AnalyticsMetric**: Performance metrics
- **AuditEvent**: Activity logging

## Key Features

### 1. Multi-Platform Support
- Twitter/X, Facebook, Instagram, LinkedIn, YouTube, TikTok
- Unified posting interface with platform-specific optimizations
- Cross-platform analytics and reporting

### 2. Team Collaboration
- Role-based permissions (OWNER, ADMIN, MANAGER, EDITOR, VIEWER)
- Approval workflows for content
- Team activity tracking

### 3. Content Management
- Visual content calendar
- Bulk scheduling capabilities
- Content templates and reusable assets
- Media library with asset management

### 4. Analytics & Insights
- Cross-platform performance metrics
- Engagement tracking and analysis
- Custom reporting dashboards
- ROI measurement tools

### 5. Client Management
- Multi-client workspace support
- Client-specific branding and settings
- Reporting and communication tools

## Development Environment

### Docker Setup
The project runs in a containerized environment with:

```bash
# Start development environment
docker-compose up -d

# Run database migrations
docker-compose exec app npx prisma migrate dev

# View logs
docker-compose logs app

# Access Prisma Studio
docker-compose exec app npx prisma studio
```

### Services
- **app**: Next.js application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache/job queue (port 6379)
- **prisma-studio**: Database admin UI (port 5555)

### Environment Variables
Key environment variables in `.env.local`:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: NextAuth.js secret key
- `REDIS_URL`: Redis connection string
- Social media API credentials (Twitter, Facebook, etc.)

## Authentication System

The app uses NextAuth.js with multiple authentication providers:

### Providers
- **Credentials**: Email/password authentication
- **Google OAuth**: Optional OAuth integration
- **Demo Account**: `demo@sociallyhub.com` / `demo123456`

### Session Management
- JWT-based sessions with workspace context
- Automatic workspace selection for users
- Role-based access control integration

### Security Features
- Password hashing with bcrypt (12 rounds)
- Email verification workflow
- Session management and security

## API Structure

### Authentication Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/auth/session` - Current session

### Core API Routes
- `/api/posts` - Content management
- `/api/analytics` - Analytics data
- `/api/workspaces` - Workspace management
- `/api/accounts` - Social account management
- `/api/inbox` - Unified inbox

## Development Commands

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Database operations
npx prisma migrate dev --name <migration_name>
npx prisma generate
npx prisma studio

# Type checking
npm run type-check

# Linting
npm run lint

# Docker operations
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs <service> # View logs
```

## Testing Strategy

### Demo Mode
- Fallback authentication for development
- Demo data seeding
- Offline development capabilities

### Database Testing
- Transaction-based operations
- Comprehensive error handling
- Migration testing workflow

## Performance Optimizations

### Database
- Optimized indexes on frequently queried fields
- Connection pooling with Prisma
- Transaction-based operations for data consistency

### Caching
- Redis caching for frequent queries
- Session caching
- API response caching strategies

### Background Jobs
- BullMQ job queue for async operations
- Social media API rate limiting
- Scheduled content posting

## Deployment Considerations

### Production Environment
- Environment-specific configuration
- Database migration strategies
- Monitoring and logging setup
- Security hardening checklist

### Scaling
- Horizontal scaling with load balancers
- Database read replicas
- CDN for static assets
- Microservices architecture considerations

## Common Development Tasks

### Adding New Social Platform
1. Create provider in `src/services/social-providers/`
2. Update database schema for platform-specific fields
3. Implement OAuth flow and API integration
4. Add platform-specific UI components
5. Update analytics collection

### Adding New Feature
1. Design database schema changes
2. Create Prisma migration
3. Implement API endpoints
4. Build UI components
5. Add proper error handling and validation

### Debugging Authentication Issues
1. Check database connectivity: `docker-compose logs postgres`
2. Verify environment variables are loaded
3. Test with demo credentials first
4. Check NextAuth.js logs for detailed errors

## Troubleshooting

### Common Issues
- **Port 3000 in use**: Kill process with `wmic process where processid=<PID> delete`
- **Database connection**: Ensure PostgreSQL container is healthy
- **Authentication slow**: Verify database is connected, not falling back to demo mode
- **Migration errors**: Check schema conflicts and run `prisma db push` if needed

### Useful Commands
```bash
# Check container status
docker-compose ps

# Reset database
docker-compose down -v
docker-compose up -d
docker-compose exec app npx prisma migrate dev

# Access database directly
docker-compose exec postgres psql -U sociallyhub -d sociallyhub
```

## Recent Implementation Status

✅ **Completed Features**:
- Docker Compose development environment
- PostgreSQL database with full schema
- NextAuth.js authentication system
- User registration and login flows
- Multi-tenant workspace architecture
- Basic UI components and layouts
- Database migrations and seeding

🔄 **In Progress**:
- Social media platform integrations
- Content scheduling system
- Analytics dashboard
- Team collaboration features

📋 **Upcoming**:
- Advanced analytics and reporting
- Mobile-responsive design improvements
- API rate limiting and optimization
- Production deployment configuration

This documentation should be updated as new features are implemented and architectural decisions are made.