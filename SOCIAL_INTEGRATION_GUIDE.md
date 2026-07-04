# Social Media Integration Guide

This guide explains how to set up and configure social media integrations for SociallyHub.

## Platform Availability (ADR-0009)

> **Read this first.** Per ADR-0009 (depth-first completion), SociallyHub integrates
> platforms in tiers rather than claiming all six work equally. The connection UI and
> `GET /api/accounts/platforms` report the true tier for each platform:

| Platform | Tier | What that means |
|---|---|---|
| **Twitter/X** | `configurable` / `available` | Real integration path built (OAuth 2.0 + S256 PKCE, publish, media upload, replies, analytics, mention polling). Connectable once app credentials are configured (env vars or workspace BYO `PlatformCredentials`). |
| **Facebook** (Pages) | `configurable` / `available` | Real Meta Graph integration path built (publish, media upload, webhook inbox ingestion, replies, page insights). Connectable once credentials are configured. |
| **Instagram** (Business) | `configurable` / `available` | Rides the same Meta Graph app as Facebook (shared credentials + webhooks). Real container-publish flow built. |
| **LinkedIn** | `unavailable` | Not yet available — gated behind its own ADR-0009 completion phase. Reported honestly as "coming soon"; never fabricated, not even in demo mode. |
| **TikTok** | `unavailable` | Not yet available — gated (heavier app review + publishing restrictions). |
| **YouTube** | `unavailable` | Not yet available — gated (YouTube Data API review + publishing restrictions). |

**Important honesty notes:**

- **Twitter/X, Facebook, and Instagram are the depth-first real targets.** Their code paths
  are complete and testable in-environment, but **live posting/media/analytics against the
  real networks additionally require real platform credentials plus platform approval**
  (Meta App Review for `pages_manage_posts` / `instagram_content_publish` / webhooks; a paid
  X API tier). Without those, provider operations **fail honestly** (`success: false` with a
  clear error) — they do **not** return fabricated data.
- **Analytics no longer fabricate data.** The previous silent `success: true` mock-analytics
  fallbacks have been removed from every provider (ADR-0009 Phase 3). When a metrics call is
  unavailable or fails, providers return `success: false` so callers can never mistake
  fiction for real numbers.
- **Demo connections are explicit only.** Fabricated demo accounts are produced only when
  demo mode is explicitly enabled (ADR-0025). With no credentials and demo off,
  `POST /api/accounts/connect` returns an actionable `503` configuration error instead of a
  fake connection.

### Platform surfaces (intended, per the real integration path)

- **Twitter/X** - Posts, mentions (polled), replies
- **Facebook** - Pages, posts, comments (webhook-ingested)
- **Instagram** - Business posts, comments (webhook-ingested)
- **LinkedIn** - *Not yet available* (company pages, posts, messages)
- **TikTok** - *Not yet available* (videos, comments)
- **YouTube** - *Not yet available* (videos, comments)

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

> **Not yet available (ADR-0009).** LinkedIn is gated `unavailable` and cannot be connected.
> The steps below document the *intended* setup for when its completion phase lands.

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

> **Not yet available (ADR-0009).** TikTok is gated `unavailable` and cannot be connected.
> The steps below document the *intended* setup for when its completion phase lands.

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

> **Not yet available (ADR-0009).** YouTube is gated `unavailable` and cannot be connected.
> The steps below document the *intended* setup for when its completion phase lands.

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

### Security Features (delivered under ADR-0005/0006/0009)
- **Tokens encrypted at rest** — `SocialAccount.accessToken`/`refreshToken` are stored as
  `enc:v1` AES-256-GCM ciphertext (ADR-0006), written encrypted in
  `/api/accounts/callback` and decrypted only through the crypto helpers. (Previously the
  schema comments claimed "Encrypted" but tokens were stored in plaintext — now corrected.)
- **Signed OAuth `state`** — `state` is HMAC-signed and verified via
  `src/lib/security/oauth-state.ts` (`signState`/`verifyState`, ADR-0005), closing the
  previously-tamperable unsigned-JSON state gap and preventing CSRF.
- **Real S256 PKCE** — Twitter OAuth 2.0 uses a genuine `crypto.randomBytes` verifier +
  SHA-256 challenge (the old `mock_code_challenge`/`mock_code_verifier` stubs are gone).
- **Workspace isolation** — all account operations are scoped to the caller's workspace.
- **Automatic token refresh** — `SocialMediaManager.refreshAccount(accountId)` delegates to
  each provider's `refreshAccessToken`, persists rotated tokens encrypted, and updates
  `tokenExpiry`/`status`.

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
- [x] **Token encryption enabled** — `SocialAccount` tokens encrypted at rest (`enc:v1`
  AES-256-GCM, ADR-0006).
- [x] **Signed OAuth state** — HMAC-signed `state` + real S256 PKCE (ADR-0005/0009).
- [x] **Webhook signature verification** — `POST /api/webhooks/meta` validates
  `X-Hub-Signature-256` (HMAC-SHA256 over the raw body with `META_APP_SECRET`), reads raw
  bytes untouched, enforces a payload-size cap, and fails closed (`503`) when the secret is
  unset (ADR-0005/0009 Phase 2).
- [x] **No fabricated analytics** — silent `success: true` mock fallbacks removed; failures
  return `success: false` (ADR-0009 Phase 3).
- [x] **Demo connections gated** — fake accounts only when demo mode is explicitly on
  (ADR-0025); otherwise `503` configuration error.
- [ ] API keys supplied via env vars **or** workspace BYO `PlatformCredentials` (BYO source
  operative once owners re-enter credentials per ADR-0006 Phase 4)
- [ ] OAuth redirect URIs use HTTPS (deployment/config concern)
- [ ] Rate limiting implemented (broader API surface — see ADR-0005)
- [ ] Error monitoring configured (see ADR-0023)
- [ ] CORS policies set correctly

> **Deferred to real-credential availability:** live posting, media upload, inbox ingestion,
> replies, and analytics against the real Twitter/X and Meta networks require actual platform
> credentials plus platform approval (Meta App Review; paid X API tier). The code paths are
> built and testable in-environment, but end-to-end verification against the live APIs is
> deferred until those external dependencies exist — it is not simulated or faked.

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