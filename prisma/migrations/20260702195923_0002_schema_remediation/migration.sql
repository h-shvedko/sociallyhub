-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."TicketCategory" AS ENUM ('GENERAL', 'TECHNICAL', 'BILLING', 'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT', 'INTEGRATION', 'API', 'SECURITY', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "public"."TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_AGENT', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TicketType" AS ENUM ('SUPPORT', 'SALES', 'TECHNICAL', 'BILLING', 'COMPLAINT', 'COMPLIMENT', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "public"."TicketUpdateType" AS ENUM ('STATUS_CHANGE', 'PRIORITY_CHANGE', 'ASSIGNMENT_CHANGE', 'USER_REPLY', 'AGENT_REPLY', 'INTERNAL_NOTE', 'RESOLUTION', 'ESCALATION', 'SLA_BREACH', 'SYSTEM_UPDATE');

-- CreateEnum
CREATE TYPE "public"."ForumCategory" AS ENUM ('GENERAL', 'SUPPORT', 'FEATURE_REQUESTS', 'ANNOUNCEMENTS', 'DEVELOPMENT', 'INTEGRATIONS', 'FEEDBACK', 'SHOWCASE', 'OFF_TOPIC');

-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "public"."FeatureCategory" AS ENUM ('GENERAL', 'UI_UX', 'INTEGRATIONS', 'API', 'ANALYTICS', 'AUTOMATION', 'MOBILE', 'PERFORMANCE', 'SECURITY', 'ACCESSIBILITY');

-- CreateEnum
CREATE TYPE "public"."RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'IN_DEVELOPMENT', 'TESTING', 'COMPLETED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "public"."CommunityActivityType" AS ENUM ('FORUM_POST_CREATED', 'FORUM_REPLY_CREATED', 'FEATURE_REQUEST_CREATED', 'FEATURE_REQUEST_VOTED', 'FEATURE_REQUEST_COMMENTED', 'DISCORD_MEMBER_JOINED', 'DISCORD_MESSAGE_POSTED', 'USER_JOINED_COMMUNITY', 'MILESTONE_REACHED', 'ANNOUNCEMENT_POSTED');

-- CreateEnum
CREATE TYPE "public"."ArticleWorkflowType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'ARCHIVE', 'REVIEW');

-- CreateEnum
CREATE TYPE "public"."ArticleWorkflowStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ModerationActionType" AS ENUM ('APPROVE', 'REJECT', 'DELETE', 'EDIT', 'PIN', 'UNPIN', 'LOCK', 'UNLOCK', 'FEATURE', 'UNFEATURE', 'MERGE', 'SPLIT', 'MOVE', 'HIDE', 'RESTORE', 'FLAG', 'UNFLAG');

-- CreateEnum
CREATE TYPE "public"."ModerationTargetType" AS ENUM ('FORUM_POST', 'FORUM_REPLY', 'FEATURE_REQUEST', 'FEATURE_COMMENT', 'USER_PROFILE', 'COMMENT', 'MESSAGE');

-- CreateEnum
CREATE TYPE "public"."ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."UserModerationAction" AS ENUM ('WARNING', 'TEMPORARY_BAN', 'PERMANENT_BAN', 'MUTE', 'RESTRICT_POSTING', 'REMOVE_PRIVILEGES', 'PROMOTE', 'DEMOTE');

-- CreateEnum
CREATE TYPE "public"."AppealStatus" AS ENUM ('NONE', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT_VIOLATION', 'MISINFORMATION', 'OFFENSIVE_LANGUAGE', 'OFF_TOPIC', 'DUPLICATE', 'TECHNICAL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "public"."ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AutoModerationTrigger" AS ENUM ('KEYWORD_MATCH', 'SPAM_DETECTION', 'TOXICITY_DETECTION', 'DUPLICATE_CONTENT', 'RATE_LIMITING', 'REPUTATION_BASED', 'PATTERN_MATCHING', 'AI_CLASSIFICATION');

-- CreateEnum
CREATE TYPE "public"."SpamType" AS ENUM ('PROMOTIONAL', 'REPETITIVE', 'MALICIOUS_LINKS', 'FAKE_ENGAGEMENT', 'IRRELEVANT_CONTENT', 'AUTOMATED_POSTING');

-- CreateEnum
CREATE TYPE "public"."QueuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."QueueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DocumentationStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."DocumentationVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."DocumentationCodeLanguage" AS ENUM ('JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'CSHARP', 'CPP', 'PHP', 'RUBY', 'GO', 'RUST', 'KOTLIN', 'SWIFT', 'SHELL', 'SQL', 'HTML', 'CSS', 'JSON', 'YAML', 'MARKDOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DocumentationCommentType" AS ENUM ('GENERAL', 'SUGGESTION', 'CORRECTION', 'QUESTION', 'APPROVAL');

-- CreateEnum
CREATE TYPE "public"."DocumentationExportFormat" AS ENUM ('PDF', 'HTML', 'MARKDOWN', 'CONFLUENCE', 'NOTION', 'DOCX');

-- CreateEnum
CREATE TYPE "public"."DocumentationWorkflowType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'ARCHIVE', 'REVIEW');

-- CreateEnum
CREATE TYPE "public"."DocumentationWorkflowStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."DocumentationVersionStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."DocumentationCodeTestStatus" AS ENUM ('UNTESTED', 'PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."DocumentationDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "public"."DocumentationUserType" AS ENUM ('VISITOR', 'REGISTERED', 'MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."DocumentationCommentStatus" AS ENUM ('PUBLISHED', 'OPEN', 'RESOLVED', 'HIDDEN', 'SPAM', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."DocumentationReferenceType" AS ENUM ('RELATED', 'PREREQUISITE', 'FOLLOW_UP', 'SEE_ALSO', 'EMBEDDED');

-- CreateEnum
CREATE TYPE "public"."DocumentationRole" AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR', 'REVIEWER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "public"."DocumentationCollaboratorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."DocumentationChangeType" AS ENUM ('CREATE', 'EDIT', 'DELETE', 'RESTORE', 'PUBLISH', 'REVERT');

-- CreateEnum
CREATE TYPE "public"."DocumentationRevisionStatus" AS ENUM ('SAVED', 'AUTO_SAVED', 'PUBLISHED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "public"."DocumentationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."DocumentationWorkflowPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."DocumentationExportType" AS ENUM ('MANUAL', 'SCHEDULED', 'BULK', 'OFFLINE');

-- CreateEnum
CREATE TYPE "public"."DocumentationExportScope" AS ENUM ('SINGLE_PAGE', 'MULTIPLE_PAGES', 'SECTION', 'FULL_DOCUMENTATION');

-- CreateEnum
CREATE TYPE "public"."DocumentationExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SystemConfigCategory" AS ENUM ('GENERAL', 'SECURITY', 'PERFORMANCE', 'INTEGRATIONS', 'NOTIFICATIONS', 'STORAGE', 'DATABASE', 'CACHE', 'EMAIL', 'API', 'FEATURES', 'COMPLIANCE', 'MONITORING', 'BACKUP');

-- CreateEnum
CREATE TYPE "public"."ConfigDataType" AS ENUM ('STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON', 'URL', 'EMAIL', 'PASSWORD', 'TEXT', 'ENUM');

-- CreateEnum
CREATE TYPE "public"."EmailTemplateCategory" AS ENUM ('AUTHENTICATION', 'NOTIFICATIONS', 'MARKETING', 'TRANSACTIONAL', 'SYSTEM', 'ALERTS', 'REPORTS', 'INVITATIONS', 'WELCOME', 'ONBOARDING', 'BILLING', 'SUPPORT');

-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('DISCORD', 'SLACK', 'ZAPIER', 'GOOGLE_ANALYTICS', 'FACEBOOK_PIXEL', 'STRIPE', 'PAYPAL', 'MAILCHIMP', 'SENDGRID', 'TWILIO', 'AWS', 'AZURE', 'GCP', 'GITHUB', 'GITLAB', 'JIRA', 'ASANA', 'TRELLO', 'NOTION', 'AIRTABLE', 'HUBSPOT', 'SALESFORCE', 'ZOOM', 'TEAMS', 'CALENDLY', 'TYPEFORM', 'INTERCOM', 'ZENDESK', 'FRESHDESK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('SECURITY', 'SYSTEM', 'USER_ACTIVITY', 'CONTENT', 'CAMPAIGNS', 'BILLING', 'INTEGRATIONS', 'PERFORMANCE', 'ALERTS', 'REPORTS', 'COMPLIANCE', 'BACKUP', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP', 'SMS', 'WEBHOOK', 'SLACK', 'DISCORD', 'TEAMS');

-- CreateEnum
CREATE TYPE "public"."NotificationFrequency" AS ENUM ('INSTANT', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "public"."SecurityCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'ENCRYPTION', 'NETWORK', 'COMPLIANCE', 'AUDIT', 'PASSWORD_POLICY', 'SESSION_MANAGEMENT', 'API_SECURITY', 'DATA_PROTECTION', 'INCIDENT_RESPONSE', 'VULNERABILITY');

-- CreateEnum
CREATE TYPE "public"."SecuritySeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."PerformanceCategory" AS ENUM ('DATABASE', 'CACHE', 'STORAGE', 'NETWORK', 'CPU', 'MEMORY', 'DISK', 'API', 'FRONTEND', 'QUEUE', 'SEARCH', 'CDN');

-- CreateEnum
CREATE TYPE "public"."BackupType" AS ENUM ('FULL', 'INCREMENTAL', 'DIFFERENTIAL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'CONFIGURATION_ONLY');

-- CreateEnum
CREATE TYPE "public"."BackupStorageLocation" AS ENUM ('LOCAL', 'AWS_S3', 'AZURE_BLOB', 'GCP_STORAGE', 'DROPBOX', 'GOOGLE_DRIVE', 'FTP', 'SFTP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."BackupPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'CORRUPTED', 'EXPIRED', 'RESTORED');

-- CreateEnum
CREATE TYPE "public"."HealthMetricCategory" AS ENUM ('SYSTEM', 'APPLICATION', 'DATABASE', 'SECURITY', 'PERFORMANCE', 'AVAILABILITY', 'ERRORS', 'CAPACITY', 'NETWORK', 'INTEGRATION', 'USER_EXPERIENCE');

-- CreateEnum
CREATE TYPE "public"."HealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL', 'UNKNOWN', 'DEGRADED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."HealthTrendDirection" AS ENUM ('IMPROVING', 'STABLE', 'DEGRADING', 'VOLATILE');

-- CreateEnum
CREATE TYPE "public"."FeatureFlagCategory" AS ENUM ('FEATURE', 'EXPERIMENT', 'ROLLOUT', 'KILL_SWITCH', 'PERMISSION', 'CONFIGURATION', 'UI_VARIATION', 'INTEGRATION', 'PERFORMANCE', 'SECURITY');

-- CreateEnum
CREATE TYPE "public"."FeatureFlagEnvironment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION', 'TEST');

-- CreateEnum
CREATE TYPE "public"."FeatureFlagEvaluationReason" AS ENUM ('TARGET_MATCH', 'RULE_MATCH', 'PERCENT_ROLLOUT', 'DEFAULT', 'OFF', 'PREREQUISITE_FAILED', 'ERROR');

-- AlterEnum
ALTER TYPE "public"."SocialProvider" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "public"."campaigns" ADD COLUMN     "budget" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "billingInfo" JSONB,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "public"."user_workspaces" DROP COLUMN "permissions";

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."team_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."WorkspaceRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "workspaceId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lineItems" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaign_reports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "campaigns" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "recipients" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "downloadUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_reports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "data" JSONB,
    "filePath" TEXT,
    "fileSize" TEXT,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastGenerated" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_report_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "format" TEXT[],
    "metrics" TEXT[],
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "customDashboard" BOOLEAN NOT NULL DEFAULT false,
    "autoEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_report_schedules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "time" TEXT NOT NULL,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."budget_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "budgetPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "warningThreshold" INTEGER NOT NULL DEFAULT 75,
    "criticalThreshold" INTEGER NOT NULL DEFAULT 90,
    "enableEmailAlerts" BOOLEAN NOT NULL DEFAULT true,
    "enablePushAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dailyLimit" DOUBLE PRECISION,
    "monthlyLimit" DOUBLE PRECISION,
    "perCampaignLimit" DOUBLE PRECISION,
    "autoStopAtLimit" BOOLEAN NOT NULL DEFAULT false,
    "reportFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "enableAutomatedReports" BOOLEAN NOT NULL DEFAULT false,
    "reportRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeProjections" BOOLEAN NOT NULL DEFAULT true,
    "includeRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "colorScheme" TEXT NOT NULL DEFAULT 'default',
    "fontScale" TEXT NOT NULL DEFAULT 'normal',
    "compactMode" BOOLEAN NOT NULL DEFAULT false,
    "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "weekStartDay" TEXT NOT NULL DEFAULT 'sunday',
    "defaultView" TEXT NOT NULL DEFAULT 'overview',
    "showWelcomeMessage" BOOLEAN NOT NULL DEFAULT true,
    "enableAnimations" BOOLEAN NOT NULL DEFAULT true,
    "enableSounds" BOOLEAN NOT NULL DEFAULT false,
    "profileVisible" BOOLEAN NOT NULL DEFAULT true,
    "activityVisible" BOOLEAN NOT NULL DEFAULT true,
    "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigest" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "monthlyDigest" BOOLEAN NOT NULL DEFAULT false,
    "digestTime" TEXT NOT NULL DEFAULT '09:00',
    "digestTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "dndEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dndStartTime" TEXT,
    "dndEndTime" TEXT,
    "dndDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_branding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'SociallyHub',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1E40AF',
    "accentColor" TEXT NOT NULL DEFAULT '#10B981',
    "colorPalette" JSONB NOT NULL DEFAULT '{}',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "fontScale" TEXT NOT NULL DEFAULT 'normal',
    "layoutConfig" JSONB NOT NULL DEFAULT '{}',
    "customCSS" TEXT,
    "features" JSONB NOT NULL DEFAULT '{}',
    "isWhiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" TEXT,
    "hideCredits" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."landing_page_config" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'SociallyHub - Social Media Management Platform',
    "description" TEXT NOT NULL DEFAULT 'Manage all your social media accounts from one powerful platform',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heroConfig" JSONB NOT NULL DEFAULT '{}',
    "featuresConfig" JSONB NOT NULL DEFAULT '{}',
    "testimonialsConfig" JSONB NOT NULL DEFAULT '{}',
    "pricingConfig" JSONB NOT NULL DEFAULT '{}',
    "ctaConfig" JSONB NOT NULL DEFAULT '{}',
    "footerConfig" JSONB NOT NULL DEFAULT '{}',
    "analyticsCode" TEXT,
    "seoConfig" JSONB NOT NULL DEFAULT '{}',
    "customSections" JSONB NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_credentials" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "lastValidated" TIMESTAMP(3),
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationError" TEXT,
    "lastUsed" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "configuredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'published',
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "featuredImage" TEXT,
    "readingTime" INTEGER,
    "relatedArticles" TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_comments" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "authorId" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "relatedArticles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_tutorials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT NOT NULL,
    "videoPlatform" TEXT NOT NULL DEFAULT 'youtube',
    "videoId" TEXT,
    "duration" INTEGER,
    "difficulty" TEXT NOT NULL DEFAULT 'beginner',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transcript" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "authorName" TEXT,
    "authorAvatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_tutorials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_playlists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "categoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_playlist_items" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_user_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "watchTime" INTEGER NOT NULL DEFAULT 0,
    "lastPosition" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_search_queries" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "categoryId" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "clickedArticles" TEXT[],
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_search_suggestions" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_search_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_sections" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "sectionId" TEXT NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'published',
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "featuredImage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "keywords" TEXT[],
    "estimatedReadTime" INTEGER,
    "lastReviewed" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_versions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changelog" TEXT,
    "status" "public"."DocumentationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "tags" TEXT[],
    "apiVersion" TEXT,
    "releaseNotes" TEXT,
    "breakingChanges" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_code_examples" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "output" TEXT,
    "isRunnable" BOOLEAN NOT NULL DEFAULT false,
    "testStatus" "public"."DocumentationCodeTestStatus" NOT NULL DEFAULT 'UNTESTED',
    "lastTested" TIMESTAMP(3),
    "testResults" JSONB,
    "dependencies" TEXT[],
    "framework" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT,
    "difficulty" "public"."DocumentationDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "estimatedTime" INTEGER,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_code_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_analytics" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "avgTimeOnPage" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "searchImpressions" INTEGER NOT NULL DEFAULT 0,
    "searchClicks" INTEGER NOT NULL DEFAULT 0,
    "searchKeywords" TEXT[],
    "country" TEXT,
    "region" TEXT,
    "loadTime" DOUBLE PRECISION,
    "errorRate" DOUBLE PRECISION,
    "userType" "public"."DocumentationUserType" NOT NULL DEFAULT 'VISITOR',
    "referralSource" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentation_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_comments" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "status" "public"."DocumentationCommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "isHelpful" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_cross_references" (
    "id" TEXT NOT NULL,
    "fromPageId" TEXT NOT NULL,
    "toPageId" TEXT NOT NULL,
    "referenceType" "public"."DocumentationReferenceType" NOT NULL DEFAULT 'RELATED',
    "anchorText" TEXT,
    "context" TEXT,
    "position" INTEGER,
    "lineNumber" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "lastChecked" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClicked" TIMESTAMP(3),
    "createdBy" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_cross_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "defaultContent" TEXT NOT NULL,
    "placeholders" TEXT[],
    "tags" TEXT[],
    "difficulty" "public"."DocumentationDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "estimatedTime" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "requiredFields" TEXT[],
    "optionalFields" TEXT[],
    "validationRules" JSONB,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "parentTemplate" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_collaborators" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."DocumentationRole" NOT NULL DEFAULT 'VIEWER',
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessed" TIMESTAMP(3),
    "contributionCount" INTEGER NOT NULL DEFAULT 0,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "status" "public"."DocumentationCollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_revisions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "tags" TEXT[],
    "revisionNumber" INTEGER NOT NULL,
    "changeType" "public"."DocumentationChangeType" NOT NULL DEFAULT 'EDIT',
    "changeSummary" TEXT,
    "changeDetails" TEXT,
    "contentDiff" JSONB,
    "wordCount" INTEGER,
    "charactersAdded" INTEGER NOT NULL DEFAULT 0,
    "charactersRemoved" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."DocumentationRevisionStatus" NOT NULL DEFAULT 'SAVED',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewStatus" "public"."DocumentationReviewStatus",
    "reviewComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_workflows" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "workflowType" "public"."DocumentationWorkflowType" NOT NULL,
    "status" "public"."DocumentationWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "assignedTo" TEXT,
    "reviewers" TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "public"."DocumentationWorkflowPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "workflowData" JSONB,
    "comments" JSONB,
    "attachments" TEXT[],
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "automationRule" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalatedTo" TEXT,
    "escalationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documentation_exports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "exportType" "public"."DocumentationExportType" NOT NULL,
    "format" "public"."DocumentationExportFormat" NOT NULL,
    "scope" "public"."DocumentationExportScope" NOT NULL DEFAULT 'SINGLE_PAGE',
    "pageIds" TEXT[],
    "sectionIds" TEXT[],
    "includeAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "includeComments" BOOLEAN NOT NULL DEFAULT false,
    "includeHistory" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "includeTableOfContents" BOOLEAN NOT NULL DEFAULT true,
    "includeCoverPage" BOOLEAN NOT NULL DEFAULT true,
    "customStyling" JSONB,
    "status" "public"."DocumentationExportStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "processingTime" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentation_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT NOT NULL DEFAULT 'support',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "maxConcurrentChats" INTEGER NOT NULL DEFAULT 5,
    "currentChatCount" INTEGER NOT NULL DEFAULT 0,
    "autoAssign" BOOLEAN NOT NULL DEFAULT true,
    "skills" TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "timezone" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_chats" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestName" TEXT,
    "subject" TEXT,
    "department" TEXT NOT NULL DEFAULT 'support',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedAgentId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "referrerUrl" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "feedback" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderType" TEXT NOT NULL,
    "senderName" TEXT,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "attachments" JSONB,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "readByUser" BOOLEAN NOT NULL DEFAULT false,
    "readByAgent" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_contact_forms" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'support',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "referrerUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedAgentId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseMessage" TEXT,
    "responseMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_contact_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "public"."TicketCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "public"."TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "type" "public"."TicketType" NOT NULL DEFAULT 'SUPPORT',
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "assignedAgentId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "expectedResponseBy" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "customFields" JSONB,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_updates" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "updateType" "public"."TicketUpdateType" NOT NULL,
    "message" TEXT,
    "oldStatus" "public"."TicketStatus",
    "newStatus" "public"."TicketStatus",
    "oldPriority" "public"."TicketPriority",
    "newPriority" "public"."TicketPriority",
    "oldAssignee" TEXT,
    "newAssignee" TEXT,
    "authorId" TEXT,
    "authorType" TEXT NOT NULL,
    "authorName" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isResolution" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedByType" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "isScanned" BOOLEAN NOT NULL DEFAULT false,
    "scanResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_assignments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "support_ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_notes" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_forum_posts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "public"."ForumCategory" NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "guestName" TEXT,
    "guestEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_forum_replies" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_forum_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_forum_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "postId" TEXT,
    "replyId" TEXT,
    "voteType" "public"."VoteType" NOT NULL,
    "guestIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_forum_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "public"."FeatureCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "public"."RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "estimatedEffort" TEXT,
    "targetVersion" TEXT,
    "implementedAt" TIMESTAMP(3),
    "votes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "internalNotes" TEXT,
    "assignedTo" TEXT,
    "githubIssueUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_request_votes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "guestIdentifier" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_request_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_request_comments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_request_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discord_integrations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "guildIcon" TEXT,
    "inviteUrl" TEXT NOT NULL,
    "channels" JSONB NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "onlineMembers" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoAnnounce" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_activities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "activityType" "public"."CommunityActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT,
    "targetId" TEXT,
    "targetType" TEXT,
    "targetTitle" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_revisions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "changeSummary" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_article_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_workflows" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "workflowType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "reviewedById" TEXT,
    "proposedTitle" TEXT,
    "proposedContent" TEXT,
    "proposedExcerpt" TEXT,
    "proposedCategoryId" TEXT,
    "proposedTags" TEXT[],
    "proposedSeoTitle" TEXT,
    "proposedSeoDescription" TEXT,
    "reviewComments" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_media" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_analytics" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "views" INTEGER DEFAULT 0,
    "timeOnPage" INTEGER,
    "rating" DOUBLE PRECISION,
    "helpful" BOOLEAN,
    "searchQuery" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_article_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_article_relations" (
    "id" TEXT NOT NULL,
    "fromArticleId" TEXT NOT NULL,
    "toArticleId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'related',
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."help_category_analytics" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalArticles" INTEGER NOT NULL DEFAULT 0,
    "publishedArticles" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,

    CONSTRAINT "help_category_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderation_actions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "actionType" "public"."ModerationActionType" NOT NULL,
    "targetType" "public"."ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "ruleId" TEXT,
    "status" "public"."ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_moderation_history" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "actionType" "public"."UserModerationAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canAppeal" BOOLEAN NOT NULL DEFAULT true,
    "appealedAt" TIMESTAMP(3),
    "appealReason" TEXT,
    "appealStatus" "public"."AppealStatus" NOT NULL DEFAULT 'NONE',
    "appealResolvedBy" TEXT,
    "appealResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_moderation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_reports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reporterId" TEXT,
    "contentType" "public"."ModerationTargetType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentUrl" TEXT,
    "reportReason" "public"."ReportReason" NOT NULL,
    "customReason" TEXT,
    "description" TEXT,
    "evidence" JSONB,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestIp" TEXT,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."ReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "autoProcessed" BOOLEAN NOT NULL DEFAULT false,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auto_moderation_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "public"."AutoModerationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL,
    "targetTypes" "public"."ModerationTargetType"[],
    "actions" JSONB NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "notifyModerators" BOOLEAN NOT NULL DEFAULT true,
    "escalateAfter" INTEGER,
    "triggeredCount" INTEGER NOT NULL DEFAULT 0,
    "falsePositives" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "auto_moderation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."spam_detections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentType" "public"."ModerationTargetType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isSpam" BOOLEAN NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "spamType" "public"."SpamType" NOT NULL,
    "detectionFactors" JSONB NOT NULL,
    "matchedPatterns" TEXT[],
    "suspiciousWords" TEXT[],
    "authorId" TEXT,
    "authorReputation" DOUBLE PRECISION,
    "postFrequency" INTEGER,
    "actionTaken" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spam_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderation_queue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "itemType" "public"."ModerationTargetType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "priority" "public"."QueuePriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMP(3),
    "status" "public"."QueueStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "estimatedTime" INTEGER,
    "source" TEXT NOT NULL,
    "context" JSONB,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "escalatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_analytics" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "totalModerations" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "bannedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "communityHealth" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "moderationLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userSatisfaction" DOUBLE PRECISION,
    "spamDetected" INTEGER NOT NULL DEFAULT 0,
    "falsePositives" INTEGER NOT NULL DEFAULT 0,
    "contentQuality" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "workspaceId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "category" "public"."SystemConfigCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" "public"."ConfigDataType" NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "validationRules" JSONB,
    "defaultValue" TEXT,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "public"."EmailTemplateCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "previewData" JSONB,
    "lastUsed" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integration_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "credentials" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "lastSync" TIMESTAMP(3),
    "syncInterval" INTEGER,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "features" JSONB,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "createdBy" TEXT NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branding_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyName" TEXT,
    "logoUrl" TEXT,
    "logoUrlDark" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "colorPalette" JSONB,
    "fontFamily" TEXT,
    "fontScale" DOUBLE PRECISION DEFAULT 1.0,
    "customCSS" TEXT,
    "isWhiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" TEXT,
    "hideCredits" BOOLEAN NOT NULL DEFAULT false,
    "footerText" TEXT,
    "copyrightText" TEXT,
    "socialLinks" JSONB,
    "contactInfo" JSONB,
    "features" JSONB,
    "customFields" JSONB,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "category" "public"."NotificationCategory" NOT NULL,
    "eventType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "public"."NotificationChannel"[],
    "defaultRecipients" JSONB,
    "template" TEXT,
    "frequency" "public"."NotificationFrequency" NOT NULL DEFAULT 'INSTANT',
    "quietHours" JSONB,
    "conditions" JSONB,
    "customMessage" TEXT,
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "batchSize" INTEGER,
    "lastTriggered" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "category" "public"."SecurityCategory" NOT NULL,
    "setting" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "public"."SecuritySeverity" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "recommendedValue" TEXT,
    "complianceStandards" JSONB,
    "lastAudit" TIMESTAMP(3),
    "auditResult" TEXT,
    "autoRemediation" BOOLEAN NOT NULL DEFAULT false,
    "remediationScript" TEXT,
    "alertThreshold" INTEGER,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "lastViolation" TIMESTAMP(3),
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "category" "public"."PerformanceCategory" NOT NULL,
    "setting" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" "public"."ConfigDataType" NOT NULL,
    "unit" TEXT,
    "threshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "isAutoTuning" BOOLEAN NOT NULL DEFAULT false,
    "autoTuningRules" JSONB,
    "impactScore" DOUBLE PRECISION,
    "lastOptimized" TIMESTAMP(3),
    "benchmarkValue" DOUBLE PRECISION,
    "currentMetric" DOUBLE PRECISION,
    "lastMeasured" TIMESTAMP(3),
    "recommendations" JSONB,
    "dependencies" JSONB,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_configurations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "backupType" "public"."BackupType" NOT NULL,
    "schedule" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retention" INTEGER NOT NULL,
    "compression" BOOLEAN NOT NULL DEFAULT true,
    "encryption" BOOLEAN NOT NULL DEFAULT true,
    "includeMedia" BOOLEAN NOT NULL DEFAULT true,
    "excludePatterns" JSONB,
    "storageLocation" "public"."BackupStorageLocation" NOT NULL,
    "storageConfig" JSONB NOT NULL,
    "notifications" JSONB,
    "priority" "public"."BackupPriority" NOT NULL DEFAULT 'NORMAL',
    "maxSize" BIGINT,
    "parallelJobs" INTEGER NOT NULL DEFAULT 1,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "lastSuccess" TIMESTAMP(3),
    "lastFailure" TIMESTAMP(3),
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "avgDuration" INTEGER,
    "createdBy" TEXT NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."backup_records" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "backupType" "public"."BackupType" NOT NULL,
    "status" "public"."BackupStatus" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "recordCount" INTEGER,
    "compressionRatio" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "logs" TEXT,
    "metadata" JSONB,
    "isCorrupted" BOOLEAN NOT NULL DEFAULT false,
    "lastVerified" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownload" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isRestored" BOOLEAN NOT NULL DEFAULT false,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_health_metrics" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "category" "public"."HealthMetricCategory" NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "status" "public"."HealthStatus" NOT NULL,
    "threshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "trend" "public"."HealthTrendDirection",
    "previousValue" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyScore" DOUBLE PRECISION,
    "tags" JSONB,
    "metadata" JSONB,
    "source" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."FeatureFlagCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "userTargeting" JSONB,
    "groupTargeting" JSONB,
    "geoTargeting" JSONB,
    "timeTargeting" JSONB,
    "conditions" JSONB,
    "variants" JSONB,
    "defaultVariant" TEXT,
    "prerequisites" JSONB,
    "tags" TEXT[],
    "environment" "public"."FeatureFlagEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "lastEvaluated" TIMESTAMP(3),
    "evaluationCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flag_evaluations" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" BOOLEAN NOT NULL,
    "variant" TEXT,
    "reason" "public"."FeatureFlagEvaluationReason" NOT NULL,
    "metadata" JSONB,
    "geoLocation" TEXT,
    "userRole" TEXT,
    "userSegment" TEXT,
    "deviceType" TEXT,
    "referrer" TEXT,

    CONSTRAINT "feature_flag_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_invitations_token_key" ON "public"."team_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_workspaceId_invoiceNumber_key" ON "public"."invoices"("workspaceId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "client_reports_clientId_status_idx" ON "public"."client_reports"("clientId", "status");

-- CreateIndex
CREATE INDEX "client_reports_frequency_status_idx" ON "public"."client_reports"("frequency", "status");

-- CreateIndex
CREATE INDEX "client_report_schedules_isActive_nextRun_idx" ON "public"."client_report_schedules"("isActive", "nextRun");

-- CreateIndex
CREATE UNIQUE INDEX "budget_settings_workspaceId_key" ON "public"."budget_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "public"."user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "public"."notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "client_branding_workspaceId_key" ON "public"."client_branding"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_config_workspaceId_key" ON "public"."landing_page_config"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_credentials_workspaceId_platform_key" ON "public"."platform_credentials"("workspaceId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "help_categories_slug_key" ON "public"."help_categories"("slug");

-- CreateIndex
CREATE INDEX "help_categories_slug_idx" ON "public"."help_categories"("slug");

-- CreateIndex
CREATE INDEX "help_categories_isActive_idx" ON "public"."help_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "public"."help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_categoryId_idx" ON "public"."help_articles"("categoryId");

-- CreateIndex
CREATE INDEX "help_articles_status_idx" ON "public"."help_articles"("status");

-- CreateIndex
CREATE INDEX "help_articles_publishedAt_idx" ON "public"."help_articles"("publishedAt");

-- CreateIndex
CREATE INDEX "help_articles_slug_idx" ON "public"."help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_article_comments_articleId_idx" ON "public"."help_article_comments"("articleId");

-- CreateIndex
CREATE INDEX "help_article_comments_isApproved_idx" ON "public"."help_article_comments"("isApproved");

-- CreateIndex
CREATE INDEX "help_article_bookmarks_userId_idx" ON "public"."help_article_bookmarks"("userId");

-- CreateIndex
CREATE INDEX "help_article_bookmarks_articleId_idx" ON "public"."help_article_bookmarks"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_bookmarks_userId_articleId_key" ON "public"."help_article_bookmarks"("userId", "articleId");

-- CreateIndex
CREATE INDEX "help_faqs_categoryId_idx" ON "public"."help_faqs"("categoryId");

-- CreateIndex
CREATE INDEX "help_faqs_isActive_idx" ON "public"."help_faqs"("isActive");

-- CreateIndex
CREATE INDEX "help_faqs_isPinned_idx" ON "public"."help_faqs"("isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "video_tutorials_slug_key" ON "public"."video_tutorials"("slug");

-- CreateIndex
CREATE INDEX "video_tutorials_categoryId_idx" ON "public"."video_tutorials"("categoryId");

-- CreateIndex
CREATE INDEX "video_tutorials_isActive_isPublished_idx" ON "public"."video_tutorials"("isActive", "isPublished");

-- CreateIndex
CREATE INDEX "video_tutorials_isFeatured_idx" ON "public"."video_tutorials"("isFeatured");

-- CreateIndex
CREATE INDEX "video_tutorials_difficulty_idx" ON "public"."video_tutorials"("difficulty");

-- CreateIndex
CREATE INDEX "video_tutorials_videoPlatform_idx" ON "public"."video_tutorials"("videoPlatform");

-- CreateIndex
CREATE INDEX "video_tutorials_publishedAt_idx" ON "public"."video_tutorials"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_playlists_slug_key" ON "public"."video_playlists"("slug");

-- CreateIndex
CREATE INDEX "video_playlists_categoryId_idx" ON "public"."video_playlists"("categoryId");

-- CreateIndex
CREATE INDEX "video_playlists_isActive_isPublished_idx" ON "public"."video_playlists"("isActive", "isPublished");

-- CreateIndex
CREATE INDEX "video_playlists_isFeatured_idx" ON "public"."video_playlists"("isFeatured");

-- CreateIndex
CREATE INDEX "video_playlist_items_playlistId_sortOrder_idx" ON "public"."video_playlist_items"("playlistId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "video_playlist_items_playlistId_videoId_key" ON "public"."video_playlist_items"("playlistId", "videoId");

-- CreateIndex
CREATE INDEX "video_user_progress_userId_idx" ON "public"."video_user_progress"("userId");

-- CreateIndex
CREATE INDEX "video_user_progress_videoId_idx" ON "public"."video_user_progress"("videoId");

-- CreateIndex
CREATE INDEX "video_user_progress_isCompleted_idx" ON "public"."video_user_progress"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "video_user_progress_userId_videoId_key" ON "public"."video_user_progress"("userId", "videoId");

-- CreateIndex
CREATE INDEX "help_search_queries_query_idx" ON "public"."help_search_queries"("query");

-- CreateIndex
CREATE INDEX "help_search_queries_createdAt_idx" ON "public"."help_search_queries"("createdAt");

-- CreateIndex
CREATE INDEX "help_search_queries_resultsCount_idx" ON "public"."help_search_queries"("resultsCount");

-- CreateIndex
CREATE UNIQUE INDEX "help_search_suggestions_query_key" ON "public"."help_search_suggestions"("query");

-- CreateIndex
CREATE INDEX "help_search_suggestions_frequency_idx" ON "public"."help_search_suggestions"("frequency");

-- CreateIndex
CREATE INDEX "help_search_suggestions_lastUsed_idx" ON "public"."help_search_suggestions"("lastUsed");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_sections_slug_key" ON "public"."documentation_sections"("slug");

-- CreateIndex
CREATE INDEX "documentation_sections_slug_idx" ON "public"."documentation_sections"("slug");

-- CreateIndex
CREATE INDEX "documentation_sections_sortOrder_idx" ON "public"."documentation_sections"("sortOrder");

-- CreateIndex
CREATE INDEX "documentation_sections_isActive_idx" ON "public"."documentation_sections"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_pages_slug_key" ON "public"."documentation_pages"("slug");

-- CreateIndex
CREATE INDEX "documentation_pages_sectionId_idx" ON "public"."documentation_pages"("sectionId");

-- CreateIndex
CREATE INDEX "documentation_pages_slug_idx" ON "public"."documentation_pages"("slug");

-- CreateIndex
CREATE INDEX "documentation_pages_status_idx" ON "public"."documentation_pages"("status");

-- CreateIndex
CREATE INDEX "documentation_pages_isPublic_idx" ON "public"."documentation_pages"("isPublic");

-- CreateIndex
CREATE INDEX "documentation_pages_publishedAt_idx" ON "public"."documentation_pages"("publishedAt");

-- CreateIndex
CREATE INDEX "documentation_pages_sortOrder_idx" ON "public"."documentation_pages"("sortOrder");

-- CreateIndex
CREATE INDEX "documentation_versions_pageId_idx" ON "public"."documentation_versions"("pageId");

-- CreateIndex
CREATE INDEX "documentation_versions_versionNumber_idx" ON "public"."documentation_versions"("versionNumber");

-- CreateIndex
CREATE INDEX "documentation_versions_status_idx" ON "public"."documentation_versions"("status");

-- CreateIndex
CREATE INDEX "documentation_versions_isActive_idx" ON "public"."documentation_versions"("isActive");

-- CreateIndex
CREATE INDEX "documentation_versions_apiVersion_idx" ON "public"."documentation_versions"("apiVersion");

-- CreateIndex
CREATE INDEX "documentation_code_examples_pageId_idx" ON "public"."documentation_code_examples"("pageId");

-- CreateIndex
CREATE INDEX "documentation_code_examples_language_idx" ON "public"."documentation_code_examples"("language");

-- CreateIndex
CREATE INDEX "documentation_code_examples_category_idx" ON "public"."documentation_code_examples"("category");

-- CreateIndex
CREATE INDEX "documentation_code_examples_testStatus_idx" ON "public"."documentation_code_examples"("testStatus");

-- CreateIndex
CREATE INDEX "documentation_code_examples_difficulty_idx" ON "public"."documentation_code_examples"("difficulty");

-- CreateIndex
CREATE INDEX "documentation_analytics_pageId_idx" ON "public"."documentation_analytics"("pageId");

-- CreateIndex
CREATE INDEX "documentation_analytics_date_idx" ON "public"."documentation_analytics"("date");

-- CreateIndex
CREATE INDEX "documentation_analytics_userType_idx" ON "public"."documentation_analytics"("userType");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_analytics_pageId_date_key" ON "public"."documentation_analytics"("pageId", "date");

-- CreateIndex
CREATE INDEX "documentation_comments_pageId_idx" ON "public"."documentation_comments"("pageId");

-- CreateIndex
CREATE INDEX "documentation_comments_authorId_idx" ON "public"."documentation_comments"("authorId");

-- CreateIndex
CREATE INDEX "documentation_comments_status_idx" ON "public"."documentation_comments"("status");

-- CreateIndex
CREATE INDEX "documentation_comments_parentId_idx" ON "public"."documentation_comments"("parentId");

-- CreateIndex
CREATE INDEX "documentation_comments_isResolved_idx" ON "public"."documentation_comments"("isResolved");

-- CreateIndex
CREATE INDEX "documentation_cross_references_fromPageId_idx" ON "public"."documentation_cross_references"("fromPageId");

-- CreateIndex
CREATE INDEX "documentation_cross_references_toPageId_idx" ON "public"."documentation_cross_references"("toPageId");

-- CreateIndex
CREATE INDEX "documentation_cross_references_referenceType_idx" ON "public"."documentation_cross_references"("referenceType");

-- CreateIndex
CREATE INDEX "documentation_cross_references_isActive_idx" ON "public"."documentation_cross_references"("isActive");

-- CreateIndex
CREATE INDEX "documentation_cross_references_isBroken_idx" ON "public"."documentation_cross_references"("isBroken");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_cross_references_fromPageId_toPageId_referenc_key" ON "public"."documentation_cross_references"("fromPageId", "toPageId", "referenceType");

-- CreateIndex
CREATE INDEX "documentation_templates_workspaceId_idx" ON "public"."documentation_templates"("workspaceId");

-- CreateIndex
CREATE INDEX "documentation_templates_category_idx" ON "public"."documentation_templates"("category");

-- CreateIndex
CREATE INDEX "documentation_templates_isActive_idx" ON "public"."documentation_templates"("isActive");

-- CreateIndex
CREATE INDEX "documentation_templates_isOfficial_idx" ON "public"."documentation_templates"("isOfficial");

-- CreateIndex
CREATE INDEX "documentation_templates_difficulty_idx" ON "public"."documentation_templates"("difficulty");

-- CreateIndex
CREATE INDEX "documentation_collaborators_pageId_idx" ON "public"."documentation_collaborators"("pageId");

-- CreateIndex
CREATE INDEX "documentation_collaborators_userId_idx" ON "public"."documentation_collaborators"("userId");

-- CreateIndex
CREATE INDEX "documentation_collaborators_role_idx" ON "public"."documentation_collaborators"("role");

-- CreateIndex
CREATE INDEX "documentation_collaborators_status_idx" ON "public"."documentation_collaborators"("status");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_collaborators_pageId_userId_key" ON "public"."documentation_collaborators"("pageId", "userId");

-- CreateIndex
CREATE INDEX "documentation_revisions_pageId_idx" ON "public"."documentation_revisions"("pageId");

-- CreateIndex
CREATE INDEX "documentation_revisions_authorId_idx" ON "public"."documentation_revisions"("authorId");

-- CreateIndex
CREATE INDEX "documentation_revisions_revisionNumber_idx" ON "public"."documentation_revisions"("revisionNumber");

-- CreateIndex
CREATE INDEX "documentation_revisions_status_idx" ON "public"."documentation_revisions"("status");

-- CreateIndex
CREATE INDEX "documentation_revisions_isPublished_idx" ON "public"."documentation_revisions"("isPublished");

-- CreateIndex
CREATE INDEX "documentation_revisions_needsReview_idx" ON "public"."documentation_revisions"("needsReview");

-- CreateIndex
CREATE INDEX "documentation_workflows_pageId_idx" ON "public"."documentation_workflows"("pageId");

-- CreateIndex
CREATE INDEX "documentation_workflows_workflowType_idx" ON "public"."documentation_workflows"("workflowType");

-- CreateIndex
CREATE INDEX "documentation_workflows_status_idx" ON "public"."documentation_workflows"("status");

-- CreateIndex
CREATE INDEX "documentation_workflows_assignedTo_idx" ON "public"."documentation_workflows"("assignedTo");

-- CreateIndex
CREATE INDEX "documentation_workflows_priority_idx" ON "public"."documentation_workflows"("priority");

-- CreateIndex
CREATE INDEX "documentation_workflows_dueDate_idx" ON "public"."documentation_workflows"("dueDate");

-- CreateIndex
CREATE INDEX "documentation_exports_workspaceId_idx" ON "public"."documentation_exports"("workspaceId");

-- CreateIndex
CREATE INDEX "documentation_exports_requestedBy_idx" ON "public"."documentation_exports"("requestedBy");

-- CreateIndex
CREATE INDEX "documentation_exports_status_idx" ON "public"."documentation_exports"("status");

-- CreateIndex
CREATE INDEX "documentation_exports_exportType_idx" ON "public"."documentation_exports"("exportType");

-- CreateIndex
CREATE INDEX "documentation_exports_createdAt_idx" ON "public"."documentation_exports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_agents_userId_key" ON "public"."support_agents"("userId");

-- CreateIndex
CREATE INDEX "support_agents_isActive_idx" ON "public"."support_agents"("isActive");

-- CreateIndex
CREATE INDEX "support_agents_isOnline_idx" ON "public"."support_agents"("isOnline");

-- CreateIndex
CREATE INDEX "support_agents_department_idx" ON "public"."support_agents"("department");

-- CreateIndex
CREATE INDEX "support_agents_lastSeen_idx" ON "public"."support_agents"("lastSeen");

-- CreateIndex
CREATE INDEX "support_chats_workspaceId_idx" ON "public"."support_chats"("workspaceId");

-- CreateIndex
CREATE INDEX "support_chats_userId_idx" ON "public"."support_chats"("userId");

-- CreateIndex
CREATE INDEX "support_chats_assignedAgentId_idx" ON "public"."support_chats"("assignedAgentId");

-- CreateIndex
CREATE INDEX "support_chats_status_idx" ON "public"."support_chats"("status");

-- CreateIndex
CREATE INDEX "support_chats_priority_idx" ON "public"."support_chats"("priority");

-- CreateIndex
CREATE INDEX "support_chats_department_idx" ON "public"."support_chats"("department");

-- CreateIndex
CREATE INDEX "support_chats_createdAt_idx" ON "public"."support_chats"("createdAt");

-- CreateIndex
CREATE INDEX "support_messages_chatId_idx" ON "public"."support_messages"("chatId");

-- CreateIndex
CREATE INDEX "support_messages_senderId_idx" ON "public"."support_messages"("senderId");

-- CreateIndex
CREATE INDEX "support_messages_senderType_idx" ON "public"."support_messages"("senderType");

-- CreateIndex
CREATE INDEX "support_messages_createdAt_idx" ON "public"."support_messages"("createdAt");

-- CreateIndex
CREATE INDEX "support_messages_messageType_idx" ON "public"."support_messages"("messageType");

-- CreateIndex
CREATE INDEX "support_contact_forms_workspaceId_idx" ON "public"."support_contact_forms"("workspaceId");

-- CreateIndex
CREATE INDEX "support_contact_forms_userId_idx" ON "public"."support_contact_forms"("userId");

-- CreateIndex
CREATE INDEX "support_contact_forms_status_idx" ON "public"."support_contact_forms"("status");

-- CreateIndex
CREATE INDEX "support_contact_forms_department_idx" ON "public"."support_contact_forms"("department");

-- CreateIndex
CREATE INDEX "support_contact_forms_createdAt_idx" ON "public"."support_contact_forms"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "public"."support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_workspaceId_idx" ON "public"."support_tickets"("workspaceId");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "public"."support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_assignedAgentId_idx" ON "public"."support_tickets"("assignedAgentId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "public"."support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "public"."support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "public"."support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_type_idx" ON "public"."support_tickets"("type");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "public"."support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_ticketNumber_idx" ON "public"."support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "ticket_updates_ticketId_idx" ON "public"."ticket_updates"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_updates_authorId_idx" ON "public"."ticket_updates"("authorId");

-- CreateIndex
CREATE INDEX "ticket_updates_updateType_idx" ON "public"."ticket_updates"("updateType");

-- CreateIndex
CREATE INDEX "ticket_updates_createdAt_idx" ON "public"."ticket_updates"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticketId_idx" ON "public"."ticket_attachments"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_attachments_uploadedBy_idx" ON "public"."ticket_attachments"("uploadedBy");

-- CreateIndex
CREATE INDEX "ticket_attachments_createdAt_idx" ON "public"."ticket_attachments"("createdAt");

-- CreateIndex
CREATE INDEX "support_ticket_assignments_ticketId_idx" ON "public"."support_ticket_assignments"("ticketId");

-- CreateIndex
CREATE INDEX "support_ticket_assignments_agentId_idx" ON "public"."support_ticket_assignments"("agentId");

-- CreateIndex
CREATE INDEX "support_ticket_assignments_assignedAt_idx" ON "public"."support_ticket_assignments"("assignedAt");

-- CreateIndex
CREATE INDEX "support_ticket_notes_ticketId_idx" ON "public"."support_ticket_notes"("ticketId");

-- CreateIndex
CREATE INDEX "support_ticket_notes_agentId_idx" ON "public"."support_ticket_notes"("agentId");

-- CreateIndex
CREATE INDEX "support_ticket_notes_createdAt_idx" ON "public"."support_ticket_notes"("createdAt");

-- CreateIndex
CREATE INDEX "community_forum_posts_workspaceId_idx" ON "public"."community_forum_posts"("workspaceId");

-- CreateIndex
CREATE INDEX "community_forum_posts_userId_idx" ON "public"."community_forum_posts"("userId");

-- CreateIndex
CREATE INDEX "community_forum_posts_category_idx" ON "public"."community_forum_posts"("category");

-- CreateIndex
CREATE INDEX "community_forum_posts_isApproved_idx" ON "public"."community_forum_posts"("isApproved");

-- CreateIndex
CREATE INDEX "community_forum_posts_lastActivity_idx" ON "public"."community_forum_posts"("lastActivity");

-- CreateIndex
CREATE INDEX "community_forum_posts_views_idx" ON "public"."community_forum_posts"("views");

-- CreateIndex
CREATE INDEX "community_forum_replies_postId_idx" ON "public"."community_forum_replies"("postId");

-- CreateIndex
CREATE INDEX "community_forum_replies_userId_idx" ON "public"."community_forum_replies"("userId");

-- CreateIndex
CREATE INDEX "community_forum_replies_isAccepted_idx" ON "public"."community_forum_replies"("isAccepted");

-- CreateIndex
CREATE INDEX "community_forum_replies_createdAt_idx" ON "public"."community_forum_replies"("createdAt");

-- CreateIndex
CREATE INDEX "community_forum_votes_postId_idx" ON "public"."community_forum_votes"("postId");

-- CreateIndex
CREATE INDEX "community_forum_votes_replyId_idx" ON "public"."community_forum_votes"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "community_forum_votes_userId_postId_key" ON "public"."community_forum_votes"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "community_forum_votes_userId_replyId_key" ON "public"."community_forum_votes"("userId", "replyId");

-- CreateIndex
CREATE UNIQUE INDEX "community_forum_votes_guestIdentifier_postId_key" ON "public"."community_forum_votes"("guestIdentifier", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "community_forum_votes_guestIdentifier_replyId_key" ON "public"."community_forum_votes"("guestIdentifier", "replyId");

-- CreateIndex
CREATE INDEX "feature_requests_workspaceId_idx" ON "public"."feature_requests"("workspaceId");

-- CreateIndex
CREATE INDEX "feature_requests_userId_idx" ON "public"."feature_requests"("userId");

-- CreateIndex
CREATE INDEX "feature_requests_status_idx" ON "public"."feature_requests"("status");

-- CreateIndex
CREATE INDEX "feature_requests_category_idx" ON "public"."feature_requests"("category");

-- CreateIndex
CREATE INDEX "feature_requests_votes_idx" ON "public"."feature_requests"("votes");

-- CreateIndex
CREATE INDEX "feature_requests_createdAt_idx" ON "public"."feature_requests"("createdAt");

-- CreateIndex
CREATE INDEX "feature_request_votes_requestId_idx" ON "public"."feature_request_votes"("requestId");

-- CreateIndex
CREATE INDEX "feature_request_votes_userId_idx" ON "public"."feature_request_votes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_request_votes_requestId_userId_key" ON "public"."feature_request_votes"("requestId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_request_votes_requestId_guestIdentifier_key" ON "public"."feature_request_votes"("requestId", "guestIdentifier");

-- CreateIndex
CREATE INDEX "feature_request_comments_requestId_idx" ON "public"."feature_request_comments"("requestId");

-- CreateIndex
CREATE INDEX "feature_request_comments_userId_idx" ON "public"."feature_request_comments"("userId");

-- CreateIndex
CREATE INDEX "feature_request_comments_isInternal_idx" ON "public"."feature_request_comments"("isInternal");

-- CreateIndex
CREATE UNIQUE INDEX "discord_integrations_workspaceId_key" ON "public"."discord_integrations"("workspaceId");

-- CreateIndex
CREATE INDEX "discord_integrations_workspaceId_idx" ON "public"."discord_integrations"("workspaceId");

-- CreateIndex
CREATE INDEX "discord_integrations_guildId_idx" ON "public"."discord_integrations"("guildId");

-- CreateIndex
CREATE INDEX "community_activities_workspaceId_idx" ON "public"."community_activities"("workspaceId");

-- CreateIndex
CREATE INDEX "community_activities_activityType_idx" ON "public"."community_activities"("activityType");

-- CreateIndex
CREATE INDEX "community_activities_createdAt_idx" ON "public"."community_activities"("createdAt");

-- CreateIndex
CREATE INDEX "community_activities_targetType_idx" ON "public"."community_activities"("targetType");

-- CreateIndex
CREATE INDEX "help_article_revisions_articleId_idx" ON "public"."help_article_revisions"("articleId");

-- CreateIndex
CREATE INDEX "help_article_revisions_createdAt_idx" ON "public"."help_article_revisions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_revisions_articleId_version_key" ON "public"."help_article_revisions"("articleId", "version");

-- CreateIndex
CREATE INDEX "help_article_workflows_articleId_idx" ON "public"."help_article_workflows"("articleId");

-- CreateIndex
CREATE INDEX "help_article_workflows_status_idx" ON "public"."help_article_workflows"("status");

-- CreateIndex
CREATE INDEX "help_article_workflows_requestedById_idx" ON "public"."help_article_workflows"("requestedById");

-- CreateIndex
CREATE INDEX "help_article_workflows_assignedToId_idx" ON "public"."help_article_workflows"("assignedToId");

-- CreateIndex
CREATE INDEX "help_article_workflows_createdAt_idx" ON "public"."help_article_workflows"("createdAt");

-- CreateIndex
CREATE INDEX "help_article_media_articleId_idx" ON "public"."help_article_media"("articleId");

-- CreateIndex
CREATE INDEX "help_article_media_sortOrder_idx" ON "public"."help_article_media"("sortOrder");

-- CreateIndex
CREATE INDEX "help_article_templates_category_idx" ON "public"."help_article_templates"("category");

-- CreateIndex
CREATE INDEX "help_article_templates_isActive_idx" ON "public"."help_article_templates"("isActive");

-- CreateIndex
CREATE INDEX "help_article_templates_authorId_idx" ON "public"."help_article_templates"("authorId");

-- CreateIndex
CREATE INDEX "help_article_analytics_articleId_idx" ON "public"."help_article_analytics"("articleId");

-- CreateIndex
CREATE INDEX "help_article_analytics_eventType_idx" ON "public"."help_article_analytics"("eventType");

-- CreateIndex
CREATE INDEX "help_article_analytics_timestamp_idx" ON "public"."help_article_analytics"("timestamp");

-- CreateIndex
CREATE INDEX "help_article_relations_fromArticleId_idx" ON "public"."help_article_relations"("fromArticleId");

-- CreateIndex
CREATE INDEX "help_article_relations_toArticleId_idx" ON "public"."help_article_relations"("toArticleId");

-- CreateIndex
CREATE INDEX "help_article_relations_relationType_idx" ON "public"."help_article_relations"("relationType");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_relations_fromArticleId_toArticleId_key" ON "public"."help_article_relations"("fromArticleId", "toArticleId");

-- CreateIndex
CREATE INDEX "help_category_analytics_categoryId_idx" ON "public"."help_category_analytics"("categoryId");

-- CreateIndex
CREATE INDEX "help_category_analytics_date_idx" ON "public"."help_category_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "help_category_analytics_categoryId_date_key" ON "public"."help_category_analytics"("categoryId", "date");

-- CreateIndex
CREATE INDEX "moderation_actions_workspaceId_idx" ON "public"."moderation_actions"("workspaceId");

-- CreateIndex
CREATE INDEX "moderation_actions_targetType_targetId_idx" ON "public"."moderation_actions"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "moderation_actions_actionType_idx" ON "public"."moderation_actions"("actionType");

-- CreateIndex
CREATE INDEX "moderation_actions_status_idx" ON "public"."moderation_actions"("status");

-- CreateIndex
CREATE INDEX "moderation_actions_createdAt_idx" ON "public"."moderation_actions"("createdAt");

-- CreateIndex
CREATE INDEX "user_moderation_history_workspaceId_idx" ON "public"."user_moderation_history"("workspaceId");

-- CreateIndex
CREATE INDEX "user_moderation_history_userId_idx" ON "public"."user_moderation_history"("userId");

-- CreateIndex
CREATE INDEX "user_moderation_history_actionType_idx" ON "public"."user_moderation_history"("actionType");

-- CreateIndex
CREATE INDEX "user_moderation_history_isActive_idx" ON "public"."user_moderation_history"("isActive");

-- CreateIndex
CREATE INDEX "user_moderation_history_endDate_idx" ON "public"."user_moderation_history"("endDate");

-- CreateIndex
CREATE INDEX "content_reports_workspaceId_idx" ON "public"."content_reports"("workspaceId");

-- CreateIndex
CREATE INDEX "content_reports_contentType_contentId_idx" ON "public"."content_reports"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "public"."content_reports"("status");

-- CreateIndex
CREATE INDEX "content_reports_priority_idx" ON "public"."content_reports"("priority");

-- CreateIndex
CREATE INDEX "content_reports_reportReason_idx" ON "public"."content_reports"("reportReason");

-- CreateIndex
CREATE INDEX "content_reports_createdAt_idx" ON "public"."content_reports"("createdAt");

-- CreateIndex
CREATE INDEX "auto_moderation_rules_workspaceId_idx" ON "public"."auto_moderation_rules"("workspaceId");

-- CreateIndex
CREATE INDEX "auto_moderation_rules_isActive_idx" ON "public"."auto_moderation_rules"("isActive");

-- CreateIndex
CREATE INDEX "auto_moderation_rules_triggerType_idx" ON "public"."auto_moderation_rules"("triggerType");

-- CreateIndex
CREATE INDEX "spam_detections_workspaceId_idx" ON "public"."spam_detections"("workspaceId");

-- CreateIndex
CREATE INDEX "spam_detections_contentType_contentId_idx" ON "public"."spam_detections"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "spam_detections_isSpam_idx" ON "public"."spam_detections"("isSpam");

-- CreateIndex
CREATE INDEX "spam_detections_confidenceScore_idx" ON "public"."spam_detections"("confidenceScore");

-- CreateIndex
CREATE INDEX "spam_detections_spamType_idx" ON "public"."spam_detections"("spamType");

-- CreateIndex
CREATE INDEX "moderation_queue_workspaceId_idx" ON "public"."moderation_queue"("workspaceId");

-- CreateIndex
CREATE INDEX "moderation_queue_status_idx" ON "public"."moderation_queue"("status");

-- CreateIndex
CREATE INDEX "moderation_queue_priority_idx" ON "public"."moderation_queue"("priority");

-- CreateIndex
CREATE INDEX "moderation_queue_dueDate_idx" ON "public"."moderation_queue"("dueDate");

-- CreateIndex
CREATE INDEX "moderation_queue_assignedTo_idx" ON "public"."moderation_queue"("assignedTo");

-- CreateIndex
CREATE INDEX "community_analytics_workspaceId_idx" ON "public"."community_analytics"("workspaceId");

-- CreateIndex
CREATE INDEX "community_analytics_date_idx" ON "public"."community_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "community_analytics_workspaceId_date_key" ON "public"."community_analytics"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "user_activities_userId_timestamp_idx" ON "public"."user_activities"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "user_activities_workspaceId_timestamp_idx" ON "public"."user_activities"("workspaceId", "timestamp");

-- CreateIndex
CREATE INDEX "user_activities_action_timestamp_idx" ON "public"."user_activities"("action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "public"."audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_timestamp_idx" ON "public"."audit_logs"("workspaceId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "public"."audit_logs"("action", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "system_configurations_workspaceId_category_key_key" ON "public"."system_configurations"("workspaceId", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_workspaceId_slug_key" ON "public"."email_templates"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_workspaceId_provider_name_key" ON "public"."integration_settings"("workspaceId", "provider", "name");

-- CreateIndex
CREATE UNIQUE INDEX "branding_configurations_workspaceId_key" ON "public"."branding_configurations"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_configurations_workspaceId_category_eventType_key" ON "public"."notification_configurations"("workspaceId", "category", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "security_configurations_workspaceId_category_setting_key" ON "public"."security_configurations"("workspaceId", "category", "setting");

-- CreateIndex
CREATE UNIQUE INDEX "performance_configurations_workspaceId_category_setting_key" ON "public"."performance_configurations"("workspaceId", "category", "setting");

-- CreateIndex
CREATE UNIQUE INDEX "backup_configurations_workspaceId_name_key" ON "public"."backup_configurations"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "system_health_metrics_workspaceId_category_metric_collected_idx" ON "public"."system_health_metrics"("workspaceId", "category", "metric", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_workspaceId_key_key" ON "public"."feature_flags"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "feature_flag_evaluations_flagId_evaluatedAt_idx" ON "public"."feature_flag_evaluations"("flagId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "feature_flag_evaluations_userId_evaluatedAt_idx" ON "public"."feature_flag_evaluations"("userId", "evaluatedAt");

-- AddForeignKey
ALTER TABLE "public"."team_invitations" ADD CONSTRAINT "team_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_invitations" ADD CONSTRAINT "team_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaign_reports" ADD CONSTRAINT "campaign_reports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_reports" ADD CONSTRAINT "client_reports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_reports" ADD CONSTRAINT "client_reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_reports" ADD CONSTRAINT "client_reports_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."client_report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_report_templates" ADD CONSTRAINT "client_report_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_report_schedules" ADD CONSTRAINT "client_report_schedules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_report_schedules" ADD CONSTRAINT "client_report_schedules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_report_schedules" ADD CONSTRAINT "client_report_schedules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."client_report_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."budget_settings" ADD CONSTRAINT "budget_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_branding" ADD CONSTRAINT "client_branding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_branding" ADD CONSTRAINT "client_branding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."landing_page_config" ADD CONSTRAINT "landing_page_config_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_credentials" ADD CONSTRAINT "platform_credentials_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_articles" ADD CONSTRAINT "help_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_articles" ADD CONSTRAINT "help_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_comments" ADD CONSTRAINT "help_article_comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_comments" ADD CONSTRAINT "help_article_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_bookmarks" ADD CONSTRAINT "help_article_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_bookmarks" ADD CONSTRAINT "help_article_bookmarks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_faqs" ADD CONSTRAINT "help_faqs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_tutorials" ADD CONSTRAINT "video_tutorials_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_playlists" ADD CONSTRAINT "video_playlists_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_playlist_items" ADD CONSTRAINT "video_playlist_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "public"."video_playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_playlist_items" ADD CONSTRAINT "video_playlist_items_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."video_tutorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_user_progress" ADD CONSTRAINT "video_user_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_user_progress" ADD CONSTRAINT "video_user_progress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "public"."video_tutorials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_search_queries" ADD CONSTRAINT "help_search_queries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_pages" ADD CONSTRAINT "documentation_pages_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."documentation_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_pages" ADD CONSTRAINT "documentation_pages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_versions" ADD CONSTRAINT "documentation_versions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_versions" ADD CONSTRAINT "documentation_versions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_code_examples" ADD CONSTRAINT "documentation_code_examples_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_code_examples" ADD CONSTRAINT "documentation_code_examples_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_analytics" ADD CONSTRAINT "documentation_analytics_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_comments" ADD CONSTRAINT "documentation_comments_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_comments" ADD CONSTRAINT "documentation_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_comments" ADD CONSTRAINT "documentation_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."documentation_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_comments" ADD CONSTRAINT "documentation_comments_moderatedBy_fkey" FOREIGN KEY ("moderatedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_comments" ADD CONSTRAINT "documentation_comments_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_cross_references" ADD CONSTRAINT "documentation_cross_references_fromPageId_fkey" FOREIGN KEY ("fromPageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_cross_references" ADD CONSTRAINT "documentation_cross_references_toPageId_fkey" FOREIGN KEY ("toPageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_cross_references" ADD CONSTRAINT "documentation_cross_references_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_templates" ADD CONSTRAINT "documentation_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_templates" ADD CONSTRAINT "documentation_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_collaborators" ADD CONSTRAINT "documentation_collaborators_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_collaborators" ADD CONSTRAINT "documentation_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_collaborators" ADD CONSTRAINT "documentation_collaborators_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_revisions" ADD CONSTRAINT "documentation_revisions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_revisions" ADD CONSTRAINT "documentation_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_revisions" ADD CONSTRAINT "documentation_revisions_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_workflows" ADD CONSTRAINT "documentation_workflows_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."documentation_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_workflows" ADD CONSTRAINT "documentation_workflows_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_workflows" ADD CONSTRAINT "documentation_workflows_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_workflows" ADD CONSTRAINT "documentation_workflows_escalatedTo_fkey" FOREIGN KEY ("escalatedTo") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_exports" ADD CONSTRAINT "documentation_exports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documentation_exports" ADD CONSTRAINT "documentation_exports_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_agents" ADD CONSTRAINT "support_agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_chats" ADD CONSTRAINT "support_chats_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_chats" ADD CONSTRAINT "support_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_chats" ADD CONSTRAINT "support_chats_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "public"."support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_messages" ADD CONSTRAINT "support_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."support_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_messages" ADD CONSTRAINT "support_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_contact_forms" ADD CONSTRAINT "support_contact_forms_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_contact_forms" ADD CONSTRAINT "support_contact_forms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_contact_forms" ADD CONSTRAINT "support_contact_forms_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "public"."support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "public"."support_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_updates" ADD CONSTRAINT "ticket_updates_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."support_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_notes" ADD CONSTRAINT "support_ticket_notes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."support_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_posts" ADD CONSTRAINT "community_forum_posts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_posts" ADD CONSTRAINT "community_forum_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_replies" ADD CONSTRAINT "community_forum_replies_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."community_forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_replies" ADD CONSTRAINT "community_forum_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_votes" ADD CONSTRAINT "community_forum_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_votes" ADD CONSTRAINT "community_forum_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."community_forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_forum_votes" ADD CONSTRAINT "community_forum_votes_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "public"."community_forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_requests" ADD CONSTRAINT "feature_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_requests" ADD CONSTRAINT "feature_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_request_votes" ADD CONSTRAINT "feature_request_votes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_request_votes" ADD CONSTRAINT "feature_request_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_request_comments" ADD CONSTRAINT "feature_request_comments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."feature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_request_comments" ADD CONSTRAINT "feature_request_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discord_integrations" ADD CONSTRAINT "discord_integrations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_activities" ADD CONSTRAINT "community_activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_activities" ADD CONSTRAINT "community_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_revisions" ADD CONSTRAINT "help_article_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_revisions" ADD CONSTRAINT "help_article_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_workflows" ADD CONSTRAINT "help_article_workflows_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_workflows" ADD CONSTRAINT "help_article_workflows_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_workflows" ADD CONSTRAINT "help_article_workflows_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_workflows" ADD CONSTRAINT "help_article_workflows_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_media" ADD CONSTRAINT "help_article_media_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_templates" ADD CONSTRAINT "help_article_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_analytics" ADD CONSTRAINT "help_article_analytics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_relations" ADD CONSTRAINT "help_article_relations_fromArticleId_fkey" FOREIGN KEY ("fromArticleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_article_relations" ADD CONSTRAINT "help_article_relations_toArticleId_fkey" FOREIGN KEY ("toArticleId") REFERENCES "public"."help_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."help_category_analytics" ADD CONSTRAINT "help_category_analytics_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."help_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_actions" ADD CONSTRAINT "moderation_actions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_actions" ADD CONSTRAINT "moderation_actions_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_actions" ADD CONSTRAINT "moderation_actions_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_actions" ADD CONSTRAINT "moderation_actions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."auto_moderation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_moderation_history" ADD CONSTRAINT "user_moderation_history_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_moderation_history" ADD CONSTRAINT "user_moderation_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_moderation_history" ADD CONSTRAINT "user_moderation_history_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_moderation_history" ADD CONSTRAINT "user_moderation_history_appealResolvedBy_fkey" FOREIGN KEY ("appealResolvedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auto_moderation_rules" ADD CONSTRAINT "auto_moderation_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auto_moderation_rules" ADD CONSTRAINT "auto_moderation_rules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."spam_detections" ADD CONSTRAINT "spam_detections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_queue" ADD CONSTRAINT "moderation_queue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_queue" ADD CONSTRAINT "moderation_queue_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_queue" ADD CONSTRAINT "moderation_queue_escalatedBy_fkey" FOREIGN KEY ("escalatedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_analytics" ADD CONSTRAINT "community_analytics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_activities" ADD CONSTRAINT "user_activities_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_activities" ADD CONSTRAINT "user_activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_configurations" ADD CONSTRAINT "system_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_configurations" ADD CONSTRAINT "system_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."integration_settings" ADD CONSTRAINT "integration_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."integration_settings" ADD CONSTRAINT "integration_settings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."integration_settings" ADD CONSTRAINT "integration_settings_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branding_configurations" ADD CONSTRAINT "branding_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branding_configurations" ADD CONSTRAINT "branding_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_configurations" ADD CONSTRAINT "notification_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_configurations" ADD CONSTRAINT "notification_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_configurations" ADD CONSTRAINT "security_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."security_configurations" ADD CONSTRAINT "security_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."performance_configurations" ADD CONSTRAINT "performance_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."performance_configurations" ADD CONSTRAINT "performance_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_configurations" ADD CONSTRAINT "backup_configurations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_configurations" ADD CONSTRAINT "backup_configurations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_configurations" ADD CONSTRAINT "backup_configurations_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_records" ADD CONSTRAINT "backup_records_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "public"."backup_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_records" ADD CONSTRAINT "backup_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."backup_records" ADD CONSTRAINT "backup_records_restoredBy_fkey" FOREIGN KEY ("restoredBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_health_metrics" ADD CONSTRAINT "system_health_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flags" ADD CONSTRAINT "feature_flags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flags" ADD CONSTRAINT "feature_flags_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flags" ADD CONSTRAINT "feature_flags_lastUpdatedBy_fkey" FOREIGN KEY ("lastUpdatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_evaluations" ADD CONSTRAINT "feature_flag_evaluations_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_evaluations" ADD CONSTRAINT "feature_flag_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_evaluations" ADD CONSTRAINT "feature_flag_evaluations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

