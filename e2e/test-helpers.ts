import { Page, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * Test helpers for Playwright E2E tests with seeded database
 */
export class TestHelpers {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Get test data from the seeded database
   */
  async getTestData() {
    try {
      // Get demo user and their workspace
      const demoUser = await this.prisma.user.findUnique({
        where: { email: 'demo@sociallyhub.com' },
        include: {
          workspaces: {
            include: {
              workspace: {
                include: {
                  posts: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                  },
                  socialAccounts: {
                    take: 3
                  },
                  clients: {
                    take: 3
                  },
                  campaigns: {
                    take: 3
                  }
                }
              }
            }
          }
        }
      })

      // Get some sample users for testing
      const sampleUsers = await this.prisma.user.findMany({
        take: 5,
        where: {
          email: { not: 'demo@sociallyhub.com' }
        }
      })

      // Get analytics data for dashboard tests
      const analyticsData = await this.prisma.analyticsMetric.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          post: true,
          socialAccount: true
        }
      })

      // Get inbox items for inbox tests
      const inboxItems = await this.prisma.inboxItem.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          socialAccount: true
        }
      })

      return {
        demoUser,
        workspace: demoUser?.workspaces[0]?.workspace,
        sampleUsers,
        analyticsData,
        inboxItems,
        posts: demoUser?.workspaces[0]?.workspace.posts || [],
        socialAccounts: demoUser?.workspaces[0]?.workspace.socialAccounts || [],
        clients: demoUser?.workspaces[0]?.workspace.clients || [],
        campaigns: demoUser?.workspaces[0]?.workspace.campaigns || []
      }
    } catch (error) {
      console.warn('Failed to get test data:', error)
      return null
    }
  }

  /**
   * Login with demo user credentials
   */
  async loginAsDemoUser(page: Page) {
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
  }

  /**
   * Wait for dashboard to load with real data
   */
  async waitForDashboardData(page: Page) {
    // Wait for statistics cards to load
    await expect(page.locator('[data-testid="stats-card"]').first()).toBeVisible({ timeout: 15000 })
    
    // Wait for any loading skeletons to disappear
    await page.waitForSelector('[data-testid="loading-skeleton"]', { state: 'hidden', timeout: 15000 }).catch(() => {
      // Ignore if no loading skeletons are found
    })
  }

  /**
   * Navigate to a specific dashboard section and wait for data
   */
  async navigateToDashboardSection(page: Page, section: string) {
    await page.click(`nav a[href="/dashboard/${section}"]`)
    await page.waitForURL(`/dashboard/${section}`)
    await this.waitForPageToLoad(page)
  }

  /**
   * Wait for any page to fully load
   */
  async waitForPageToLoad(page: Page, timeout = 15000) {
    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout })
    
    // Wait for any loading indicators to disappear
    await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout }).catch(() => {
      // Ignore if no loading indicators are found
    })
  }

  /**
   * Check if the database has sufficient test data
   */
  async hasTestData(): Promise<boolean> {
    try {
      const userCount = await this.prisma.user.count()
      const postCount = await this.prisma.post.count()
      const metricsCount = await this.prisma.analyticsMetric.count()
      
      return userCount >= 10 && postCount >= 50 && metricsCount >= 100
    } catch (error) {
      console.warn('Failed to check test data:', error)
      return false
    }
  }

  /**
   * Create test data for specific test scenarios
   */
  async createTestPost(workspaceId: string, userId: string) {
    return await this.prisma.post.create({
      data: {
        workspaceId,
        ownerId: userId,
        title: 'Test Post for E2E Testing',
        baseContent: 'This is a test post created during E2E testing. #test #e2e',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        tags: ['test', 'e2e']
      }
    })
  }

  /**
   * Clean up test-specific data after tests
   */
  async cleanupTestData() {
    try {
      // Remove any posts created specifically for testing
      await this.prisma.post.deleteMany({
        where: {
          title: { contains: 'Test Post for E2E Testing' }
        }
      })
    } catch (error) {
      console.warn('Failed to cleanup test data:', error)
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    await this.prisma.$disconnect()
  }

  /**
   * Assert that elements contain realistic test data
   */
  async assertRealisticData(page: Page, selector: string, expectedType: 'number' | 'text' | 'date' = 'text') {
    const element = page.locator(selector)
    await expect(element).toBeVisible()
    
    const text = await element.textContent()
    
    switch (expectedType) {
      case 'number':
        expect(text).toMatch(/\d+/)
        expect(parseInt(text?.replace(/[^\d]/g, '') || '0')).toBeGreaterThan(0)
        break
      case 'date':
        expect(text).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d+ (minute|hour|day|week|month)s? ago|today|yesterday/i)
        break
      case 'text':
        expect(text).toBeTruthy()
        expect(text?.length).toBeGreaterThan(3)
        break
    }
  }

  /**
   * Check if analytics data is realistic
   */
  async assertAnalyticsData(page: Page) {
    // Check that metric values are realistic (not obviously fake)
    const metrics = page.locator('[data-testid="metric-value"]')
    const count = await metrics.count()
    
    for (let i = 0; i < count; i++) {
      const metric = metrics.nth(i)
      const value = await metric.textContent()
      
      // Ensure metrics are not obviously fake (like 123, 456, etc.)
      expect(value).not.toBe('123')
      expect(value).not.toBe('456')
      expect(value).not.toBe('1000')
      expect(value).toMatch(/\d+/)
    }
  }
}

/**
 * Global test data instance
 */
let testHelpers: TestHelpers | null = null

export function getTestHelpers(): TestHelpers {
  if (!testHelpers) {
    testHelpers = new TestHelpers()
  }
  return testHelpers
}

/**
 * Cleanup function for test teardown
 */
export async function cleanupAfterTests() {
  if (testHelpers) {
    await testHelpers.cleanupTestData()
    await testHelpers.disconnect()
    testHelpers = null
  }
}