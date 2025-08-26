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
- **app**: Next.js application (port 3099)
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
- **Port 3099 in use**: Kill process with `wmic process where processid=<PID> delete`
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

## Application Logging System

The application now includes a comprehensive logging system built with Winston that provides structured logging, performance monitoring, error tracking, and business logic logging.

### Logging Architecture

#### Core Logger (`src/lib/logger.ts`)
- **Winston-based structured logging** with multiple transports
- **Environment-specific log levels** (debug in development, info in production)
- **File-based logging** with rotation and size limits
- **Console logging** for development with colorized output
- **Exception and rejection handling** with dedicated log files

#### Specialized Loggers (`src/lib/middleware/logging.ts`)
- **AppLogger**: Core logging methods with service context
- **DatabaseLogger**: Database query and error logging
- **AuthLogger**: Authentication events and security monitoring
- **BusinessLogger**: Business logic events (posts, campaigns, workspaces)
- **PerformanceLogger**: Performance monitoring with thresholds
- **ErrorLogger**: Categorized error tracking (validation, database, external services)
- **SecurityLogger**: Security events and suspicious activity tracking

#### Request/Response Middleware
- **Automatic API logging** with request/response details
- **Performance monitoring** with slow request detection (>1000ms)
- **User context tracking** with session information
- **Error handling** with structured error responses

### Log Categories

#### API Events
- Request/response logging with method, URL, status, duration
- User context (userId, IP, user-agent)
- Route-specific naming for better categorization
- Automatic error response generation

#### Business Events
- Post creation, updates, and deletion
- Media upload tracking
- Campaign and workspace actions
- Bulk operations monitoring

#### Performance Monitoring
- API response times with configurable thresholds
- Database query performance
- External service call monitoring
- Performance warnings for slow operations

#### Security Events
- Authentication success/failure
- Unauthorized access attempts
- Rate limiting violations
- Suspicious activity detection

### Log Storage
- **Error logs**: `logs/error.log` (errors only, 5MB rotation, 5 files)
- **Combined logs**: `logs/combined.log` (all events, 5MB rotation, 5 files)  
- **HTTP logs**: `logs/http.log` (API requests, 5MB rotation, 5 files)
- **Exception logs**: `logs/exceptions.log` (uncaught exceptions)
- **Rejection logs**: `logs/rejections.log` (unhandled promises)

### Usage Examples

```typescript
// API route with logging middleware
export const GET = withLogging(getHandler, 'posts-list')

// Business logic logging
BusinessLogger.logPostCreated(postId, userId, platforms)

// Error categorization
ErrorLogger.logValidationError(zodError, { operation: 'create_post' })

// Performance monitoring
const timer = PerformanceLogger.startTimer('post_creation')
// ... operation ...
timer.end({ postId, status })
```

## Recent Implementation Status

✅ **Completed Features**:
- Docker Compose development environment (now running on port 3099)
- PostgreSQL database with full schema
- NextAuth.js authentication system with hydration fixes
- User registration and login flows
- Multi-tenant workspace architecture
- Basic UI components and layouts
- Database migrations and seeding
- **Material Design 3.0 implementation with theme switcher**
- **Enhanced UI components (dialog, progress, switch)**
- **Professional Ocean, Creative Sunrise, Modern Forest themes**
- **Interactive theme switching in header navigation**
- **Professional marketing landing page with modern design**
- **Eye-catching hero section with compelling CTAs**
- **Feature showcase with benefits and animations**
- **Customer testimonials with social proof**
- **Pricing section with discount offers and value props**
- **Trust indicators and security certifications**
- **Mobile-responsive design with gradients and animations**
- **Conversion-optimized marketing copy and CTAs**
- **Enhanced mobile navigation with responsive drawer**
- **Mobile-optimized landing page with collapsible menu**
- **Page transition animations with smooth entry/exit effects**
- **Material Design loading spinners and loading states**
- **Interactive hover effects and micro-interactions**
- **Touch-friendly interactions for mobile devices**
- **Enhanced accessibility with focus states**
- **Responsive typography scaling**
- **Comprehensive application logging system with Winston**
- **Structured logging middleware for all API routes**
- **Performance monitoring and error categorization**
- **Business logic event tracking**
- **Security event logging and monitoring**
- **Media upload system with file validation and storage**
- **Post creation with media attachment support**
- **Workspace permissions system for posting and uploads**
- **Asset management with placeholder system for blob URLs**
- **Advanced Content Calendar with drag-and-drop scheduling**
- **Bulk post scheduling with CSV import and sequential timing**
- **Calendar export/import (CSV, iCal, JSON formats)**
- **Recurring post templates with flexible scheduling patterns**

🔄 **In Progress**:
- Social media platform integrations
- Analytics dashboard
- Team collaboration features

## Development Roadmap & TODO List

### 🎨 **UI/UX Enhancements** (Priority: High)

#### Material Design Enhancement ✅
- [x] Apply Material Design principles to dashboard components
- [x] Update existing cards and layouts with Material elevation
- [x] Implement Material Design typography consistently across app
- [x] Add Material Design animations and micro-interactions
- [x] Create Material Design form components
- [x] Enhance button styles with Material Design states

#### Landing & Marketing Pages ✅
- [x] Design and build hero section with theme-aware styling
- [x] Create features showcase section
- [x] Build pricing page with Material Design cards
- [x] Add testimonials and social proof sections
- [x] Implement call-to-action components
- [x] Create about/team page

#### Mobile Responsiveness ✅
- [x] Audit current mobile experience across all pages
- [x] Implement mobile-first navigation drawer
- [x] Optimize theme switcher for mobile devices
- [x] Ensure touch-friendly interactions
- [ ] Test and fix responsive layouts on tablets
- [ ] Add mobile-specific Material Design patterns

#### Animations & Interactions ✅
- [x] Implement page transition animations
- [x] Add loading states with Material Design spinners
- [x] Create hover effects for interactive elements
- [x] Implement smooth theme transition animations
- [x] Add feedback animations for user actions
- [x] Create Material Design ripple effects

### ⚡ **Core Features** (Priority: High)

#### Social Media Posting Interface
- [x] Create multi-platform post composer
- [x] Build media upload and preview system
- [x] Implement platform-specific post formatting
- [x] Add post scheduling interface
- [x] Create draft management system
- [ ] Build post preview for different platforms
- [ ] Add emoji picker and hashtag suggestions

#### Content Calendar ✅
- [x] Design calendar grid layout with Material Design
- [x] Implement calendar views (month, week, day)
- [x] Create post status indicators
- [x] Add post scheduling interface
- [x] Build calendar event display components
- [x] Implement drag-and-drop post scheduling
- [x] Build bulk scheduling functionality
- [x] Add calendar export/import features (CSV, iCal, JSON)
- [x] Implement recurring post templates

#### Analytics Dashboard
- [ ] Design analytics overview cards
- [ ] Implement chart components with theme support
- [ ] Build engagement metrics display
- [ ] Create performance comparison views
- [ ] Add exportable reports
- [ ] Implement real-time analytics updates
- [ ] Build custom dashboard widgets

#### Team Collaboration
- [ ] Create team member invitation system
- [ ] Build role-based permission interface
- [ ] Implement approval workflow UI
- [ ] Add team activity feed
- [ ] Create collaborative post editing
- [ ] Build team performance metrics
- [ ] Add commenting system on posts

### 🔧 **Technical Improvements** (Priority: Medium)

#### Social Media API Integration
- [ ] Implement Twitter/X API integration
- [ ] Build Facebook API connector
- [ ] Add Instagram Business API support
- [ ] Create LinkedIn API integration
- [ ] Build TikTok API connector
- [ ] Add YouTube API support
- [ ] Implement unified API abstraction layer

#### Background Job Processing
- [ ] Set up BullMQ job queues
- [ ] Create post scheduling jobs
- [ ] Implement analytics collection jobs
- [ ] Build notification dispatch system
- [ ] Add job monitoring dashboard
- [ ] Create job retry mechanisms
- [ ] Implement job failure handling

#### Real-time Notifications
- [ ] Set up WebSocket connection
- [ ] Build notification system architecture
- [ ] Create in-app notification UI
- [ ] Implement email notification templates
- [ ] Add push notification support
- [ ] Build notification preferences UI
- [ ] Create notification history

#### API Documentation
- [ ] Set up API documentation framework
- [ ] Document authentication endpoints
- [ ] Create REST API documentation
- [ ] Build interactive API explorer
- [ ] Add code examples for integrations
- [ ] Create webhook documentation
- [ ] Implement API versioning

### 📱 **New Functionality** (Priority: Medium)

#### Unified Social Media Inbox
- [ ] Design inbox interface with Material Design
- [ ] Build message aggregation system
- [ ] Create conversation threading
- [ ] Implement message filtering and search
- [ ] Add quick reply functionality
- [ ] Build automated response system
- [ ] Create sentiment analysis display

#### Campaign Management
- [ ] Design campaign creation workflow
- [ ] Build campaign dashboard
- [ ] Implement campaign performance tracking
- [ ] Create A/B testing functionality
- [ ] Add campaign budget management
- [ ] Build campaign reporting
- [ ] Implement campaign templates

#### Client Management System
- [ ] Create client onboarding flow
- [ ] Build client dashboard views
- [ ] Implement client-specific branding
- [ ] Add client reporting system
- [ ] Create client communication tools
- [ ] Build client billing integration
- [ ] Implement client permission system

#### User Onboarding Flow
- [ ] Design welcome sequence with Material Design
- [ ] Create account setup wizard
- [ ] Build social account connection flow
- [ ] Implement guided tour system
- [ ] Add progress indicators
- [ ] Create help and tutorial system
- [ ] Build onboarding analytics

### 🛠️ **Infrastructure** (Priority: Low)

#### Automated Testing
- [ ] Set up Jest testing framework
- [ ] Create component testing suite
- [ ] Build API endpoint tests
- [ ] Implement e2e testing with Playwright
- [ ] Add visual regression testing
- [ ] Create performance testing suite
- [ ] Set up continuous integration

#### Docker & Deployment
- [ ] Optimize Docker build process
- [ ] Create production Docker configuration
- [ ] Set up container orchestration
- [ ] Implement health checks
- [ ] Add container monitoring
- [ ] Create backup strategies
- [ ] Build deployment automation

#### Monitoring & Logging
- [x] **Implement application logging with Winston**
- [x] **Set up structured logging architecture**
- [x] **Create specialized logging middleware**  
- [x] **Add request/response logging**
- [x] **Implement error tracking and categorization**
- [x] **Create performance monitoring**
- [x] **Add business logic logging**
- [x] **Implement security event logging**
- [ ] Build user analytics
- [ ] Implement alerting system
- [ ] Create monitoring dashboards

#### Performance Optimization
- [ ] Audit bundle size and optimize
- [ ] Implement code splitting
- [ ] Add image optimization
- [ ] Create caching strategies
- [ ] Optimize database queries
- [ ] Implement CDN integration
- [ ] Add performance monitoring

---

### 📋 **Next Steps Priority Matrix**

**🔥 Immediate (Next 1-2 weeks)**
1. ✅ Apply Material Design to existing dashboard components
2. ✅ Enhanced mobile responsiveness and animations
3. Build social media posting interface
4. Create content calendar basic functionality

**⚡ Short-term (Next month)**
1. Implement analytics dashboard
2. Build team collaboration features
3. Add social media API integrations

**🎯 Medium-term (Next quarter)**
1. Create unified inbox
2. Build campaign management
3. Implement advanced analytics

**🚀 Long-term (Future quarters)**
1. Mobile app development
2. Advanced AI features
3. Enterprise features

---

This documentation should be updated as new features are implemented and architectural decisions are made.