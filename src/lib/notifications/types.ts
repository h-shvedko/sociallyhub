export interface NotificationData {
  id: string
  type: NotificationType
  title: string
  message: string
  userId: string
  workspaceId?: string
  data?: Record<string, any>
  priority: NotificationPriority
  category: NotificationCategory
  createdAt: string
  readAt?: string
  actionUrl?: string
  actionLabel?: string
  imageUrl?: string
  sender?: {
    id: string
    name: string
    avatar?: string
  }
  metadata?: {
    postId?: string
    accountId?: string
    platform?: string
    campaignId?: string
    teamMemberId?: string
    approvalId?: string
    [key: string]: any
  }
}

export enum NotificationType {
  // Social Media
  POST_PUBLISHED = 'post_published',
  POST_FAILED = 'post_failed',
  POST_SCHEDULED = 'post_scheduled',
  ENGAGEMENT_MILESTONE = 'engagement_milestone',
  MENTION_RECEIVED = 'mention_received',
  
  // Analytics
  PERFORMANCE_ALERT = 'performance_alert',
  ANALYTICS_REPORT = 'analytics_report',
  GOAL_ACHIEVED = 'goal_achieved',
  
  // Team Collaboration
  TEAM_INVITATION = 'team_invitation',
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  ROLE_CHANGED = 'role_changed',
  
  // Content Approval
  APPROVAL_REQUESTED = 'approval_requested',
  CONTENT_APPROVED = 'content_approved',
  CONTENT_REJECTED = 'content_rejected',
  CHANGES_REQUESTED = 'changes_requested',
  
  // Account Management
  ACCOUNT_CONNECTED = 'account_connected',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  ACCOUNT_ERROR = 'account_error',
  RATE_LIMIT_WARNING = 'rate_limit_warning',
  
  // System
  SYSTEM_MAINTENANCE = 'system_maintenance',
  FEATURE_ANNOUNCEMENT = 'feature_announcement',
  SECURITY_ALERT = 'security_alert',
  WORKSPACE_LIMIT = 'workspace_limit',
  
  // Comments & Collaboration
  COMMENT_ADDED = 'comment_added',
  COMMENT_REPLIED = 'comment_replied',
  CONTENT_SHARED = 'content_shared',
  MENTION_IN_COMMENT = 'mention_in_comment'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum NotificationCategory {
  SOCIAL_MEDIA = 'social_media',
  ANALYTICS = 'analytics',
  TEAM = 'team',
  CONTENT = 'content',
  SYSTEM = 'system',
  SECURITY = 'security'
}

export interface NotificationPreferences {
  userId: string
  workspaceId?: string
  channels: {
    inApp: boolean
    email: boolean
    push: boolean
    sms: boolean
  }
  categories: {
    [key in NotificationCategory]: {
      enabled: boolean
      priority: NotificationPriority
      channels: (keyof NotificationPreferences['channels'])[]
    }
  }
  quietHours?: {
    enabled: boolean
    start: string // HH:mm format
    end: string
    timezone: string
  }
  frequency?: {
    immediate: NotificationType[]
    digest: NotificationType[]
    digestInterval: 'hourly' | 'daily' | 'weekly'
  }
}

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
  userId: string
  workspaceId?: string
}

export interface NotificationDeliveryChannel {
  type: 'in_app' | 'email' | 'push' | 'sms' | 'webhook'
  enabled: boolean
  config: Record<string, any>
}

export interface NotificationTemplate {
  id: string
  type: NotificationType
  title: string
  message: string
  emailSubject?: string
  emailHtml?: string
  pushTitle?: string
  pushBody?: string
  variables: string[]
  category: NotificationCategory
  priority: NotificationPriority
}

export interface NotificationRule {
  id: string
  name: string
  description?: string
  conditions: {
    userId?: string
    workspaceId?: string
    type?: NotificationType[]
    category?: NotificationCategory[]
    priority?: NotificationPriority[]
    metadata?: Record<string, any>
  }
  actions: {
    channels: NotificationDeliveryChannel[]
    throttle?: {
      interval: number // milliseconds
      maxCount: number
    }
    delay?: number // milliseconds
    template?: string
  }
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationHistory {
  id: string
  notificationId: string
  userId: string
  workspaceId?: string
  channel: 'in_app' | 'email' | 'push' | 'sms' | 'webhook'
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read'
  sentAt?: string
  deliveredAt?: string
  readAt?: string
  failureReason?: string
  retryCount: number
  metadata?: Record<string, any>
}

export interface NotificationStats {
  total: number
  unread: number
  byCategory: Record<NotificationCategory, number>
  byPriority: Record<NotificationPriority, number>
  byType: Record<NotificationType, number>
  recent: NotificationData[]
}

export interface EmailNotificationData {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  html: string
  text?: string
  attachments?: {
    filename: string
    content: Buffer | string
    contentType?: string
  }[]
  headers?: Record<string, string>
}

export interface PushNotificationData {
  title: string
  body: string
  icon?: string
  badge?: number
  tag?: string
  data?: Record<string, any>
  actions?: {
    action: string
    title: string
    icon?: string
  }[]
  requireInteraction?: boolean
  silent?: boolean
}

export interface SMSNotificationData {
  to: string
  message: string
  from?: string
}

export interface WebhookNotificationData {
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  payload: Record<string, any>
  timeout?: number
  retries?: number
}

// Notification context for different scenarios
export interface PostNotificationContext {
  postId: string
  platform: string
  accountId: string
  status: 'published' | 'failed' | 'scheduled'
  scheduledFor?: string
  error?: string
  metrics?: {
    likes: number
    shares: number
    comments: number
    views: number
  }
}

export interface TeamNotificationContext {
  memberId: string
  memberName: string
  memberEmail: string
  role: string
  previousRole?: string
  invitationId?: string
}

export interface ApprovalNotificationContext {
  approvalId: string
  postId: string
  requesterId: string
  requesterName: string
  approverId?: string
  approverName?: string
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested'
  comments?: string
  deadline?: string
}

export interface AccountNotificationContext {
  accountId: string
  platform: string
  username: string
  status: 'connected' | 'disconnected' | 'error' | 'rate_limited'
  error?: string
  rateLimitReset?: string
}

export interface AnalyticsNotificationContext {
  metric: string
  value: number
  threshold: number
  comparison: 'above' | 'below' | 'equal'
  period: string
  platform?: string
  accountId?: string
}