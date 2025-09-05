# SociallyHub Project Structure

## Overview
Production-ready social media management platform with complete database integration, real-time analytics, and professional reporting.

## Directory Structure

```
sociallyhub/
├── src/
│   ├── app/                        # Next.js 15 App Router
│   │   ├── api/                    # API Routes
│   │   │   ├── auth/               # Authentication endpoints
│   │   │   ├── campaigns/          # Campaign management
│   │   │   ├── clients/            # Client CRUD operations
│   │   │   ├── client-reports/     # Report generation & distribution
│   │   │   ├── invoices/           # Billing & invoicing
│   │   │   ├── analytics/          # Real-time metrics
│   │   │   ├── templates/          # Content templates
│   │   │   ├── media/              # Asset management
│   │   │   └── automation/         # Automation rules
│   │   └── dashboard/              # Dashboard pages
│   │       ├── campaigns/          # Campaign management UI
│   │       ├── clients/            # Client management UI
│   │       ├── analytics/          # Analytics dashboard
│   │       └── automation/         # Automation center UI
│   ├── components/                 # React components
│   │   ├── dashboard/              # Dashboard-specific components
│   │   │   ├── campaigns/          # Campaign components
│   │   │   ├── clients/            # Client components
│   │   │   └── automation/         # Automation components
│   │   └── ui/                     # Shared UI components
│   ├── lib/                        # Utilities & configurations
│   │   ├── auth/                   # Auth configuration
│   │   └── prisma.ts               # Database client
│   └── types/                      # TypeScript definitions
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── seed.ts                     # Database seeding
├── public/                         # Static assets
├── docker/                         # Docker configurations
└── scripts/                        # Build & deployment scripts
```

## Key Database Models

### Core Models
- **User**: Authentication and user management
- **Workspace**: Multi-tenancy support
- **UserWorkspace**: User-workspace relationships

### Client Management
- **Client**: Client profiles with full contact info
- **ClientReport**: Generated reports with metrics
- **ClientReportTemplate**: Reusable report templates
- **ClientReportSchedule**: Automated report generation

### Campaign & Content
- **Campaign**: Marketing campaigns
- **Post**: Social media posts
- **PostVariant**: A/B testing variants
- **ContentABTest**: A/B test configurations
- **Template**: Content templates with variables

### Analytics & Metrics
- **AnalyticsMetric**: Performance metrics
- **CampaignReport**: Campaign performance reports
- **CustomDashboard**: Personalized dashboards

### Automation
- **AutomationRule**: Trigger-based automation
- **InboxItem**: Social inbox messages

### Billing
- **Invoice**: Client invoices
- **InvoiceItem**: Line items

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/verify-email` - Email verification
- `/api/auth/[...nextauth]` - NextAuth.js handler

### Client Management
- `GET/POST /api/clients` - List/Create clients
- `GET/PUT/DELETE /api/clients/[id]` - Client CRUD
- `POST /api/clients/[id]/message` - Send messages
- `GET /api/clients/[id]/invoices` - Client invoices

### Client Reports
- `GET/POST /api/client-reports` - List/Create reports
- `GET/PUT/DELETE /api/client-reports/[id]` - Report CRUD
- `GET /api/client-reports/[id]/download` - Download report (PDF/HTML/CSV/Excel)
- `POST /api/client-reports/[id]/send` - Email report
- `GET/POST /api/client-reports/templates` - List/Create report templates
- `GET/PUT/DELETE /api/client-reports/templates/[id]` - Template CRUD operations
- `GET/POST /api/client-reports/schedules` - List/Create scheduled reports
- `GET/PUT/DELETE /api/client-reports/schedules/[id]` - Schedule CRUD operations
- `POST /api/client-reports/schedules/run` - Execute scheduled reports (cron endpoint)

#### Report History Analytics
- Advanced filtering by status, type, and client
- Historical analytics dashboard with metrics tracking
- Download count monitoring and usage patterns
- Monthly trend analysis and completion rates
- Comprehensive search across report metadata

### Campaigns
- `GET/POST /api/campaigns` - Campaign management
- `GET/POST /api/ab-tests` - A/B testing
- `GET/POST /api/campaign-reports` - Campaign analytics

### Analytics
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/export` - Export data (PDF/CSV/Excel)
- `GET /api/dashboard/posts` - Post analytics
- `GET /api/dashboard/inbox` - Message inbox

### Content & Media
- `GET/POST /api/templates` - Content templates
- `GET/POST /api/media` - Asset management
- `POST /api/media/upload` - File upload
- `DELETE /api/media/[id]` - Delete asset

### Automation
- `GET/POST /api/automation/rules` - Rule management
- `GET/POST /api/automation/responses` - Auto-responses

### Billing
- `GET/POST /api/invoices` - Invoice management
- `GET /api/invoices/[id]/download-pdf` - PDF download
- `POST /api/invoices/[id]/send-email` - Email invoice

## Component Architecture

### Dashboard Components
```typescript
// Campaign Management
CampaignsDashboard
├── CampaignList
├── CreateCampaignDialog
├── ABTestDialog
└── CampaignReportDialog

// Client Management
ClientsDashboard
├── ClientsList
├── ClientDetailsDialog
├── ClientOnboardingFlow
├── ClientReportsDashboard
│   ├── ReportsOverview
│   ├── CreateReportDialog
│   ├── EditTemplateDialog
│   ├── CreateTemplateDialog
│   └── ReportTemplates (with Add/Edit/Use functionality)
└── InvoiceCreationDialog

// Analytics
AnalyticsDashboard
├── MetricsGrid
├── ChartsSection
├── CustomDashboardBuilder
└── ExportDialog
```

### UI Components (shadcn/ui)
- Dialog, Sheet, Tabs
- Button, Input, Select
- Card, Badge, Avatar
- DataTable, Calendar
- Toast notifications

## Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library
- **Recharts**: Data visualization
- **@dnd-kit**: Drag-and-drop

### Backend
- **Node.js 20**: Runtime environment
- **Prisma**: ORM for PostgreSQL
- **NextAuth.js**: Authentication
- **nodemailer**: Email sending

### Database
- **PostgreSQL**: Primary database
- **Redis**: Caching layer

### Infrastructure
- **Docker**: Containerization
- **Mailhog**: Email testing
- **GitHub Actions**: CI/CD

## Environment Configuration

```env
# Authentication
NEXTAUTH_URL=http://localhost:3099
NEXTAUTH_SECRET=your-secret-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sociallyhub

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@sociallyhub.com

# Optional Services
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
```

## Development Workflow

### Local Development
```bash
# Start services
./dev-local.sh

# Clean rebuild
./dev-local.sh --clean

# Database operations
npx prisma db push
npx prisma generate
npx prisma studio
```

### Testing Ports
- **3099**: Next.js application
- **5432**: PostgreSQL database
- **6379**: Redis cache
- **1025**: SMTP (Mailhog)
- **8025**: Mailhog UI

## Recent Enhancements

### Template Management Enhancement (Latest - September 2025)
- **Real-time Updates**: Immediate UI updates without page reload
- **Template Creation**: Full CRUD operations with "Add Template" functionality  
- **Template Editing**: Professional dialogs with validation and metrics selection
- **Use Template**: Pre-fills report creation with template configuration
- **Export Formats**: Enhanced HTML/CSV/Excel with proper MS Office compatibility
- **Excel Support**: Professional spreadsheet format with proper metadata
- **Developer Experience**: Improved translation service warnings

### Client Reports System (September 2025)
- Complete report generation with templates
- Multi-format exports (PDF/Excel/CSV/HTML)
- Professional email distribution
- Automated scheduling framework
- Real-time status tracking

### Email & Download Improvements (September 2025)
- **Email Templates**: Modern gradient design with responsive layout
- **PDF Generation**: Print-optimized HTML with proper formatting
- **Metric Display**: Dynamic values with visual indicators
- **Brand Consistency**: Professional SociallyHub branding
- **User Experience**: Clear instructions and intuitive interfaces

## Security & Performance

### Security Features
- JWT-based authentication
- Workspace isolation
- Role-based access control (RBAC)
- Input validation & sanitization
- Secure file uploads with UUID naming

### Performance Optimizations
- Database indexing
- Query optimization with Prisma
- Client-side caching
- Lazy loading & code splitting
- Image optimization

## Deployment Checklist

1. **Environment Setup**
   - Configure production database
   - Set secure environment variables
   - Setup SSL certificates

2. **Services Configuration**
   - Production SMTP server
   - Redis for session storage
   - CDN for static assets

3. **Monitoring**
   - Error tracking (Sentry)
   - Performance monitoring
   - Uptime monitoring
   - Log aggregation

4. **Backup Strategy**
   - Database backups
   - File storage backups
   - Disaster recovery plan

## Status: Production Ready

All core features implemented with:
- ✅ Complete database integration
- ✅ Professional UI/UX
- ✅ Real-time updates
- ✅ Comprehensive error handling
- ✅ Mobile responsiveness
- ✅ Email integration
- ✅ File management
- ✅ Analytics & reporting