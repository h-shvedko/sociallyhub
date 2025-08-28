-- Database Performance Optimization Indexes
-- Run these queries on your PostgreSQL database to optimize performance

-- User table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_created_at ON "User"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_verified ON "User"("emailVerified") WHERE "emailVerified" IS NOT NULL;

-- Account table indexes (NextAuth)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_user_id ON "Account"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_provider ON "Account"(provider, "providerAccountId");

-- Session table indexes (NextAuth)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user_id ON "Session"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_token ON "Session"("sessionToken");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expires ON "Session"(expires);

-- Workspace table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_owner_id ON "Workspace"("ownerId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_created_at ON "Workspace"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_active ON "Workspace"("isActive") WHERE "isActive" = true;

-- UserWorkspace table indexes (many-to-many with role)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_workspace_user_id ON "UserWorkspace"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_workspace_workspace_id ON "UserWorkspace"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_workspace_role ON "UserWorkspace"(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_workspace_active ON "UserWorkspace"("isActive") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_workspace_composite ON "UserWorkspace"("userId", "workspaceId", role);

-- SocialAccount table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_account_workspace_id ON "SocialAccount"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_account_platform ON "SocialAccount"(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_account_active ON "SocialAccount"("isActive") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_account_external_id ON "SocialAccount"("externalAccountId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_account_composite ON "SocialAccount"("workspaceId", platform, "isActive");

-- Post table indexes (main content table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_workspace_id ON "Post"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_author_id ON "Post"("authorId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_status ON "Post"(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_created_at ON "Post"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_updated_at ON "Post"("updatedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_scheduled_at ON "Post"("scheduledAt") WHERE "scheduledAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_published_at ON "Post"("publishedAt") WHERE "publishedAt" IS NOT NULL;

-- Composite indexes for common Post queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_workspace_status ON "Post"("workspaceId", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_workspace_created ON "Post"("workspaceId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_workspace_scheduled ON "Post"("workspaceId", "scheduledAt") WHERE "scheduledAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_author_created ON "Post"("authorId", "createdAt" DESC);

-- Full-text search index for Post content (PostgreSQL specific)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_content_search ON "Post" USING gin(to_tsvector('english', content));

-- PostPlatform table indexes (many-to-many for post platforms)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_platform_post_id ON "PostPlatform"("postId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_platform_account_id ON "PostPlatform"("accountId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_platform_platform ON "PostPlatform"(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_platform_active ON "PostPlatform"("isActive") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_platform_composite ON "PostPlatform"("postId", platform, "isActive");

-- PostVariant table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_variant_post_id ON "PostVariant"("postId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_variant_platform ON "PostVariant"(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_variant_composite ON "PostVariant"("postId", platform);

-- MediaAsset table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_asset_workspace_id ON "MediaAsset"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_asset_type ON "MediaAsset"(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_asset_created_at ON "MediaAsset"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_asset_size ON "MediaAsset"(size);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_asset_composite ON "MediaAsset"("workspaceId", type, "createdAt" DESC);

-- PostMedia table indexes (many-to-many for post media)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_media_post_id ON "PostMedia"("postId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_media_asset_id ON "PostMedia"("mediaAssetId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_media_order ON "PostMedia"("postId", "order");

-- Campaign table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_workspace_id ON "Campaign"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_status ON "Campaign"(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_created_at ON "Campaign"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_start_date ON "Campaign"("startDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_end_date ON "Campaign"("endDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_composite ON "Campaign"("workspaceId", status, "createdAt" DESC);

-- InboxItem table indexes (social media inbox)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_workspace_id ON "InboxItem"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_account_id ON "InboxItem"("socialAccountId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_type ON "InboxItem"(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_status ON "InboxItem"(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_created_at ON "InboxItem"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_unread ON "InboxItem"("workspaceId", "isRead") WHERE "isRead" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_item_composite ON "InboxItem"("workspaceId", type, status, "createdAt" DESC);

-- Conversation table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_workspace_id ON "Conversation"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_account_id ON "Conversation"("socialAccountId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_updated_at ON "Conversation"("updatedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_composite ON "Conversation"("workspaceId", "updatedAt" DESC);

-- AnalyticsMetric table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_workspace_id ON "AnalyticsMetric"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_post_id ON "AnalyticsMetric"("postId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_date ON "AnalyticsMetric"(date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_platform ON "AnalyticsMetric"(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_type ON "AnalyticsMetric"("metricType");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_composite ON "AnalyticsMetric"("workspaceId", date, platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_post_date ON "AnalyticsMetric"("postId", date DESC);

-- AuditEvent table indexes (for activity tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_workspace_id ON "AuditEvent"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_user_id ON "AuditEvent"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_action ON "AuditEvent"(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_timestamp ON "AuditEvent"(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_composite ON "AuditEvent"("workspaceId", timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_user_timestamp ON "AuditEvent"("userId", timestamp DESC);

-- UserSession table indexes (for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_user_id ON "UserSession"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_started_at ON "UserSession"("startedAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_ended_at ON "UserSession"("endedAt") WHERE "endedAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_duration ON "UserSession"(duration) WHERE duration IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_active ON "UserSession"("userId", "endedAt") WHERE "endedAt" IS NULL;

-- UserAction table indexes (for detailed analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_action_user_id ON "UserAction"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_action_session_id ON "UserAction"("sessionId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_action_type ON "UserAction"("actionType");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_action_timestamp ON "UserAction"(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_action_composite ON "UserAction"("userId", "actionType", timestamp DESC);

-- Alert table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_workspace_id ON "Alert"("workspaceId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_user_id ON "Alert"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_severity ON "Alert"(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_status ON "Alert"(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_created_at ON "Alert"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_resolved_at ON "Alert"("resolvedAt") WHERE "resolvedAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_active ON "Alert"(status, severity) WHERE status != 'RESOLVED';

-- Notification table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_id ON "Notification"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_type ON "Notification"(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_category ON "Notification"(category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_priority ON "Notification"(priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_read ON "Notification"("isRead");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_archived ON "Notification"("isArchived");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_created_at ON "Notification"("createdAt" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_unread ON "Notification"("userId", "isRead") WHERE "isRead" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_category ON "Notification"("userId", category, "createdAt" DESC);

-- NotificationPreference table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_preference_user_id ON "NotificationPreference"("userId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_preference_type ON "NotificationPreference"("notificationType");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_preference_composite ON "NotificationPreference"("userId", "notificationType");

-- Partial indexes for better performance on filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_scheduled_future ON "Post"("scheduledAt") 
  WHERE "scheduledAt" > NOW() AND status = 'SCHEDULED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_published_recent ON "Post"("publishedAt" DESC) 
  WHERE "publishedAt" IS NOT NULL AND "publishedAt" > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_recent ON "AnalyticsMetric"(date DESC, "workspaceId") 
  WHERE date > NOW() - INTERVAL '90 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inbox_unassigned ON "InboxItem"("workspaceId", "createdAt" DESC) 
  WHERE "assignedTo" IS NULL AND status = 'OPEN';

-- Database maintenance queries (run periodically)

-- Update table statistics
-- ANALYZE "User", "Workspace", "Post", "PostPlatform", "AnalyticsMetric", "InboxItem";

-- Vacuum tables to reclaim space (run during maintenance windows)
-- VACUUM ANALYZE "Post";
-- VACUUM ANALYZE "AnalyticsMetric";
-- VACUUM ANALYZE "InboxItem";
-- VACUUM ANALYZE "AuditEvent";

-- Check index usage (diagnostic query)
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
*/

-- Check slow queries (diagnostic query)
/*
SELECT 
    calls,
    total_time,
    mean_time,
    query
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
*/

-- Monitor index bloat (diagnostic query)
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
*/