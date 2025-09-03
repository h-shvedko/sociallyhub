-- CreateEnum
CREATE TYPE "public"."WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'PUBLISHER', 'ANALYST', 'CLIENT_VIEWER');

-- CreateEnum
CREATE TYPE "public"."SocialProvider" AS ENUM ('TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "public"."SocialAccountStatus" AS ENUM ('ACTIVE', 'TOKEN_EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."PostStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CHANGES_REQUESTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."VariantStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."InboxItemType" AS ENUM ('COMMENT', 'MENTION', 'DIRECT_MESSAGE', 'REVIEW', 'REPLY');

-- CreateEnum
CREATE TYPE "public"."InboxStatus" AS ENUM ('OPEN', 'ASSIGNED', 'SNOOZED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."TemplateType" AS ENUM ('POST', 'RESPONSE');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_DENIED', 'PUBLISH_SUCCESS', 'PUBLISH_FAILED', 'TOKEN_EXPIRING', 'TOKEN_EXPIRED', 'INBOX_ASSIGNMENT', 'SLA_BREACH', 'REPORT_READY');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."AISuggestionType" AS ENUM ('HASHTAGS', 'CAPTION', 'TONE_ADJUSTMENT', 'OPTIMIZATION', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "public"."AIFeatureType" AS ENUM ('CONTENT_GENERATION', 'HASHTAG_SUGGESTION', 'TONE_ANALYSIS', 'PERFORMANCE_PREDICTION', 'IMAGE_ANALYSIS', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "public"."AIProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'AZURE');

-- CreateEnum
CREATE TYPE "public"."ContentTone" AS ENUM ('PROFESSIONAL', 'CASUAL', 'HUMOROUS', 'INSPIRATIONAL', 'EDUCATIONAL', 'PROMOTIONAL', 'CONVERSATIONAL', 'FORMAL');

-- CreateEnum
CREATE TYPE "public"."SentimentSource" AS ENUM ('COMMENT', 'MENTION', 'DIRECT_MESSAGE', 'REVIEW', 'SHARE', 'REPLY');

-- CreateEnum
CREATE TYPE "public"."CrisisType" AS ENUM ('SENTIMENT_SPIKE', 'VOLUME_SURGE', 'NEGATIVE_TREND', 'BRAND_ATTACK', 'PR_CRISIS', 'VIRAL_NEGATIVE');

-- CreateEnum
CREATE TYPE "public"."AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "public"."SegmentType" AS ENUM ('BEHAVIORAL', 'DEMOGRAPHIC', 'PSYCHOGRAPHIC', 'PLATFORM', 'ENGAGEMENT', 'LIFECYCLE');

-- CreateEnum
CREATE TYPE "public"."RecommendationType" AS ENUM ('CONTENT_TOPIC', 'CONTENT_FORMAT', 'POSTING_TIME', 'HASHTAG', 'TONE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "public"."RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'TESTING');

-- CreateEnum
CREATE TYPE "public"."EngagementPatternType" AS ENUM ('SEASONAL', 'WEEKLY', 'DAILY', 'EVENT_BASED', 'CONTENT_TYPE', 'PLATFORM_SPECIFIC', 'DEMOGRAPHIC');

-- CreateEnum
CREATE TYPE "public"."TrendSource" AS ENUM ('NEWS', 'SOCIAL', 'VIRAL', 'COMPETITOR', 'INDUSTRY', 'HASHTAG');

-- CreateEnum
CREATE TYPE "public"."TrendStatus" AS ENUM ('ACTIVE', 'DECLINING', 'EXPIRED', 'USED');

-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL', 'STORY', 'REEL', 'POLL', 'LIVE', 'THREAD');

-- CreateEnum
CREATE TYPE "public"."SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ResponseSource" AS ENUM ('COMMENT', 'DM', 'MENTION', 'REVIEW', 'CHAT');

-- CreateEnum
CREATE TYPE "public"."ResponseType" AS ENUM ('ANSWER', 'ACKNOWLEDGE', 'ESCALATE', 'CUSTOM', 'AUTO_RESOLVE');

-- CreateEnum
CREATE TYPE "public"."ResponseTone" AS ENUM ('FRIENDLY', 'PROFESSIONAL', 'CASUAL', 'EMPATHETIC', 'FORMAL', 'HUMOROUS');

-- CreateEnum
CREATE TYPE "public"."ResponseUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."AutomationType" AS ENUM ('CONTENT_SUGGESTION', 'SMART_RESPONSE', 'CRISIS_MANAGEMENT', 'ENGAGEMENT_FOLLOW_UP', 'SCHEDULING_OPTIMIZATION', 'TREND_MONITORING', 'COMPETITOR_TRACKING');

-- CreateEnum
CREATE TYPE "public"."ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'RETRY');

-- CreateEnum
CREATE TYPE "public"."OptimizationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ABTestStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ABTestType" AS ENUM ('CONTENT', 'TIMING', 'HASHTAGS', 'VISUAL', 'AUDIENCE', 'HYBRID');

-- CreateTable
CREATE TABLE "public"."workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "branding" JSONB,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "supportedLocales" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT DEFAULT 'UTC',
    "locale" TEXT DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_workspaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "public"."WorkspaceRole" NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clients" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_accounts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "provider" "public"."SocialProvider" NOT NULL,
    "accountType" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "public"."SocialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT,
    "baseContent" TEXT,
    "link" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "campaignId" TEXT,
    "tags" TEXT[],
    "status" "public"."PostStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "approverId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_variants" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "text" TEXT,
    "hashtags" TEXT[],
    "platformData" JSONB,
    "status" "public"."VariantStatus" NOT NULL DEFAULT 'PENDING',
    "providerPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_assets" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "post_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "metadata" JSONB,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" TEXT[],
    "platforms" "public"."SocialProvider"[] DEFAULT ARRAY[]::"public"."SocialProvider"[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" "public"."TemplateType" NOT NULL DEFAULT 'POST',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "objectives" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inbox_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "type" "public"."InboxItemType" NOT NULL,
    "providerThreadId" TEXT,
    "providerItemId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "authorHandle" TEXT,
    "authorAvatar" TEXT,
    "sentiment" TEXT,
    "status" "public"."InboxStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "tags" TEXT[],
    "internalNotes" TEXT,
    "slaBreachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "threadData" JSONB,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_metrics" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT NOT NULL,
    "socialAccountId" TEXT,
    "postId" TEXT,
    "date" DATE NOT NULL,
    "hour" INTEGER,
    "platform" "public"."SocialProvider",
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "userAgent" TEXT,
    "ip" TEXT,
    "pages" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "details" JSONB,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."ai_content_suggestions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalContent" TEXT,
    "suggestedContent" TEXT NOT NULL,
    "suggestionType" "public"."AISuggestionType" NOT NULL,
    "platform" "public"."SocialProvider",
    "confidenceScore" DOUBLE PRECISION,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT,

    CONSTRAINT "ai_content_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_performance_predictions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "predictedEngagementRate" DOUBLE PRECISION,
    "predictedReach" INTEGER,
    "predictedImpressions" INTEGER,
    "predictedLikes" INTEGER,
    "predictedComments" INTEGER,
    "predictedShares" INTEGER,
    "confidenceScore" DOUBLE PRECISION,
    "actualEngagementRate" DOUBLE PRECISION,
    "actualReach" INTEGER,
    "actualImpressions" INTEGER,
    "actualLikes" INTEGER,
    "actualComments" INTEGER,
    "actualShares" INTEGER,
    "predictionAccuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_performance_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage_tracking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureType" "public"."AIFeatureType" NOT NULL,
    "tokensUsed" INTEGER,
    "costCents" INTEGER,
    "responseTimeMs" INTEGER,
    "model" TEXT,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_model_versions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" "public"."AIProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configuration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."hashtag_suggestions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hashtag" TEXT NOT NULL,
    "platform" "public"."SocialProvider" NOT NULL,
    "trendingScore" DOUBLE PRECISION,
    "performanceScore" DOUBLE PRECISION,
    "category" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtag_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_tone_analysis" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tone" "public"."ContentTone" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sentiment" DOUBLE PRECISION,
    "formality" DOUBLE PRECISION,
    "energy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_tone_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."image_analysis" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "dominantColors" JSONB NOT NULL,
    "colorPalette" JSONB NOT NULL,
    "labels" JSONB NOT NULL,
    "faces" JSONB NOT NULL,
    "text" JSONB NOT NULL,
    "safeSearch" JSONB NOT NULL,
    "landmarks" JSONB NOT NULL,
    "brandScore" DOUBLE PRECISION,
    "logoDetected" BOOLEAN NOT NULL DEFAULT false,
    "brandColors" JSONB,
    "fontAnalysis" JSONB,
    "aestheticScore" DOUBLE PRECISION,
    "compositonScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."image_optimizations" (
    "id" TEXT NOT NULL,
    "originalAssetId" TEXT NOT NULL,
    "optimizedAssetId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "platform" "public"."SocialProvider" NOT NULL,
    "targetWidth" INTEGER,
    "targetHeight" INTEGER,
    "compressionLevel" DOUBLE PRECISION,
    "format" TEXT,
    "cropped" BOOLEAN NOT NULL DEFAULT false,
    "resized" BOOLEAN NOT NULL DEFAULT false,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "textOverlay" BOOLEAN NOT NULL DEFAULT false,
    "sizeBefore" INTEGER NOT NULL,
    "sizeAfter" INTEGER,
    "qualityScore" DOUBLE PRECISION,
    "loadTimeImprovement" DOUBLE PRECISION,
    "engagementPredict" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_optimizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visual_performance_metrics" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "postId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "platform" "public"."SocialProvider",
    "viewDuration" DOUBLE PRECISION,
    "clickThroughRate" DOUBLE PRECISION,
    "saveRate" DOUBLE PRECISION,
    "shareRate" DOUBLE PRECISION,
    "likesPerView" DOUBLE PRECISION,
    "commentsPerView" DOUBLE PRECISION,
    "engagementRate" DOUBLE PRECISION,
    "colorScore" DOUBLE PRECISION,
    "compositionScore" DOUBLE PRECISION,
    "contrastScore" DOUBLE PRECISION,
    "testVariant" TEXT,
    "testGroup" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."brand_visual_guidelines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColors" JSONB NOT NULL,
    "secondaryColors" JSONB NOT NULL,
    "accentColors" JSONB NOT NULL,
    "primaryFonts" JSONB NOT NULL,
    "secondaryFonts" JSONB NOT NULL,
    "fontSizes" JSONB NOT NULL,
    "logoVariants" JSONB NOT NULL,
    "logoMinSize" JSONB NOT NULL,
    "logoClearSpace" JSONB NOT NULL,
    "filterSettings" JSONB,
    "overlayStyles" JSONB,
    "compositionRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visual_guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."visual_trends" (
    "id" TEXT NOT NULL,
    "platform" "public"."SocialProvider" NOT NULL,
    "category" TEXT NOT NULL,
    "trendName" TEXT NOT NULL,
    "description" TEXT,
    "popularity" DOUBLE PRECISION NOT NULL,
    "growthRate" DOUBLE PRECISION,
    "peakDate" TIMESTAMP(3),
    "characteristics" JSONB NOT NULL,
    "examples" JSONB,
    "regions" JSONB,
    "demographics" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."image_ab_tests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "description" TEXT,
    "platform" "public"."SocialProvider",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "public"."ABTestStatus" NOT NULL DEFAULT 'RUNNING',
    "controlAssetId" TEXT NOT NULL,
    "variantAssetIds" JSONB NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "controlViews" INTEGER NOT NULL DEFAULT 0,
    "controlEngagement" DOUBLE PRECISION,
    "winningVariant" TEXT,
    "confidenceLevel" DOUBLE PRECISION,
    "insights" JSONB,
    "recommendations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_ab_tests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "description" TEXT,
    "testType" "public"."ABTestType" NOT NULL DEFAULT 'CONTENT',
    "platform" "public"."SocialProvider",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "public"."ABTestStatus" NOT NULL DEFAULT 'DRAFT',
    "sampleSize" INTEGER,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "controlTitle" TEXT,
    "controlContent" TEXT NOT NULL,
    "controlHashtags" TEXT[],
    "controlMediaIds" TEXT[],
    "variants" JSONB NOT NULL,
    "trafficSplit" JSONB NOT NULL,
    "testDuration" INTEGER,
    "autoOptimize" BOOLEAN NOT NULL DEFAULT false,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "controlMetrics" JSONB,
    "variantMetrics" JSONB,
    "winningVariant" TEXT,
    "statisticalSignificance" DOUBLE PRECISION,
    "liftPercentage" DOUBLE PRECISION,
    "aiRecommendations" JSONB,
    "nextTestSuggestions" JSONB,
    "audienceSegments" JSONB,
    "optimizationInsights" JSONB,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ab_test_executions" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "engaged" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "engagementScore" DOUBLE PRECISION,
    "timeSpent" INTEGER,
    "interactions" JSONB,
    "platform" "public"."SocialProvider",
    "deviceType" TEXT,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sentiment_analysis" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "postId" TEXT,
    "sourceType" "public"."SentimentSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "positiveScore" DOUBLE PRECISION NOT NULL,
    "negativeScore" DOUBLE PRECISION NOT NULL,
    "neutralScore" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "emotions" JSONB,
    "platform" "public"."SocialProvider" NOT NULL,
    "authorId" TEXT,
    "authorHandle" TEXT,
    "language" TEXT,
    "detectedTopics" TEXT[],
    "isInfluencer" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sentiment_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sentiment_trends" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "platform" "public"."SocialProvider",
    "totalMentions" INTEGER NOT NULL DEFAULT 0,
    "avgSentiment" DOUBLE PRECISION NOT NULL,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "sentimentChange" DOUBLE PRECISION,
    "volumeChange" DOUBLE PRECISION,
    "topPositiveTopics" TEXT[],
    "topNegativeTopics" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sentiment_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crisis_alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "alertType" "public"."CrisisType" NOT NULL,
    "severity" "public"."AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerMetric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "timeframe" TEXT NOT NULL,
    "platform" "public"."SocialProvider",
    "affectedPosts" TEXT[],
    "keyMentions" TEXT[],
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notificationsSent" JSONB,
    "escalationLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crisis_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audience_segments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segmentType" "public"."SegmentType" NOT NULL,
    "criteria" JSONB NOT NULL,
    "estimatedSize" INTEGER NOT NULL DEFAULT 0,
    "actualSize" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementRate" DOUBLE PRECISION,
    "preferredPlatforms" "public"."SocialProvider"[],
    "activeHours" JSONB,
    "topContentTypes" TEXT[],
    "personalityTraits" JSONB,
    "interests" TEXT[],
    "demographicProfile" JSONB,
    "conversionRate" DOUBLE PRECISION,
    "avgOrderValue" DOUBLE PRECISION,
    "lifetimeValue" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_recommendations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendationType" "public"."RecommendationType" NOT NULL,
    "suggestedTopics" TEXT[],
    "suggestedTone" "public"."ContentTone",
    "suggestedFormats" TEXT[],
    "suggestedHashtags" TEXT[],
    "platforms" "public"."SocialProvider"[],
    "predictedEngagement" DOUBLE PRECISION,
    "predictedReach" INTEGER,
    "confidenceScore" DOUBLE PRECISION,
    "status" "public"."RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "usedAt" TIMESTAMP(3),
    "resultPostId" TEXT,
    "actualPerformance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posting_time_recommendations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "platform" "public"."SocialProvider" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "expectedEngagement" DOUBLE PRECISION NOT NULL,
    "audienceSize" INTEGER NOT NULL,
    "historicalData" JSONB,
    "competitorData" JSONB,
    "dataPoints" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_time_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."engagement_patterns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "patternType" "public"."EngagementPatternType" NOT NULL,
    "patternName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "behaviors" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "audienceSize" INTEGER NOT NULL DEFAULT 0,
    "demographics" JSONB,
    "platforms" "public"."SocialProvider"[],
    "avgEngagementRate" DOUBLE PRECISION,
    "avgReach" INTEGER,
    "conversionRate" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "insights" JSONB,
    "actionableItems" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trend_analysis" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" "public"."TrendSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT NOT NULL,
    "sourceContent" TEXT,
    "trendScore" DOUBLE PRECISION NOT NULL,
    "viralityScore" DOUBLE PRECISION,
    "industryMatch" DOUBLE PRECISION NOT NULL,
    "suggestedTopics" TEXT[],
    "suggestedAngles" TEXT[],
    "suggestedFormats" TEXT[],
    "tags" TEXT[],
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "aiAnalysis" JSONB,
    "opportunityScore" DOUBLE PRECISION,
    "status" "public"."TrendStatus" NOT NULL DEFAULT 'ACTIVE',
    "usedInContent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trend_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_gap_analysis" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "analysisStartDate" TIMESTAMP(3) NOT NULL,
    "analysisEndDate" TIMESTAMP(3) NOT NULL,
    "missingTopics" TEXT[],
    "underperformingTopics" TEXT[],
    "competitorTopics" TEXT[],
    "priorityTopics" JSONB NOT NULL,
    "suggestedContent" JSONB NOT NULL,
    "contentCalendarGaps" JSONB NOT NULL,
    "competitorAdvantages" TEXT[],
    "differentiationOpportunities" TEXT[],
    "expectedImpact" JSONB,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_gap_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."competitor_analysis" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "competitorHandle" TEXT,
    "platforms" "public"."SocialProvider"[],
    "contentThemes" TEXT[],
    "postingFrequency" DOUBLE PRECISION NOT NULL,
    "avgEngagement" DOUBLE PRECISION NOT NULL,
    "topPerformingTypes" TEXT[],
    "contentStrategy" JSONB NOT NULL,
    "strengthsWeaknesses" JSONB NOT NULL,
    "differentiationStrategies" JSONB NOT NULL,
    "contentGaps" TEXT[],
    "overlapAreas" TEXT[],
    "performanceMetrics" JSONB NOT NULL,
    "benchmarkData" JSONB,
    "lastAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysisVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_suggestions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trendAnalysisId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedContent" TEXT,
    "contentType" "public"."ContentType" NOT NULL,
    "platforms" "public"."SocialProvider"[],
    "topics" TEXT[],
    "hashtags" TEXT[],
    "aiGeneratedCaption" TEXT,
    "suggestedMedia" JSONB,
    "callToAction" TEXT,
    "predictedEngagement" DOUBLE PRECISION,
    "predictedReach" INTEGER,
    "viralPotential" DOUBLE PRECISION,
    "suggestedPostTime" TIMESTAMP(3),
    "timeZone" TEXT,
    "status" "public"."SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "implementedAt" TIMESTAMP(3),
    "resultPostId" TEXT,
    "actualPerformance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."smart_responses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" "public"."ResponseSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePlatform" "public"."SocialProvider" NOT NULL,
    "originalMessage" TEXT NOT NULL,
    "suggestedResponse" TEXT NOT NULL,
    "responseType" "public"."ResponseType" NOT NULL,
    "tone" "public"."ResponseTone" NOT NULL,
    "sentiment" DOUBLE PRECISION,
    "intent" TEXT,
    "category" TEXT,
    "urgency" "public"."ResponseUrgency" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "languageDetected" TEXT NOT NULL,
    "requiresHuman" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "usedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."response_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT[],
    "template" TEXT NOT NULL,
    "tone" "public"."ResponseTone" NOT NULL,
    "platform" "public"."SocialProvider",
    "language" TEXT NOT NULL DEFAULT 'en',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."automation_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "public"."AutomationType" NOT NULL,
    "triggers" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "maxExecutionsPerHour" INTEGER DEFAULT 10,
    "maxExecutionsPerDay" INTEGER DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."automation_executions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "triggerData" JSONB,
    "status" "public"."ExecutionStatus" NOT NULL,
    "executedActions" JSONB,
    "results" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_calendar_optimizations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "currentSchedule" JSONB NOT NULL,
    "performanceGaps" JSONB NOT NULL,
    "optimizedSchedule" JSONB NOT NULL,
    "improvementPredictions" JSONB NOT NULL,
    "suggestedChanges" JSONB NOT NULL,
    "implementationPlan" JSONB NOT NULL,
    "baselineMetrics" JSONB,
    "projectedMetrics" JSONB,
    "actualResults" JSONB,
    "status" "public"."OptimizationStatus" NOT NULL DEFAULT 'PENDING',
    "implementedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_calendar_optimizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."translations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "translatedContent" TEXT NOT NULL,
    "translationService" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "context" JSONB,
    "culturalAdaptation" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."translation_cache" (
    "id" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
    "targetLanguage" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "context" TEXT,
    "workspaceId" TEXT,
    "quality" DECIMAL(65,30) DEFAULT 0.95,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_language_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "proficiency" TEXT NOT NULL DEFAULT 'native',
    "autoTranslate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_language_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workspace_content_translations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "translatedContent" JSONB NOT NULL,
    "isHumanTranslated" BOOLEAN NOT NULL DEFAULT false,
    "translatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."custom_dashboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Dashboard',
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,
    "widgets" JSONB NOT NULL,
    "settings" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_workspaces_userId_workspaceId_key" ON "public"."user_workspaces"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_accountId_workspaceId_key" ON "public"."social_accounts"("provider", "accountId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "post_variants_postId_socialAccountId_key" ON "public"."post_variants"("postId", "socialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "post_assets_postId_assetId_key" ON "public"."post_assets"("postId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_items_providerItemId_socialAccountId_key" ON "public"."inbox_items"("providerItemId", "socialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_inboxItemId_key" ON "public"."conversations"("inboxItemId");

-- CreateIndex
CREATE INDEX "analytics_metrics_workspaceId_date_idx" ON "public"."analytics_metrics"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "analytics_metrics_userId_date_idx" ON "public"."analytics_metrics"("userId", "date");

-- CreateIndex
CREATE INDEX "analytics_metrics_postId_metricType_idx" ON "public"."analytics_metrics"("postId", "metricType");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_metrics_userId_socialAccountId_postId_date_hour_m_key" ON "public"."analytics_metrics"("userId", "socialAccountId", "postId", "date", "hour", "metricType");

-- CreateIndex
CREATE INDEX "user_sessions_userId_startTime_idx" ON "public"."user_sessions"("userId", "startTime");

-- CreateIndex
CREATE INDEX "user_sessions_lastActivity_idx" ON "public"."user_sessions"("lastActivity");

-- CreateIndex
CREATE INDEX "user_actions_userId_timestamp_idx" ON "public"."user_actions"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "user_actions_actionType_timestamp_idx" ON "public"."user_actions"("actionType", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_resolved_timestamp_idx" ON "public"."alerts"("resolved", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_severity_timestamp_idx" ON "public"."alerts"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "audit_events_workspaceId_createdAt_idx" ON "public"."audit_events"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_userId_createdAt_idx" ON "public"."audit_events"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "public"."accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "public"."sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "content_performance_predictions_postId_key" ON "public"."content_performance_predictions"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_versions_name_version_key" ON "public"."ai_model_versions"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "hashtag_suggestions_workspaceId_hashtag_platform_key" ON "public"."hashtag_suggestions"("workspaceId", "hashtag", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "content_tone_analysis_postId_key" ON "public"."content_tone_analysis"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "image_analysis_assetId_key" ON "public"."image_analysis"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "visual_trends_platform_category_trendName_key" ON "public"."visual_trends"("platform", "category", "trendName");

-- CreateIndex
CREATE INDEX "sentiment_analysis_workspaceId_createdAt_idx" ON "public"."sentiment_analysis"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "sentiment_analysis_postId_overallScore_idx" ON "public"."sentiment_analysis"("postId", "overallScore");

-- CreateIndex
CREATE INDEX "sentiment_analysis_platform_createdAt_idx" ON "public"."sentiment_analysis"("platform", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sentiment_trends_workspaceId_date_platform_key" ON "public"."sentiment_trends"("workspaceId", "date", "platform");

-- CreateIndex
CREATE INDEX "crisis_alerts_workspaceId_status_createdAt_idx" ON "public"."crisis_alerts"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "crisis_alerts_severity_createdAt_idx" ON "public"."crisis_alerts"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "audience_segments_workspaceId_isActive_idx" ON "public"."audience_segments"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "content_recommendations_workspaceId_status_idx" ON "public"."content_recommendations"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "content_recommendations_segmentId_createdAt_idx" ON "public"."content_recommendations"("segmentId", "createdAt");

-- CreateIndex
CREATE INDEX "posting_time_recommendations_workspaceId_platform_idx" ON "public"."posting_time_recommendations"("workspaceId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "posting_time_recommendations_segmentId_platform_dayOfWeek_h_key" ON "public"."posting_time_recommendations"("segmentId", "platform", "dayOfWeek", "hour");

-- CreateIndex
CREATE INDEX "engagement_patterns_workspaceId_patternType_idx" ON "public"."engagement_patterns"("workspaceId", "patternType");

-- CreateIndex
CREATE INDEX "engagement_patterns_isActive_createdAt_idx" ON "public"."engagement_patterns"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "trend_analysis_workspaceId_status_detectedAt_idx" ON "public"."trend_analysis"("workspaceId", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "trend_analysis_trendScore_viralityScore_idx" ON "public"."trend_analysis"("trendScore", "viralityScore");

-- CreateIndex
CREATE INDEX "content_gap_analysis_workspaceId_analysisEndDate_idx" ON "public"."content_gap_analysis"("workspaceId", "analysisEndDate");

-- CreateIndex
CREATE INDEX "competitor_analysis_workspaceId_lastAnalyzedAt_idx" ON "public"."competitor_analysis"("workspaceId", "lastAnalyzedAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_analysis_workspaceId_competitorName_key" ON "public"."competitor_analysis"("workspaceId", "competitorName");

-- CreateIndex
CREATE INDEX "content_suggestions_workspaceId_status_priority_idx" ON "public"."content_suggestions"("workspaceId", "status", "priority");

-- CreateIndex
CREATE INDEX "content_suggestions_suggestedPostTime_idx" ON "public"."content_suggestions"("suggestedPostTime");

-- CreateIndex
CREATE INDEX "smart_responses_workspaceId_status_urgency_idx" ON "public"."smart_responses"("workspaceId", "status", "urgency");

-- CreateIndex
CREATE INDEX "smart_responses_sourcePlatform_responseType_idx" ON "public"."smart_responses"("sourcePlatform", "responseType");

-- CreateIndex
CREATE INDEX "response_templates_workspaceId_category_isActive_idx" ON "public"."response_templates"("workspaceId", "category", "isActive");

-- CreateIndex
CREATE INDEX "response_templates_keywords_idx" ON "public"."response_templates"("keywords");

-- CreateIndex
CREATE INDEX "automation_rules_workspaceId_isActive_ruleType_idx" ON "public"."automation_rules"("workspaceId", "isActive", "ruleType");

-- CreateIndex
CREATE INDEX "automation_executions_ruleId_status_idx" ON "public"."automation_executions"("ruleId", "status");

-- CreateIndex
CREATE INDEX "automation_executions_workspaceId_startedAt_idx" ON "public"."automation_executions"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "content_calendar_optimizations_workspaceId_status_startDate_idx" ON "public"."content_calendar_optimizations"("workspaceId", "status", "startDate");

-- CreateIndex
CREATE INDEX "translations_originalLanguage_targetLanguage_idx" ON "public"."translations"("originalLanguage", "targetLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "translations_workspaceId_originalContent_targetLanguage_key" ON "public"."translations"("workspaceId", "originalContent", "targetLanguage");

-- CreateIndex
CREATE INDEX "translation_cache_sourceText_targetLanguage_idx" ON "public"."translation_cache"("sourceText", "targetLanguage");

-- CreateIndex
CREATE INDEX "translation_cache_workspaceId_idx" ON "public"."translation_cache"("workspaceId");

-- CreateIndex
CREATE INDEX "translation_cache_expiresAt_idx" ON "public"."translation_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "user_language_preferences_userId_idx" ON "public"."user_language_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_language_preferences_locale_idx" ON "public"."user_language_preferences"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "user_language_preferences_userId_locale_key" ON "public"."user_language_preferences"("userId", "locale");

-- CreateIndex
CREATE INDEX "workspace_content_translations_workspaceId_contentType_idx" ON "public"."workspace_content_translations"("workspaceId", "contentType");

-- CreateIndex
CREATE INDEX "workspace_content_translations_contentId_locale_idx" ON "public"."workspace_content_translations"("contentId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_content_translations_contentId_locale_key" ON "public"."workspace_content_translations"("contentId", "locale");

-- CreateIndex
CREATE INDEX "custom_dashboards_userId_workspaceId_idx" ON "public"."custom_dashboards"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "custom_dashboards_workspaceId_isPublic_idx" ON "public"."custom_dashboards"("workspaceId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "custom_dashboards_userId_workspaceId_name_key" ON "public"."custom_dashboards"("userId", "workspaceId", "name");

-- AddForeignKey
ALTER TABLE "public"."user_workspaces" ADD CONSTRAINT "user_workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_workspaces" ADD CONSTRAINT "user_workspaces_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_accounts" ADD CONSTRAINT "social_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_accounts" ADD CONSTRAINT "social_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_variants" ADD CONSTRAINT "post_variants_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_variants" ADD CONSTRAINT "post_variants_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "public"."social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_assets" ADD CONSTRAINT "post_assets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."post_assets" ADD CONSTRAINT "post_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."templates" ADD CONSTRAINT "templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_items" ADD CONSTRAINT "inbox_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_items" ADD CONSTRAINT "inbox_items_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "public"."social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inbox_items" ADD CONSTRAINT "inbox_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "public"."inbox_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "public"."social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_actions" ADD CONSTRAINT "user_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_content_suggestions" ADD CONSTRAINT "ai_content_suggestions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_performance_predictions" ADD CONSTRAINT "content_performance_predictions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_tracking" ADD CONSTRAINT "ai_usage_tracking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_tracking" ADD CONSTRAINT "ai_usage_tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."hashtag_suggestions" ADD CONSTRAINT "hashtag_suggestions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_tone_analysis" ADD CONSTRAINT "content_tone_analysis_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_analysis" ADD CONSTRAINT "image_analysis_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_analysis" ADD CONSTRAINT "image_analysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_optimizations" ADD CONSTRAINT "image_optimizations_originalAssetId_fkey" FOREIGN KEY ("originalAssetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_optimizations" ADD CONSTRAINT "image_optimizations_optimizedAssetId_fkey" FOREIGN KEY ("optimizedAssetId") REFERENCES "public"."assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_optimizations" ADD CONSTRAINT "image_optimizations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visual_performance_metrics" ADD CONSTRAINT "visual_performance_metrics_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visual_performance_metrics" ADD CONSTRAINT "visual_performance_metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."visual_performance_metrics" ADD CONSTRAINT "visual_performance_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."brand_visual_guidelines" ADD CONSTRAINT "brand_visual_guidelines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_ab_tests" ADD CONSTRAINT "image_ab_tests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."image_ab_tests" ADD CONSTRAINT "image_ab_tests_controlAssetId_fkey" FOREIGN KEY ("controlAssetId") REFERENCES "public"."assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_ab_tests" ADD CONSTRAINT "content_ab_tests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ab_test_executions" ADD CONSTRAINT "ab_test_executions_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "public"."content_ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sentiment_analysis" ADD CONSTRAINT "sentiment_analysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sentiment_analysis" ADD CONSTRAINT "sentiment_analysis_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sentiment_trends" ADD CONSTRAINT "sentiment_trends_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crisis_alerts" ADD CONSTRAINT "crisis_alerts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audience_segments" ADD CONSTRAINT "audience_segments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_recommendations" ADD CONSTRAINT "content_recommendations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_recommendations" ADD CONSTRAINT "content_recommendations_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "public"."audience_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posting_time_recommendations" ADD CONSTRAINT "posting_time_recommendations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posting_time_recommendations" ADD CONSTRAINT "posting_time_recommendations_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "public"."audience_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."engagement_patterns" ADD CONSTRAINT "engagement_patterns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trend_analysis" ADD CONSTRAINT "trend_analysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_gap_analysis" ADD CONSTRAINT "content_gap_analysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."competitor_analysis" ADD CONSTRAINT "competitor_analysis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_suggestions" ADD CONSTRAINT "content_suggestions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_suggestions" ADD CONSTRAINT "content_suggestions_trendAnalysisId_fkey" FOREIGN KEY ("trendAnalysisId") REFERENCES "public"."trend_analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."smart_responses" ADD CONSTRAINT "smart_responses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response_templates" ADD CONSTRAINT "response_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."automation_rules" ADD CONSTRAINT "automation_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."automation_executions" ADD CONSTRAINT "automation_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."automation_executions" ADD CONSTRAINT "automation_executions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_calendar_optimizations" ADD CONSTRAINT "content_calendar_optimizations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."translations" ADD CONSTRAINT "translations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."translation_cache" ADD CONSTRAINT "translation_cache_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_language_preferences" ADD CONSTRAINT "user_language_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_content_translations" ADD CONSTRAINT "workspace_content_translations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workspace_content_translations" ADD CONSTRAINT "workspace_content_translations_translatedBy_fkey" FOREIGN KEY ("translatedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."custom_dashboards" ADD CONSTRAINT "custom_dashboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."custom_dashboards" ADD CONSTRAINT "custom_dashboards_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
