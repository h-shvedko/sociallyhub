import { test, expect } from '@playwright/test'
import { getTestHelpers, cleanupAfterTests } from './test-helpers'

test.describe('Dashboard with Seeded Test Data', () => {
  let testHelpers: ReturnType<typeof getTestHelpers>
  let testData: any

  test.beforeAll(async () => {
    testHelpers = getTestHelpers()
    
    // Verify we have test data
    const hasData = await testHelpers.hasTestData()
    if (!hasData) {
      throw new Error('Test database does not contain sufficient seeded data')
    }
    
    // Get test data for assertions
    testData = await testHelpers.getTestData()
    if (!testData) {
      throw new Error('Failed to retrieve test data from seeded database')
    }
    
    console.log(`✅ Test setup complete. Found ${testData.posts.length} posts, ${testData.socialAccounts.length} social accounts`)
  })

  test.afterAll(async () => {
    await cleanupAfterTests()
  })

  test('Dashboard loads with realistic analytics data', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Login with demo user
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard')
    await testHelpers.waitForDashboardData(page)
    
    // Assert that statistics show realistic data
    await testHelpers.assertRealisticData(page, '[data-testid="posts-count"]', 'number')
    await testHelpers.assertRealisticData(page, '[data-testid="total-reach"]', 'number')
    await testHelpers.assertRealisticData(page, '[data-testid="total-comments"]', 'number')
    await testHelpers.assertRealisticData(page, '[data-testid="connected-accounts"]', 'number')
    
    // Check that recent posts section shows real data
    const recentPosts = page.locator('[data-testid="recent-posts"]')
    await expect(recentPosts).toBeVisible()
    
    const postCards = page.locator('[data-testid="post-card"]')
    const postCount = await postCards.count()
    expect(postCount).toBeGreaterThan(0)
    
    // Verify posts have realistic content
    if (postCount > 0) {
      const firstPost = postCards.first()
      await testHelpers.assertRealisticData(firstPost.locator('[data-testid="post-content"]'))
      await testHelpers.assertRealisticData(firstPost.locator('[data-testid="post-date"]'), 'date')
    }
    
    // Check inbox section shows real interactions
    const inboxSection = page.locator('[data-testid="inbox-section"]')
    await expect(inboxSection).toBeVisible()
    
    const inboxItems = page.locator('[data-testid="inbox-item"]')
    const inboxCount = await inboxItems.count()
    expect(inboxCount).toBeGreaterThan(0)
    
    // Verify inbox items have realistic content
    if (inboxCount > 0) {
      const firstInboxItem = inboxItems.first()
      await testHelpers.assertRealisticData(firstInboxItem.locator('[data-testid="inbox-content"]'))
      await testHelpers.assertRealisticData(firstInboxItem.locator('[data-testid="inbox-author"]'))
    }
  })

  test('Analytics page displays real metrics from seeded data', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await testHelpers.waitForPageToLoad(page)
    
    // Check overview metrics
    await testHelpers.assertAnalyticsData(page)
    
    // Check that charts contain data
    const chartElements = page.locator('[data-testid="analytics-chart"]')
    const chartCount = await chartElements.count()
    expect(chartCount).toBeGreaterThan(0)
    
    // Verify real-time analytics section
    const realTimeSection = page.locator('[data-testid="realtime-analytics"]')
    await expect(realTimeSection).toBeVisible()
    
    // Check that custom dashboard functionality works with real data
    const customDashboard = page.locator('[data-testid="custom-dashboard"]')
    if (await customDashboard.isVisible()) {
      const widgets = page.locator('[data-testid="dashboard-widget"]')
      const widgetCount = await widgets.count()
      expect(widgetCount).toBeGreaterThan(0)
    }
  })

  test('Posts page shows seeded content with realistic data', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await testHelpers.waitForPageToLoad(page)
    
    // Check that posts table/grid loads
    const postsContainer = page.locator('[data-testid="posts-container"]')
    await expect(postsContainer).toBeVisible()
    
    const posts = page.locator('[data-testid="post-row"], [data-testid="post-card"]')
    const postCount = await posts.count()
    expect(postCount).toBeGreaterThan(0)
    
    // Verify posts have different statuses from seeded data
    const statuses = await page.locator('[data-testid="post-status"]').allTextContents()
    const uniqueStatuses = [...new Set(statuses)]
    expect(uniqueStatuses.length).toBeGreaterThan(1) // Should have multiple statuses
    
    // Check that engagement metrics are displayed
    if (postCount > 0) {
      const firstPost = posts.first()
      
      // Look for engagement metrics
      const engagementMetrics = firstPost.locator('[data-testid="post-engagement"], [data-testid="post-metrics"]')
      if (await engagementMetrics.count() > 0) {
        await testHelpers.assertRealisticData(engagementMetrics.first(), 'number')
      }
    }
  })

  test('Inbox page displays seeded social media interactions', async ({ page }) => {
    await page.goto('/dashboard/inbox')
    await testHelpers.waitForPageToLoad(page)
    
    // Check inbox items load
    const inboxContainer = page.locator('[data-testid="inbox-container"]')
    await expect(inboxContainer).toBeVisible()
    
    const inboxItems = page.locator('[data-testid="inbox-message"], [data-testid="inbox-item"]')
    const itemCount = await inboxItems.count()
    expect(itemCount).toBeGreaterThan(0)
    
    // Verify items have different platforms and sentiments
    const platforms = await page.locator('[data-testid="message-platform"], [data-testid="inbox-platform"]').allTextContents()
    const uniquePlatforms = [...new Set(platforms.filter(p => p.length > 0))]
    expect(uniquePlatforms.length).toBeGreaterThan(1) // Multiple platforms
    
    // Check sentiment indicators
    const sentiments = page.locator('[data-testid="message-sentiment"], [data-testid="sentiment-indicator"]')
    const sentimentCount = await sentiments.count()
    if (sentimentCount > 0) {
      // Should have different sentiment types
      const sentimentClasses = await sentiments.first().getAttribute('class')
      expect(sentimentClasses).toBeTruthy()
    }
  })

  test('Campaigns page shows seeded campaign data', async ({ page }) => {
    await page.goto('/dashboard/campaigns')
    await testHelpers.waitForPageToLoad(page)
    
    const campaignsContainer = page.locator('[data-testid="campaigns-container"]')
    await expect(campaignsContainer).toBeVisible()
    
    const campaigns = page.locator('[data-testid="campaign-card"], [data-testid="campaign-row"]')
    const campaignCount = await campaigns.count()
    expect(campaignCount).toBeGreaterThan(0)
    
    // Verify campaigns have realistic budget data
    if (campaignCount > 0) {
      const firstCampaign = campaigns.first()
      
      // Check for budget information
      const budgetInfo = firstCampaign.locator('[data-testid="campaign-budget"]')
      if (await budgetInfo.isVisible()) {
        await testHelpers.assertRealisticData(budgetInfo, 'number')
      }
      
      // Check campaign status
      const statusInfo = firstCampaign.locator('[data-testid="campaign-status"]')
      if (await statusInfo.isVisible()) {
        await testHelpers.assertRealisticData(statusInfo)
      }
    }
  })

  test('Client management shows seeded client data', async ({ page }) => {
    await page.goto('/dashboard/clients')
    await testHelpers.waitForPageToLoad(page)
    
    const clientsContainer = page.locator('[data-testid="clients-container"]')
    await expect(clientsContainer).toBeVisible()
    
    const clients = page.locator('[data-testid="client-card"], [data-testid="client-row"]')
    const clientCount = await clients.count()
    expect(clientCount).toBeGreaterThan(0)
    
    // Verify clients have realistic company information
    if (clientCount > 0) {
      const firstClient = clients.first()
      
      // Check company name
      const companyName = firstClient.locator('[data-testid="client-company"], [data-testid="company-name"]')
      if (await companyName.isVisible()) {
        await testHelpers.assertRealisticData(companyName)
      }
      
      // Check client status
      const clientStatus = firstClient.locator('[data-testid="client-status"]')
      if (await clientStatus.isVisible()) {
        await testHelpers.assertRealisticData(clientStatus)
      }
    }
  })

  test('Social accounts page shows connected platforms from seeded data', async ({ page }) => {
    await page.goto('/dashboard/accounts')
    await testHelpers.waitForPageToLoad(page)
    
    const accountsContainer = page.locator('[data-testid="accounts-container"]')
    await expect(accountsContainer).toBeVisible()
    
    const socialAccounts = page.locator('[data-testid="social-account"], [data-testid="account-card"]')
    const accountCount = await socialAccounts.count()
    expect(accountCount).toBeGreaterThan(0)
    
    // Verify different platforms are represented
    const platforms = await page.locator('[data-testid="account-platform"]').allTextContents()
    const uniquePlatforms = [...new Set(platforms)]
    expect(uniquePlatforms.length).toBeGreaterThan(1)
    
    // Check connection status
    const connectionStatuses = page.locator('[data-testid="connection-status"]')
    if (await connectionStatuses.count() > 0) {
      // Should have mix of connected and disconnected accounts
      const statuses = await connectionStatuses.allTextContents()
      expect(statuses.some(s => s.toLowerCase().includes('connected'))).toBe(true)
    }
  })
})