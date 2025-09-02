# SociallyHub Project Structure

## Authentication Pages

### Sign In Page
**Page:** `src/app/auth/signin/page.tsx`
**Related Files:**
- `src/lib/auth/config.ts` - NextAuth configuration with demo user and session management
- `src/lib/auth/index.ts` - Auth utilities and session helpers
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route handler
- **Database Models:** `User`, `Account`, `Session` (in `prisma/schema.prisma`)
- **Description:** Handles user authentication with email/password and OAuth providers

### Sign Up Page
**Page:** `src/app/auth/signup/page.tsx`
**Related Files:**
- `src/app/api/auth/signup/route.ts` - User registration API endpoint with email verification
- `src/lib/auth/config.ts` - Authentication configuration with email verification checks  
- `src/lib/notifications/email-service.ts` - Email verification service with professional templates
- `src/lib/config/demo.ts` - Demo mode configuration and credential display
- **Database Models:** `User`, `UserWorkspace`, `VerificationToken`
- **Features:**
  - Multi-step registration form with validation
  - Workspace name collection during signup
  - Email verification flow with professional UI messaging
  - Password strength validation (minimum 8 characters)
  - Terms of service agreement checkbox
  - Google OAuth integration option
  - Graceful error handling with inline alerts
  - Success state with email verification instructions
- **Email Verification Flow:**
  - Creates user with `emailVerified: null`
  - Generates UUID verification token with 24-hour expiry
  - Sends HTML email with verification link
  - Shows blue info box with "Check Your Email" message
  - Provides options to go to sign-in or create another account
- **Description:** Comprehensive user registration with workspace creation, email verification, and professional onboarding experience

### Email Verification Page
**Page:** `src/app/auth/verify-email/page.tsx`
**Related Files:**
- `src/app/api/auth/verify-email/route.ts` - Token validation and email verification API
- `src/lib/notifications/email-service.ts` - Email service with verification templates
- **Database Models:** `User`, `VerificationToken`
- **Features:**
  - Automatic token validation on page load
  - Professional loading state with spinner
  - Success state with checkmark icon and confirmation message
  - Error handling for expired, invalid, or already used tokens
  - Clear action buttons for next steps
  - Token cleanup after successful verification
  - Responsive design with consistent branding
- **API Endpoints:**
  - `GET /api/auth/verify-email?token={token}` - Validates and processes verification token
  - `POST /api/auth/verify-email` - Resends verification email if needed
- **Description:** Complete email address verification system with professional UI, token validation, automatic cleanup, and comprehensive error handling

### Auth Error Page
**Page:** `src/app/auth/error/page.tsx`
**Description:** Error handling page for authentication failures

## Main Dashboard Pages

### Dashboard Home
**Page:** `src/app/dashboard/page.tsx`
**Related Files:**
- `src/components/dashboard/overview/dashboard-overview.tsx` - Main dashboard component
- `src/app/api/analytics/dashboard/route.ts` - Dashboard metrics API with real database integration
- `src/app/api/dashboard/posts/route.ts` - Dashboard recent posts API with engagement metrics
- `src/app/api/dashboard/inbox/route.ts` - Dashboard inbox items API with social media integration
- `src/app/api/monitoring/metrics/route.ts` - System health metrics
- `src/lib/auth/demo-user.ts` - User ID normalization for legacy session compatibility
- **Database Models:** `AnalyticsMetric`, `Post`, `Campaign`, `UserWorkspace`, `SocialAccount`, `InboxItem`
- **Features:**
  - **Real-time Statistics**: Live dashboard metrics from actual database data
  - **Personalized Greeting**: Welcome message with user's first name
  - **Functional Navigation**: All buttons properly navigate to relevant pages
  - **Professional UI**: Material Design with loading states and animations
  - **Error Handling**: Graceful API failure handling with user-friendly messages
  - **Responsive Design**: Optimized for mobile and desktop experiences
- **Statistics Integration:**
  - Posts This Month: Real count from user's workspace posts
  - Total Comments: Actual engagement metrics from social media
  - Total Reach: Real audience reach data across platforms
  - Connected Accounts: Actual count of linked social media accounts
  - Dynamic trend indicators based on performance thresholds
- **Recent Posts Section:**
  - **Real Data Integration**: Shows actual user posts with engagement metrics
  - **Status Indicators**: Visual badges for published, scheduled, and draft posts
  - **Platform Display**: Shows which social platforms each post targets
  - **Engagement Metrics**: Real likes, comments, shares data when available
  - **Smart Time Display**: Relative time formatting ("2 hours ago", "Tomorrow 9:00 AM")
  - **Loading States**: Professional skeleton animations during data fetch
  - **Empty States**: Encouraging messages for users with no posts yet
  - **Error Handling**: Clear error messages with recovery options
- **Inbox Section:**
  - **Live Social Interactions**: Real comments, mentions, DMs from social platforms
  - **Urgency Detection**: Automatic highlighting of high-priority or negative sentiment items
  - **Platform Integration**: Shows source platform for each interaction
  - **Assignee Information**: Displays who is responsible for handling each item
  - **Type Differentiation**: Visual distinction between mentions, DMs, comments
  - **Summary Statistics**: Total, urgent, pending, and replied item counts
  - **Content Truncation**: Smart text truncation for better dashboard layout
  - **Loading States**: Skeleton animations matching inbox item structure
- **Interactive Elements:**
  - Compose Post button → `/dashboard/posts?compose=true`
  - View Calendar button → `/dashboard/calendar`
  - View All Messages button → `/dashboard/inbox`
  - Quick action buttons for all major features
  - Hover animations and professional transitions
- **API Endpoints:**
  - `GET /api/analytics/dashboard` - Dashboard statistics and metrics
  - `GET /api/dashboard/posts?limit=3` - Recent posts with engagement data
  - `GET /api/dashboard/inbox?limit=3` - Recent inbox items with platform details
- **Description:** Comprehensive dashboard with real-time metrics, actual user content, live social interactions, and fully functional navigation to all platform features

### Posts Management
**Page:** `src/app/dashboard/posts/page.tsx`
**Related Files:**
- `src/components/dashboard/posts/post-composer.tsx` - Post creation interface
- `src/components/dashboard/posts/post-comments-system.tsx` - Comments and feedback
- `src/app/api/posts/route.ts` - Posts CRUD operations
- `src/app/api/media/upload/route.ts` - Media upload endpoint
- `src/lib/jobs/processors/post-scheduling.ts` - Post scheduling service
- **Database Models:** `Post`, `PostVariant`, `MediaAsset`
- **Description:** Content creation, scheduling, and management interface

### Content Calendar
**Page:** `src/app/dashboard/calendar/page.tsx`
**Related Files:**
- `src/components/dashboard/calendar/calendar-grid.tsx` - Calendar view component
- `src/components/dashboard/calendar/draggable-calendar-event.tsx` - Drag & drop functionality
- `src/components/dashboard/calendar/post-scheduler.tsx` - Scheduling interface
- `src/components/dashboard/calendar/bulk-scheduler.tsx` - Bulk scheduling
- `src/app/api/posts/route.ts` - Posts API for calendar operations
- **Database Models:** `Post`, `Campaign`
- **Description:** Visual content calendar with drag-and-drop scheduling

### Analytics Platform (Enterprise-Grade)
**Page:** `src/app/dashboard/analytics/page.tsx`
**Related Files:**

#### Core Analytics Components
- `src/components/dashboard/analytics/analytics-dashboard.tsx` - Main tabbed analytics interface
- `src/components/dashboard/analytics/analytics-overview-cards.tsx` - Overview metrics cards
- `src/components/dashboard/analytics/engagement-metrics.tsx` - Engagement tracking and analysis
- `src/components/dashboard/analytics/performance-comparison.tsx` - Cross-platform performance comparison

#### Real-Time Analytics System
- `src/components/dashboard/analytics/real-time-analytics.tsx` - Live metrics dashboard (3-second updates)
- `src/app/api/analytics/realtime/route.ts` - Real-time data API with database integration
- **Features:** Live user activity, engagement tracking, platform monitoring
- **Data Sources:** Real AnalyticsMetric data, actual post engagement, inbox activity

#### Export & Reporting System
- `src/components/dashboard/analytics/export-reports.tsx` - Professional report generation UI
- `src/app/api/analytics/export/route.ts` - Multi-format export API (PDF/Excel/CSV)
- **Formats Supported:**
  - **PDF:** Professional branded reports with SociallyHub logo and styling
  - **Excel:** .xlsx files with proper formatting and data structure
  - **CSV:** Clean data export for external analysis
- **Features:** Custom date ranges, metric selection, report descriptions, branded templates

#### Custom Dashboard System
- `src/components/dashboard/analytics/custom-dashboard.tsx` - Drag-and-drop dashboard builder
- `src/app/api/analytics/dashboards/route.ts` - Full CRUD API for dashboard persistence
- **Database Model:** `CustomDashboard` with user/workspace relationships
- **Features:**
  - **Drag-and-Drop Interface:** @dnd-kit integration for React 19 compatibility
  - **Widget Types:** Metrics, charts, tables, progress indicators, activity feeds
  - **Persistent Storage:** Database-backed with auto-save functionality
  - **User-Specific:** Individual dashboards per user/workspace
  - **Real-Time Updates:** Live data integration with all widget types

#### API Endpoints
- `GET /api/analytics/dashboard` - Overview dashboard metrics
- `GET /api/analytics/realtime` - Real-time metrics (fixed database queries)
- `POST /api/analytics/export` - Generate and download reports
- `GET /api/analytics/dashboards` - List user's custom dashboards
- `POST /api/analytics/dashboards` - Create new custom dashboard
- `PUT /api/analytics/dashboards` - Update existing dashboard
- `DELETE /api/analytics/dashboards` - Delete dashboard (with safety checks)

#### Database Models
- **AnalyticsMetric** - Core metrics storage (metricType, value, dimensions)
- **CustomDashboard** - Dashboard configurations and layouts (NEW)
- **UserSession** - User activity tracking
- **UserAction** - Detailed user behavior analytics
- **Post** - Content performance metrics
- **InboxItem** - Engagement and interaction data

#### Key Features
- **Zero Mock Data:** All analytics use real database information
- **Production-Grade Export:** Professional PDF reports with branding
- **Real-Time Updates:** Live data refresh every 3 seconds
- **Custom Dashboards:** Persistent, user-specific dashboard configurations
- **Cross-Platform Analytics:** Unified view of all connected social accounts
- **Enterprise Security:** User authentication and workspace isolation
- **Scalable Architecture:** Optimized queries with proper indexing

#### Technical Implementation
- **Database Integration:** Prisma ORM with PostgreSQL
- **Real-Time System:** Polling-based updates with error handling
- **Export Generation:** Server-side PDF/Excel generation
- **Drag-and-Drop:** @dnd-kit library for modern React compatibility
- **Type Safety:** Full TypeScript interfaces throughout
- **Error Handling:** Comprehensive error boundaries and fallbacks

**Description:** Enterprise-grade analytics platform with real-time monitoring, professional reporting, and customizable dashboards. Completely production-ready with zero mock data and full database integration.

### Inbox
**Page:** `src/app/dashboard/inbox/page.tsx`
**Related Files:**
- `src/components/dashboard/inbox/inbox-dashboard.tsx` - Unified inbox interface with real workspace integration
- `src/components/dashboard/inbox/conversation-view.tsx` - Message threads and conversation management
- `src/components/dashboard/inbox/sentiment-analysis.tsx` - AI-powered sentiment tracking
- `src/components/dashboard/inbox/automated-responses.tsx` - Database-driven auto-response system
- `src/app/api/inbox/route.ts` - Inbox messages API with workspace filtering
- `src/app/api/inbox/automated-responses/route.ts` - Automated responses CRUD API
- `src/app/api/inbox/automated-responses/[id]/route.ts` - Individual response management
- `src/app/api/inbox/[id]/reply/route.ts` - Reply handling and conversation threading
- `src/app/api/inbox/stats/route.ts` - Inbox statistics and metrics
- `src/lib/audience/sentiment-analyzer.ts` - Sentiment analysis service
- `src/lib/auth/demo-user.ts` - User ID normalization for workspace access
- **Database Models:** `InboxItem`, `Conversation`, `SentimentAnalysis`, `AutomationRule`
- **Features:**
  - **Real Workspace Integration**: Dynamic workspace lookup from user's database relationships
  - **Database-Driven Auto-Responses**: Complete CRUD operations for automated response management
  - **AutomationRule Integration**: Leverages existing automation infrastructure with `SMART_RESPONSE` type
  - **Workspace Access Validation**: Proper security through `UserWorkspace` model verification
  - **Optimistic UI Updates**: Immediate feedback with error rollback for all operations
  - **Professional Error Handling**: Comprehensive API error handling with user-friendly messages
- **Automated Response System:**
  - **Trigger Types**: Support for sentiment, keyword, platform, and time-based triggers
  - **Response Templates**: Customizable response messages with delay settings
  - **Conditions**: Advanced filtering by platform, message type, and sentiment
  - **Priority Management**: Configurable response priority with execution ordering  
  - **Usage Tracking**: Metrics for response effectiveness and execution history
  - **Enable/Disable**: Real-time toggle functionality with database persistence
- **API Endpoints:**
  - `GET /api/inbox/automated-responses?workspaceId={id}` - List workspace responses
  - `POST /api/inbox/automated-responses` - Create new automated response
  - `PATCH /api/inbox/automated-responses/{id}` - Update existing response
  - `DELETE /api/inbox/automated-responses/{id}` - Delete response with validation
- **Description:** Professional unified social media inbox with comprehensive automated response management, real database integration, and workspace-based security

### Campaigns - Complete Database Integration
**Page:** `src/app/dashboard/campaigns/page.tsx`
**Related Files:**

#### Core Campaign Management
- `src/components/dashboard/campaigns/campaign-dashboard.tsx` - Campaign overview with real data integration
- `src/components/dashboard/campaigns/campaign-details-dialog.tsx` - **NEW** Comprehensive campaign details and budget editing dialog
- `src/components/dashboard/campaigns/campaign-card.tsx` - Campaign card display with real budget data
- `src/components/dashboard/campaigns/create-campaign-dialog.tsx` - Campaign creation with proper dialog functionality
- `src/app/api/campaigns/route.ts` - Campaigns CRUD API with workspace validation
- `src/app/api/campaigns/stats/route.ts` - Campaign statistics and performance metrics
- `src/app/api/campaigns/[id]/route.ts` - Individual campaign management with budget and type updates
- `src/app/api/campaigns/analytics/route.ts` - **NEW** Real-time campaign analytics with database aggregation

#### A/B Testing System (NEW - Database Integrated)
- `src/components/dashboard/campaigns/ab-testing-dashboard.tsx` - A/B testing management with database loading
- `src/components/dashboard/campaigns/create-ab-test-dialog.tsx` - A/B test creation dialog with API integration
- `src/app/api/ab-tests/route.ts` - **NEW** A/B test creation and management API
- **Database Model:** `ContentABTest` - Uses existing model with JSON variants structure
- **Features:**
  - Create A/B tests with traffic split configuration (10-90% range)
  - Variant management with control and test content
  - Statistical confidence level settings (90%, 95%, 99%)
  - Real database persistence using ContentABTest model
  - Workspace-based access control and data isolation
  - Campaign association and validation

#### Campaign Reporting System (NEW - Database Integrated)
- `src/components/dashboard/campaigns/campaign-reporting.tsx` - Report management with database loading
- `src/components/dashboard/campaigns/create-report-dialog.tsx` - Report creation dialog with API integration
- `src/app/api/campaign-reports/route.ts` - **NEW** Campaign report creation and management API
- **Database Model:** `CampaignReport` - **NEW** model for report configurations
- **Features:**
  - Multiple report types (Performance, Executive, Detailed, A/B Test, Custom)
  - Multiple export formats (PDF, Excel, CSV, HTML)
  - Scheduling options (On Demand, Daily, Weekly, Monthly)
  - Campaign selection with multi-campaign reports
  - Section customization (overview, performance, demographics, etc.)
  - Email recipient configuration for automated distribution
  - Report status tracking (Ready, Generating, Completed, Failed)

#### Campaign Analytics System (NEW - Real Database Implementation)
- `src/components/dashboard/campaigns/campaign-analytics.tsx` - **ENHANCED** Real-time analytics dashboard with database integration
- `src/app/api/campaigns/analytics/route.ts` - **NEW** Comprehensive analytics aggregation API
- **Data Sources:** `AnalyticsMetric`, `Campaign`, `Post` tables with complex query aggregation
- **Features:**
  - Real-time performance metrics (reach, engagement, clicks, conversions, ROI)
  - Campaign filtering and date range selection (7d, 30d, 90d, 1y)
  - Platform-specific performance breakdowns
  - Top-performing content ranking by engagement
  - Professional loading states and empty state handling
  - Performance trends over time with daily aggregation
  - Demographic insights and platform distribution analysis

#### Campaign Details & Budget Management (NEW)
- `src/components/dashboard/campaigns/campaign-details-dialog.tsx` - **NEW** Multi-tab campaign management interface
- **Features:**
  - **Overview Tab:** Campaign information editing (name, description, status, type, timeline)
  - **Budget Tab:** Complete budget management with real-time calculations
    - Multi-currency support (USD, EUR, GBP, CAD) with proper formatting
    - Budget progress visualization with alert thresholds (75% warning, 90% critical)
    - Total budget, spent amount, daily budget, and remaining budget tracking
  - **Performance Tab:** Analytics integration (future enhancement placeholder)
  - Real-time state updates - changes visible immediately without page refresh
  - Professional validation and error handling throughout

#### Campaign Templates System (Enhanced)
- `src/components/dashboard/campaigns/campaign-templates.tsx` - **ENHANCED** Template management with functional buttons
- `src/components/dashboard/campaigns/create-template-dialog.tsx` - Template creation dialog with API integration
- `src/app/api/templates/route.ts` - **ENHANCED** Template API with workspace validation
- **Database Model:** `Template` - Enhanced existing model
- **Features:**
  - **Template Preview Dialog:** Comprehensive template preview with content, platforms, tags
  - **Use Template Functionality:** Navigation to Posts composer with template pre-fill
  - **Real Database Display:** Actual template data instead of mock content
  - Multi-platform template creation (Twitter, Facebook, Instagram, LinkedIn, YouTube, TikTok)
  - Variable system with {{variable_name}} syntax
  - Hashtag management with automatic # prefix handling
  - Campaign objectives tracking
  - Template categorization by campaign type
  - Reusable template configurations
  - Platform-specific content optimization

#### Database Schema Enhancements
- **Campaign**: **ENHANCED** existing model with budget management
  - **NEW** `budget` JSON field: `{totalBudget, spentAmount, dailyBudget, currency}`
  - Enhanced API endpoints for budget and type updates
  - Real-time budget calculations and progress tracking
- **BudgetSettings**: **NEW** model for workspace budget preferences
  - Fields: defaultCurrency, warningThreshold, criticalThreshold, limits, reporting
  - Workspace-level budget configuration and alert settings
  - Multi-currency support with automated threshold notifications
- **CampaignReport**: **NEW** model for storing report configurations and metadata
  - Fields: name, description, type, format, frequency, campaigns (JSON), sections (JSON)
  - Status tracking, download URLs, generation timestamps
  - Workspace relationships with cascade deletion
- **ContentABTest**: **EXISTING** model enhanced for proper API integration
  - JSON variants storage structure (not relational)
  - Traffic split configuration in JSON format
  - Control content fields (controlContent, controlTitle, controlHashtags)
  - Statistical confidence and sample size tracking
- **Template**: **EXISTING** model enhanced for campaign integration
  - Platform array storage with enum validation
  - Variable extraction from content using regex
  - Tag system for categorization and hashtag storage

#### UI/UX Improvements
- **Functional Buttons**: All previously disabled buttons now work with full functionality
- **Database Persistence**: All created items persist across page refreshes
- **Real-time Loading**: Components load actual data from database on page load
- **Error Handling**: Comprehensive error handling with user-friendly feedback
- **Form Validation**: Proper validation before API calls with required field checking
- **Professional Design**: Consistent UI components with loading states and success feedback

#### Critical Issues Fixed
- **Disabled Buttons**: All creation buttons (A/B Test, Report, Template) and action buttons (Use Template, Preview, View Details) now fully functional
- **Template Functionality**: Use Template navigates to Posts composer with pre-fill, Preview shows comprehensive dialog
- **Analytics Mock Data**: Completely removed all placeholder data - analytics now shows real database metrics
- **Campaign Details**: Fixed broken "View Details" button with comprehensive budget management dialog
- **Real-time Updates**: Campaign budget changes and template creation visible immediately without page refresh
- **Data Persistence**: Eliminated local state-only storage - everything saves to database
- **Schema Compatibility**: Fixed ContentABTest API to use correct JSON structure
- **API Integration**: All dialogs now call proper API endpoints instead of mock operations
- **Page Refresh Persistence**: All campaign data loads from database and survives refreshes

- **Description:** Professional campaign management system with comprehensive CRUD operations, real database integration, advanced A/B testing, custom reporting, and template management - all with complete data persistence

### Team Management
**Page:** `src/app/dashboard/team/page.tsx`
**Related Files:**
- `src/components/dashboard/team/team-manager.tsx` - Team overview
- `src/components/dashboard/team/team-invitation-system.tsx` - Invite members
- `src/components/dashboard/team/role-permission-interface.tsx` - RBAC management
- `src/components/dashboard/team/approval-workflow.tsx` - Content approval
- `src/components/dashboard/team/team-activity-feed.tsx` - Activity tracking
- `src/app/api/team/route.ts` - Team management API
- **Database Models:** `UserWorkspace`, `AuditEvent`
- **Description:** Team collaboration with role-based permissions

### Social Accounts
**Page:** `src/app/dashboard/accounts/page.tsx`
**Related Files:**
- `src/components/dashboard/accounts/social-accounts-manager.tsx` - Account management
- `src/app/api/accounts/route.ts` - Social accounts API
- `src/app/api/social/connect/route.ts` - OAuth connection handler
- **Database Models:** `SocialAccount`
- **Description:** Connected social media accounts management

### Clients
**Page:** `src/app/dashboard/clients/page.tsx`
**Related Files:**
- `src/components/dashboard/clients/client-dashboard.tsx` - Client overview with database integration
- `src/components/dashboard/clients/client-card.tsx` - Client display cards
- `src/components/dashboard/clients/client-onboarding-flow.tsx` - Professional 7-step onboarding system
- `src/components/dashboard/clients/client-stats.tsx` - Statistics dashboard
- `src/components/dashboard/clients/client-filters.tsx` - Advanced filtering
- `src/app/api/clients/route.ts` - Complete CRUD API with database integration
- `src/app/api/clients/stats/route.ts` - Real statistics from database relationships
- `src/lib/auth/demo-user.ts` - User ID normalization for workspace access
- **Database Models:** `Client`, `UserWorkspace`, `SocialAccount`, `Campaign`, `Post`
- **Features:**
  - **Complete Database Integration**: Real client data with no mock fallbacks
  - **Professional Search**: Database-driven search with debouncing and pagination
  - **Workspace Isolation**: All clients properly scoped to user workspaces
  - **Real Statistics**: Metrics calculated from actual client relationships
  - **Professional Onboarding**: 7-step client onboarding with interactive features
- **Client Onboarding System:**
  - **Step 1**: Basic Information - Company details and contact information
  - **Step 2**: Service Configuration - Service level and contract setup
  - **Step 3**: Billing Setup - Payment methods and billing address
  - **Step 4**: Brand Guidelines - Logo upload and visual identity
  - **Step 5**: Account Setup - Team member management with role-based permissions
  - **Step 6**: Social Media Integration - Platform connections with status management
  - **Step 7**: Training & Documentation - Interactive training modules and kickoff scheduling
- **Account Setup Features:**
  - Dynamic team member addition/removal with role assignment
  - Permission matrix display (Owner, Admin, Publisher, Analyst, Viewer)
  - Security settings configuration (2FA, password policies)
  - Visual role hierarchy with color-coded access levels
- **Social Media Integration:**
  - 5 major platforms: Facebook, Twitter, Instagram, LinkedIn, YouTube
  - Platform-specific icons and branding
  - Connect/disconnect functionality with visual status indicators
  - Publishing settings and cross-platform configuration
  - Timezone and scheduling preferences
- **Training & Documentation:**
  - 5 interactive training modules with progress tracking
  - Mixed media support (videos and documents) with appropriate icons
  - Professional kickoff meeting scheduler with date/time picker
  - Additional resources access (knowledge base, video library)
  - Completion tracking with visual progress indicators
- **API Integration:**
  - Real database queries with search, filtering, and pagination
  - Proper workspace validation and user authentication
  - Statistics calculated from client relationship data
  - Professional error handling and user feedback
- **Description:** Enterprise-grade client relationship management with complete database integration, professional onboarding workflow, and comprehensive team collaboration features

### Assets Management System (Enterprise File Management)
**Page:** `src/app/dashboard/assets/page.tsx`
**Related Files:**

#### Core Asset Components
- `src/components/dashboard/assets/assets-manager.tsx` - Professional media library with grid/list views
- `src/app/api/media/route.ts` - Complete asset CRUD operations with workspace filtering
- `src/app/api/media/upload/route.ts` - Enhanced file upload with validation and storage management

#### File Storage Infrastructure
- **Upload Directory**: `public/uploads/media/` - Organized file storage with UUID naming
- **File Types**: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, AVI), Documents (PDF, DOC, DOCX)
- **Storage Cleanup**: Automatic physical file deletion when assets are removed from database
- **Security**: Workspace-scoped file access with proper authentication

#### Database Integration
- **Asset Model**: Full integration with Prisma Asset model for metadata storage
- **Workspace Isolation**: All assets properly scoped to user workspaces with access control
- **User Attribution**: Upload tracking with user information and timestamp metadata
- **Real-time Queries**: Live asset listing with search, filtering, and pagination support

#### Features Implemented
- **Real Database Integration**: Eliminated all mock data, shows only actual uploaded files
- **Working File Upload**: Multi-file upload with immediate list updates and progress indicators
- **Complete File Deletion**: Physical file removal from storage prevents orphaned files
- **Professional UI**: Grid/list view modes, bulk operations, search and filtering
- **File Management**: Drag-and-drop support, file validation, and error handling
- **Storage Optimization**: UUID-based naming prevents conflicts, organized directory structure

#### Technical Achievements
- **File System Integration**: Complete upload/delete lifecycle with storage management
- **Real Workspace Lookup**: Replaced hardcoded workspace IDs with database relationships
- **Permission System**: Role-based access control for upload/delete operations (OWNER, ADMIN, PUBLISHER)
- **Error Resilience**: Comprehensive error handling for upload failures and missing files
- **Type Safety**: Full TypeScript coverage with Asset interface matching database schema
- **Performance**: Efficient database queries with pagination and filtering optimization

#### API Endpoints
- **GET /api/media** - Asset listing with workspace filtering, pagination, search, and type filtering
- **POST /api/media/upload** - Single-file upload with validation, storage, and database integration
- **DELETE /api/media** - Complete asset deletion with physical file cleanup from storage

**Database Models:** `Asset` (primary), `Workspace`, `User`, `UserWorkspace`

**Description:** Enterprise-grade digital asset management system with complete database integration, working file uploads, professional storage cleanup, and comprehensive file management capabilities. Fully integrated with workspace authentication and optimized for production deployment.

### Templates
**Page:** `src/app/dashboard/templates/page.tsx`
**Related Files:**
- `src/components/dashboard/templates/template-manager.tsx` - Complete template management with CRUD operations
- `src/app/api/templates/route.ts` - Template collection API (GET, POST, DELETE)
- `src/app/api/templates/[id]/route.ts` - Individual template API (GET, PATCH, DELETE)
- **Database Models:** `Template` with SocialProvider[] platforms and String[] tags
- **Features:**
  - Complete CRUD operations for content templates
  - Variable system with `{{variable_name}}` syntax and automatic extraction
  - Platform-specific templates with checkbox selection (Twitter, Facebook, Instagram, LinkedIn, YouTube, TikTok)
  - Clickable variable suggestions organized by category (User Info, Business, Content, Platform)
  - Real tags storage as string array in database
  - Template type mapping between frontend (EMAIL, SOCIAL_POST) and database enum (POST, RESPONSE)
  - Search and filter functionality by type and category
  - Template duplication and bulk operations
  - Workspace isolation with role-based permissions (OWNER, ADMIN, PUBLISHER)
- **Variable Categories:** user_name, user_email, company_name, brand_name, post_title, description, platform_name, campaign_name
- **Description:** Professional template management system with variable interpolation, platform targeting, and database-driven content creation

### Automation Center (Enterprise-Grade AI Platform)
**Page:** `src/app/dashboard/automation/page.tsx`
**Related Files:**

#### Core Automation Components
- `src/components/dashboard/automation/automation-dashboard.tsx` - Main tabbed automation interface
- `src/components/dashboard/automation/automation-rule-form.tsx` - Advanced rule creation with Triggers/Actions tabs
- `src/components/dashboard/automation/automation-rule-list.tsx` - Professional rule management with CRUD operations
- `src/components/dashboard/automation/automation-metrics.tsx` - Performance metrics with defensive programming
- `src/components/dashboard/automation/smart-responses.tsx` - Intelligent auto-response management

#### AI-Powered Content Intelligence
- `src/components/dashboard/automation/content-intelligence.tsx` - OpenAI-powered content analysis dashboard
- `src/app/api/automation/content-intelligence/route.ts` - OpenAI GPT-3.5-turbo integration for content insights

#### API Infrastructure
- `src/app/api/automation/rules/route.ts` - Complete automation rules CRUD with workspace validation
- `src/app/api/automation/smart-responses/route.ts` - Smart response management with role-based access
- `src/app/api/automation/metrics/route.ts` - Automation performance metrics and analytics

#### Supporting Systems
- `src/lib/automation/smart-response-system.ts` - Response generation engine
- `src/lib/automation/trend-analyzer.ts` - Trend analysis algorithms
- `src/lib/automation/content-gap-analyzer.ts` - Content opportunity identification

#### Database Models
- **AutomationRule** - Complex automation configuration with JSON triggers/actions
- **SmartResponse** - AI-generated response management
- **TrendAnalysis** - Social media trend tracking
- **ContentIntelligence** - OpenAI analysis results storage

#### Features Implemented
- **Content Intelligence**: OpenAI-powered content analysis with suggestions, trends, and gap identification
- **Advanced Rule Creation**: Multi-tab rule builder with triggers, conditions, and actions
- **Smart Response System**: Automated social media response management
- **Performance Monitoring**: Comprehensive metrics and execution tracking
- **Real-time Validation**: Live form validation and error handling
- **Professional UI**: Fixed modal layouts, eliminated scrollbar issues, enhanced UX

#### Technical Achievements
- **OpenAI Integration**: GPT-3.5-turbo for content performance analysis
- **Real Database Integration**: Eliminated all hardcoded workspace IDs and mock data
- **Permission System**: Comprehensive role-based access control (OWNER, ADMIN, PUBLISHER)
- **Error Resilience**: Defensive programming with helper functions for undefined value handling
- **Type Safety**: Full TypeScript coverage with comprehensive interfaces
- **Performance Optimization**: Efficient database queries and API response optimization

**Description:** Enterprise-grade automation platform with AI-powered content intelligence, advanced rule management, and professional smart response system. Fully integrated with OpenAI for content analysis and optimized for production deployment.

### Monitoring
**Page:** `src/app/dashboard/monitoring/page.tsx`
**Related Files:**
- `src/components/dashboard/monitoring/monitoring-dashboard.tsx` - System monitoring
- `src/app/api/monitoring/metrics/route.ts` - System metrics API
- `src/app/api/monitoring/alerts/route.ts` - Alert management
- `src/lib/monitoring/alerts.ts` - Alert service
- `src/lib/performance/performance-monitor.ts` - Performance tracking
- **Database Models:** `Alert`, `SystemMetric`
- **Description:** Real-time system monitoring and alerting

### Settings
**Page:** `src/app/dashboard/settings/page.tsx`
**Related Files:**
- `src/app/api/notifications/preferences/route.ts` - Notification settings
- **Database Models:** `UserWorkspace`, `NotificationPreference`
- **Description:** User and workspace settings management

### Profile
**Page:** `src/app/dashboard/profile/page.tsx`
**Related Files:**
- **Database Models:** `User`, `UserLanguagePreference`
- **Description:** User profile management

### Billing
**Page:** `src/app/dashboard/billing/page.tsx`
**Related Files:**
- **Database Models:** `Workspace`, `Subscription`
- **Description:** Subscription and billing management

### Help Center
**Page:** `src/app/dashboard/help/page.tsx`
**Related Files:**
- `src/components/dashboard/help/help-center.tsx` - Help documentation
- **Description:** Documentation and support resources

### Post Composer (Integrated into Posts Management)
**Functionality:** Accessed via `/dashboard/posts?compose=true`
**Related Files:**
- `src/app/dashboard/posts/page.tsx` - Unified posts management with integrated composer
- `src/components/posts/post-composer.tsx` - Enhanced composer component
- `src/app/api/ai/content/generate/route.ts` - AI content generation
- `src/app/api/ai/hashtags/suggest/route.ts` - Hashtag suggestions
- `src/app/api/ai/performance/predict/route.ts` - Performance prediction
- `src/lib/ai/ai-service.ts` - AI service layer
- **Database Models:** `Post`, `AIContentSuggestion`, `HashtagSuggestion`
- **Features:**
  - **Integrated Experience**: Composer opens automatically when navigating from compose buttons
  - **Context Awareness**: Users can see existing posts while creating new content
  - **URL Parameter Handling**: Clean parameter management with automatic cleanup
  - **State Management**: Proper integration with posts page state management
  - **AI-Powered Assistance**: Content generation, hashtag suggestions, performance prediction
- **Navigation Integration:**
  - Dashboard "Compose Post" button automatically opens composer
  - Header "+Compose" buttons trigger automatic composer opening
  - Quick action "New Post" button opens composer with context
  - Mobile-friendly navigation with consistent behavior
- **Description:** Advanced post creation with AI assistance, seamlessly integrated into the posts management workflow

### Workspace
**Page:** `src/app/dashboard/workspace/page.tsx`
**Related Files:**
- **Database Models:** `Workspace`, `UserWorkspace`
- **Description:** Workspace configuration and management

### Showcase
**Page:** `src/app/dashboard/showcase/page.tsx`
**Description:** Feature showcase and demos

## Public Pages

### Landing Page
**Page:** `src/app/page.tsx`
**Description:** Main landing page with product information

### About Page
**Page:** `src/app/about/page.tsx`
**Description:** Company and product information

### Test Page
**Page:** `src/app/test/page.tsx`
**Description:** Development testing page

## Core Services & Libraries

### AI Services
- `src/lib/ai/ai-service.ts` - Main AI service with OpenAI integration
- `src/lib/ai/ab-testing-service.ts` - A/B testing service
- `src/lib/ai/image-analyzer.ts` - Image analysis service
- `src/lib/visual/image-optimizer.ts` - Image optimization
- `src/lib/visual/image-analyzer.ts` - Visual analytics

### Authentication & Email Services
- `src/lib/auth/config.ts` - NextAuth configuration with email verification
- `src/lib/auth/index.ts` - Auth utilities and session helpers
- `src/lib/auth/demo-user.ts` - Demo user management and ID normalization helpers
- `src/lib/config/demo.ts` - Demo mode configuration and environment awareness
- `src/lib/notifications/email-service.ts` - Professional email service with verification templates and Mailhog integration

### Database
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/database/query-optimizer.ts` - Query optimization

### Background Jobs
- `src/lib/jobs/queue-manager.ts` - BullMQ queue management
- `src/lib/jobs/job-scheduler.ts` - Job scheduling
- `src/lib/jobs/processors/*` - Job processors

### Caching
- `src/lib/cache/cache-manager.ts` - Redis cache management
- `src/lib/cache/next-cache.ts` - Next.js caching

### Monitoring & Logging
- `src/lib/logger.ts` - Winston logger configuration
- `src/lib/middleware/logging.ts` - Request/response logging
- `src/lib/monitoring/alerts.ts` - Alert system
- `src/lib/performance/performance-monitor.ts` - Performance tracking

### Notifications
- `src/lib/notifications/notification-manager.ts` - Notification orchestration
- `src/lib/notifications/email-service.ts` - Email notifications
- `src/lib/notifications/webhook-service.ts` - Webhook notifications
- `src/lib/notifications/websocket-manager.ts` - Real-time notifications

### Internationalization
- `src/lib/i18n/translation-service.ts` - Translation service
- `src/lib/i18n/config.ts` - i18n configuration

## Database Models Summary

### Core Models
- **User** - User accounts and authentication with email verification support
- **Workspace** - Multi-tenant workspaces
- **UserWorkspace** - User-workspace relationships with RBAC
- **Client** - Client management for agencies
- **VerificationToken** - Email verification tokens with expiration (24-hour validity)

### Social Media
- **SocialAccount** - Connected social accounts
- **Post** - Content posts
- **PostVariant** - Platform-specific variations
- **Campaign** - Marketing campaigns
- **InboxItem** - Social media messages
- **Conversation** - Message threads

### Analytics & AI
- **AnalyticsMetric** - Performance metrics and real-time data
- **CustomDashboard** - User-specific dashboard configurations and layouts
- **AIContentSuggestion** - AI-generated content
- **SentimentAnalysis** - Sentiment tracking
- **AudienceSegment** - Audience clustering
- **ContentABTest** - A/B testing data
- **UserSession** - User activity tracking
- **UserAction** - Detailed behavior analytics

### System
- **AuditEvent** - Activity logging
- **Alert** - System alerts
- **AutomationRule** - Automation configuration
- **NotificationPreference** - User preferences

## Testing Infrastructure

### Unit & Integration Tests (`__tests__/`)

#### Test Setup
- `__tests__/setup/global-setup.js` - Jest global setup for test environment initialization
- `__tests__/setup/global-teardown.js` - Jest global teardown for cleanup after tests
- `__tests__/utils/test-helpers.ts` - Shared test utilities and mock data generators

#### Component Tests
- `__tests__/components/ui/button.test.tsx` - UI component unit tests for button component
- `__tests__/components/dashboard/overview-cards.test.tsx` - Dashboard overview cards testing
- `__tests__/components/forms/post-creation-form.test.tsx` - Form validation and submission tests

#### API Tests
- `__tests__/api/auth.test.ts` - Authentication API endpoint tests (login, signup, session)
- `__tests__/api/posts.test.ts` - Posts API CRUD operations testing
- `__tests__/api/version.test.ts` - API versioning and health check tests

#### Performance Tests
- `__tests__/performance/api-performance.test.ts` - API response time and load testing

**Description:** Comprehensive unit and integration testing suite using Jest and React Testing Library for ensuring code quality and preventing regressions.

### End-to-End Tests (`e2e/`)

#### E2E Setup
- `e2e/global-setup.ts` - Playwright global setup for browser automation
- `e2e/global-teardown.ts` - Cleanup after E2E test runs

#### Feature Tests
- `e2e/auth.spec.ts` - Authentication flow E2E tests (login, logout, registration)
- `e2e/dashboard.spec.ts` - Dashboard functionality and navigation tests

#### Quality Assurance
- `e2e/visual/visual-regression.spec.ts` - Visual regression testing to catch UI changes
- `e2e/accessibility/accessibility.spec.ts` - WCAG compliance and accessibility testing
- `e2e/performance/performance.spec.ts` - Core Web Vitals and performance metrics testing

**Description:** End-to-end testing using Playwright for full user journey validation, visual regression, and accessibility compliance.

## Docker Configuration (`docker/`)

### Database Initialization
- `docker/postgres/init.sql` - PostgreSQL database initialization script with schema setup

### Container Configuration
- `docker/entrypoint.sh` - Docker container entrypoint script for application startup
- `Dockerfile` - Multi-stage Docker build configuration for production deployment
- `docker-compose.yml` - Local development environment orchestration with all services

### Monitoring Stack
- `docker/monitoring/prometheus.yml` - Prometheus configuration for metrics collection
- `docker/monitoring/loki.yml` - Loki configuration for log aggregation
- `docker/monitoring/promtail.yml` - Promtail configuration for log shipping to Loki

**Description:** Complete Docker containerization setup for local development and production deployment with integrated monitoring stack.

## Kubernetes Deployment (`k8s/`)

### Cluster Configuration
- `k8s/namespace.yaml` - Kubernetes namespace definition for resource isolation
- `k8s/configmap.yaml` - Application configuration and environment variables
- `k8s/secrets.yaml` - Sensitive data storage (API keys, database credentials)

### Service Deployments
- `k8s/postgres-deployment.yaml` - PostgreSQL database deployment with persistent storage
- `k8s/redis-deployment.yaml` - Redis cache deployment for sessions and job queues
- `k8s/app-deployment.yaml` - Main application deployment with auto-scaling configuration

### Networking
- `k8s/ingress.yaml` - Ingress controller configuration for external access and SSL

**Description:** Production-ready Kubernetes manifests for deploying SociallyHub in a cloud-native environment with high availability and scalability.

## Automation Scripts (`scripts/`)

### Backup Scripts
- `scripts/backup/postgres-backup.sh` - Automated PostgreSQL database backup script
- `scripts/backup/redis-backup.sh` - Redis data export and backup script
- `scripts/backup/backup-cron.yaml` - Kubernetes CronJob for scheduled backups

### Deployment Scripts
- `scripts/deploy/deploy.sh` - Production deployment automation script with health checks
- `scripts/deploy/rollback.sh` - Quick rollback script for failed deployments

**Description:** Utility scripts for database backups, deployment automation, and disaster recovery procedures.

## CI/CD Configuration (`.github/`)

### GitHub Actions Workflows
- `.github/workflows/ci.yml` - Continuous Integration workflow
  - Runs on every push and pull request
  - Executes linting, type checking, unit tests, and builds
  - Validates Docker image creation
  
- `.github/workflows/deploy.yml` - Continuous Deployment workflow
  - Triggered on main branch merges
  - Builds and pushes Docker images to registry
  - Deploys to staging/production Kubernetes clusters
  - Runs smoke tests post-deployment

- `.github/workflows/cron-tests.yml` - Scheduled testing workflow
  - Daily E2E test runs against production
  - Weekly performance and accessibility audits
  - Monthly security vulnerability scanning

### Pull Request Template
- `.github/PULL_REQUEST_TEMPLATE.md` - Standardized PR template with checklist
  - Description requirements
  - Testing checklist
  - Documentation updates
  - Breaking changes notification

**Description:** GitHub Actions CI/CD pipelines for automated testing, building, and deployment with comprehensive quality gates and security scanning.