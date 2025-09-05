# Social Media Integration Guide

This guide explains how to set up and configure social media integrations for SociallyHub.

## Overview

SociallyHub supports the following social media platforms:

- **Twitter/X** - Posts, mentions, DMs
- **Facebook** - Pages, posts, comments
- **Instagram** - Posts, stories, comments
- **LinkedIn** - Company pages, posts, messages  
- **TikTok** - Videos, comments
- **YouTube** - Videos, comments, live streams

## Architecture

### Components
- **Social Providers** (`/src/services/social-providers/`) - Individual platform implementations
- **Social Media Manager** - Unified API abstraction layer
- **OAuth Flow** - Secure account connection process
- **Account Management** - UI for managing connected accounts

### Database Schema
```sql
model SocialAccount {
  id           String              @id @default(cuid())
  workspaceId  String
  clientId     String?
  provider     SocialProvider      // TWITTER, FACEBOOK, etc.
  accountType  String              // "page", "profile", "channel"
  handle       String              // @username or page name
  displayName  String
  accountId    String              // Provider's account ID
  accessToken  String              // Encrypted
  refreshToken String?             // Encrypted
  tokenExpiry  DateTime?
  scopes       String[]            // Permissions granted
  status       SocialAccountStatus // ACTIVE, TOKEN_EXPIRED, etc.
  metadata     Json?               // Provider-specific data
}
```

## Setting Up Social Media APIs

### 1. Twitter/X API v2

**Steps:**
1. Apply for Twitter Developer account at https://developer.twitter.com/
2. Create a new app in the Twitter Developer Portal
3. Generate OAuth 2.0 credentials
4. Set redirect URI to: `https://yourdomain.com/api/accounts/callback`

**Environment Variables:**
```env
TWITTER_CLIENT_ID="your_client_id"
TWITTER_CLIENT_SECRET="your_client_secret"
```

**Scopes Required:**
- `tweet.read` - Read tweets
- `tweet.write` - Post tweets
- `users.read` - Read user info
- `offline.access` - Refresh tokens

### 2. Facebook API

**Steps:**
1. Create Facebook Developer account at https://developers.facebook.com/
2. Create a new app for "Consumer" use case
3. Add Facebook Login product
4. Configure OAuth redirect: `https://yourdomain.com/api/accounts/callback`
5. Add Instagram Basic Display if needed

**Environment Variables:**
```env
FACEBOOK_APP_ID="your_app_id"
FACEBOOK_APP_SECRET="your_app_secret"
```

**Permissions Required:**
- `pages_manage_posts` - Manage page posts
- `pages_read_engagement` - Read engagement metrics
- `publish_to_groups` - Post to groups

### 3. Instagram API

**Setup:**
Instagram uses Facebook's API system. Follow Facebook setup and add Instagram Basic Display product.

**Environment Variables:**
```env
INSTAGRAM_APP_ID="your_facebook_app_id"
INSTAGRAM_APP_SECRET="your_facebook_app_secret"
```

**Permissions:**
- `instagram_basic` - Basic profile info
- `instagram_content_publish` - Publish content
- `pages_show_list` - List pages

### 4. LinkedIn API v2

**Steps:**
1. Create LinkedIn Developer account at https://www.linkedin.com/developers/
2. Create a new app
3. Add "Sign In with LinkedIn" product
4. Set redirect URI: `https://yourdomain.com/api/accounts/callback`

**Environment Variables:**
```env
LINKEDIN_CLIENT_ID="your_client_id"
LINKEDIN_CLIENT_SECRET="your_client_secret"
```

**Scopes:**
- `r_liteprofile` - Basic profile
- `w_member_social` - Share content
- `r_basicprofile` - Extended profile

### 5. TikTok for Developers

**Steps:**
1. Apply at https://developers.tiktok.com/
2. Create app and get approved
3. Configure OAuth settings
4. Set redirect URI

**Environment Variables:**
```env
TIKTOK_CLIENT_KEY="your_client_key"
TIKTOK_CLIENT_SECRET="your_client_secret"
```

**Scopes:**
- `user.info.basic` - User info
- `video.publish` - Upload videos
- `video.list` - List videos

### 6. YouTube Data API

**Steps:**
1. Create Google Cloud Project at https://console.cloud.google.com/
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Set redirect URI

**Environment Variables:**
```env
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
YOUTUBE_API_KEY="your_youtube_api_key"
```

**Scopes:**
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`

## OAuth Flow

### Connection Process
1. User clicks "Connect Account" for a platform
2. App redirects to platform's OAuth authorization URL
3. User grants permissions on the platform
4. Platform redirects back with authorization code
5. App exchanges code for access/refresh tokens
6. Account details are stored in database

### Security Features
- All tokens are encrypted before storage
- State parameter prevents CSRF attacks
- Workspace isolation ensures data security
- Token refresh handles expiration automatically

## API Endpoints

### Account Management
- `GET /api/accounts` - List workspace accounts
- `POST /api/accounts/connect` - Initiate OAuth flow
- `GET /api/accounts/callback` - Handle OAuth callback
- `GET /api/accounts/[id]` - Get account details
- `PUT /api/accounts/[id]` - Update account settings
- `DELETE /api/accounts/[id]` - Remove account
- `POST /api/accounts/[id]/refresh` - Refresh tokens

### Social Actions
- `POST /api/social/post` - Create cross-platform post
- `GET /api/social/analytics` - Get engagement metrics
- `POST /api/social/media/upload` - Upload media files

## Error Handling

### Common Issues
- **Token Expired** - Automatically refresh or prompt reconnection
- **Rate Limiting** - Implement exponential backoff
- **Permission Denied** - Check account scopes
- **API Changes** - Monitor provider documentation

### Status Codes
- `ACTIVE` - Working normally
- `TOKEN_EXPIRED` - Needs token refresh
- `REVOKED` - User revoked access
- `ERROR` - Connection problems

## Usage Examples

### Connecting an Account
```typescript
const response = await fetch('/api/accounts/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'twitter',
    workspaceId: 'workspace-id'
  })
})

const { authUrl } = await response.json()
window.location.href = authUrl
```

### Posting Content
```typescript
const post = await fetch('/api/social/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Hello World!',
    platforms: ['twitter', 'facebook'],
    accountIds: ['account1', 'account2']
  })
})
```

## Production Deployment

### Security Checklist
- [ ] All API keys stored in environment variables
- [ ] OAuth redirect URIs use HTTPS
- [ ] Token encryption enabled
- [ ] Rate limiting implemented
- [ ] Error monitoring configured
- [ ] CORS policies set correctly

### Monitoring
- Track token expiration dates
- Monitor API rate limits
- Log authentication failures
- Alert on connection errors

## Troubleshooting

### Common Problems

**"Invalid redirect URI"**
- Ensure redirect URI matches exactly in app settings
- Use HTTPS in production
- Check for trailing slashes

**"Insufficient permissions"**
- Verify all required scopes are requested
- Check if app has proper review status
- Ensure user granted all permissions

**"Token expired"**
- Implement automatic token refresh
- Check token expiry dates
- Handle refresh failures gracefully

**"Rate limit exceeded"**
- Implement exponential backoff
- Cache API responses where possible
- Use webhook subscriptions instead of polling

## Testing

### Development Setup
1. Create test apps on each platform
2. Use localhost URLs for development
3. Test OAuth flow end-to-end
4. Verify token refresh mechanisms

### Staging Environment
1. Use staging-specific app credentials
2. Test with real social accounts
3. Verify webhook deliveries
4. Load test API endpoints

## Support

For additional help:
- Check provider documentation
- Review error logs in application
- Test OAuth flow in browser dev tools
- Verify environment variables are set correctly