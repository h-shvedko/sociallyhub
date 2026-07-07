/**
 * E2E fixture constants — the single source of truth shared by:
 *   - prisma/seed-e2e.ts   (writes these rows, idempotently)
 *   - e2e/global-setup.ts  (signs in as the fixture user)
 *   - every spec in e2e/   (asserts against these exact values)
 *
 * All ids are stable and prefixed `e2e-` so the seeder can upsert them
 * forever without touching demo or real data.
 */

export const E2E_USER = {
  id: 'e2e-user',
  email: 'e2e@sociallyhub.test',
  password: 'e2e-password-123',
  name: 'E2E User',
  firstName: 'E2E', // dashboard greets "Welcome back, {firstName}!"
} as const

export const E2E_WORKSPACE = {
  id: 'e2e-workspace',
  name: 'E2E Workspace',
} as const

/** Seeded Subscription (ADR-0019 model): BUSINESS / ACTIVE for e2e-workspace. */
export const E2E_SUBSCRIPTION = {
  planTier: 'BUSINESS',
  planLabel: 'Business', // what the billing UI is expected to render
  status: 'ACTIVE',
} as const

export const E2E_SOCIAL_ACCOUNT = {
  id: 'e2e-social-account',
  provider: 'TWITTER',
  handle: 'e2e_test_handle',
  displayName: 'E2E Test Account',
  accountId: 'e2e-provider-account-1',
} as const

export const E2E_POST_DRAFT = {
  id: 'e2e-post-draft',
  title: 'E2E Draft Post',
  baseContent: 'E2E fixture draft post — deterministic content, do not publish.',
} as const

export const E2E_POST_SCHEDULED = {
  id: 'e2e-post-scheduled',
  title: 'E2E Scheduled Post',
  baseContent: 'E2E fixture scheduled post — deterministic content.',
} as const

export const E2E_CLIENT = {
  id: 'e2e-client',
  name: 'E2E Client',
  email: 'client@e2e.sociallyhub.test',
} as const

export const E2E_REPORT_TEMPLATE = {
  id: 'e2e-report-template',
  name: 'E2E Executive Summary',
  type: 'EXECUTIVE',
} as const

/**
 * COMPLETED report with a frozen data snapshot (ADR-0020): shareable via
 * tokenized links and visible in the client portal. The g7 spec asserts the
 * exact numbers below (e.g. impressions renders as "12,345").
 */
export const E2E_REPORT_COMPLETED = {
  id: 'e2e-report-completed',
  name: 'E2E Completed Report',
  type: 'EXECUTIVE',
  status: 'COMPLETED',
} as const

/** The frozen ClientReport.data snapshot for E2E_REPORT_COMPLETED. */
export const E2E_REPORT_COMPLETED_DATA = {
  generated: true,
  dateRange: { start: '2026-06-01T00:00:00.000Z', end: '2026-06-30T23:59:59.000Z' },
  dataPoints: 42,
  sparse: false,
  growthRate: 12.5,
  metrics: {
    impressions: 12345,
    reach: 8900,
    likes: 456,
    comments: 78,
    shares: 34,
    engagement: 568,
    clicks: 210,
    conversions: 12,
    followers: 1500,
    pageViews: 3400,
  },
  byMetricType: { ENGAGEMENT: { total: 568, count: 20 } },
  byPlatform: { TWITTER: 9000 },
} as const

/**
 * CLIENT_VIEWER portal user (ADR-0020 Phase 2): a member of E2E_WORKSPACE
 * bound to E2E_CLIENT via UserWorkspace.clientId — sees the portal, not the
 * agency dashboard.
 */
export const E2E_PORTAL_USER = {
  id: 'e2e-portal-user',
  email: 'portal@e2e.sociallyhub.test',
  password: 'e2e-portal-pass-123',
  name: 'E2E Portal User',
} as const

export const E2E_INBOX_ITEM_1 = {
  id: 'e2e-inbox-item-1',
  providerItemId: 'e2e-provider-item-1',
  content: 'E2E fixture inbox comment one — deterministic content for the inbox spec.',
  authorName: 'E2E Author One',
} as const

export const E2E_INBOX_ITEM_2 = {
  id: 'e2e-inbox-item-2',
  providerItemId: 'e2e-provider-item-2',
  content: 'E2E fixture inbox mention two — deterministic content for the inbox spec.',
  authorName: 'E2E Author Two',
} as const

/**
 * Storage state produced by global-setup (authenticated e2e-user session).
 * Relative paths in `test.use({ storageState })` resolve against the config
 * file directory (repo root), so this must stay root-relative.
 */
export const STORAGE_STATE = 'e2e/.auth/user.json'

/** Mailhog API base — override with MAILHOG_URL when not on localhost. */
export const MAILHOG_URL = process.env.MAILHOG_URL || 'http://localhost:8025'
