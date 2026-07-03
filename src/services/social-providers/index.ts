// Core types and interfaces
export * from './types'

// Base provider class
export { BaseSocialMediaProvider } from './base-provider'

// Individual platform providers
export { TwitterProvider } from './twitter-provider'
export { FacebookProvider } from './facebook-provider'
export { InstagramProvider } from './instagram-provider'
export { LinkedInProvider } from './linkedin-provider'
export { TikTokProvider } from './tiktok-provider'
export { YouTubeProvider } from './youtube-provider'

// Unified API abstraction layer
export { 
  SocialMediaManager, 
  socialMediaManager,
  type BulkPostOptions,
  type BulkPostResult,
  type CrossPlatformAnalytics,
  type AccountStatus
} from './social-media-manager'

// Re-export commonly used types for convenience
export type {
  SocialMediaProvider,
  Platform,
  SocialAccount,
  PostOptions,
  PublishedPost,
  UserProfile,
  AnalyticsData,
  APIResponse,
  MediaItem
} from './types'

// Error classes are runtime values (used with `instanceof`), so they must be
// re-exported as values, not via `export type` (which would trip TS1362).
export {
  SocialMediaError,
  RateLimitError,
  AuthenticationError,
  ValidationError
} from './types'