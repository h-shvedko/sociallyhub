import { test, expect } from '@playwright/test'

// Configure test for visual regression
test.use({ 
  storageState: 'e2e/auth.json',
  viewport: { width: 1280, height: 720 }
})

test.describe('Visual Regression Tests', () => {
  test('landing page should match screenshot', async ({ page }) => {
    await page.goto('/')
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle')
    
    // Hide dynamic elements that might cause flaky tests
    await page.addStyleTag({
      content: `
        [data-testid="current-time"],
        [data-testid="live-metrics"],
        .animate-pulse {
          visibility: hidden !important;
        }
      `
    })
    
    await expect(page).toHaveScreenshot('landing-page.png')
  })

  test('dashboard overview should match screenshot', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Wait for charts to load
    await page.waitForSelector('[data-testid="analytics-chart"]', { timeout: 10000 })
    
    // Hide dynamic content
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="live-counter"],
        .animate-spin {
          visibility: hidden !important;
        }
      `
    })
    
    await expect(page).toHaveScreenshot('dashboard-overview.png')
  })

  test('posts list should match screenshot', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.waitForLoadState('networkidle')
    
    // Hide timestamps and other dynamic content
    await page.addStyleTag({
      content: `
        [data-testid="created-at"],
        [data-testid="updated-at"],
        [data-testid="relative-time"] {
          visibility: hidden !important;
        }
      `
    })
    
    await expect(page).toHaveScreenshot('posts-list.png')
  })

  test('calendar view should match screenshot', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await page.waitForLoadState('networkidle')
    
    // Set a fixed date for consistent calendar view
    await page.addInitScript(() => {
      // Mock Date to always return January 1, 2024
      const mockDate = new Date('2024-01-01T10:00:00Z')
      Date.now = jest.fn(() => mockDate.getTime())
      global.Date = jest.fn(() => mockDate)
      Object.assign(global.Date, Date)
    })
    
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('calendar-view.png')
  })

  test('analytics dashboard should match screenshot', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')
    
    // Wait for charts to render
    await page.waitForTimeout(2000)
    
    // Hide dynamic elements
    await page.addStyleTag({
      content: `
        [data-testid="last-updated"],
        [data-testid="real-time-data"],
        .recharts-tooltip-wrapper {
          visibility: hidden !important;
        }
      `
    })
    
    await expect(page).toHaveScreenshot('analytics-dashboard.png')
  })

  test('team management should match screenshot', async ({ page }) => {
    await page.goto('/dashboard/team')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('team-management.png')
  })

  test('post creation form should match screenshot', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.click('button:has-text("Create Post")')
    
    // Wait for dialog to open
    await page.waitForSelector('[data-testid="create-post-dialog"]')
    
    await expect(page).toHaveScreenshot('post-creation-form.png')
  })

  test('mobile responsive views should match screenshots', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Test mobile dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('mobile-dashboard.png')
    
    // Test mobile navigation
    await page.click('[data-testid="mobile-menu-toggle"]')
    await expect(page).toHaveScreenshot('mobile-navigation.png')
  })

  test('dark theme should match screenshots', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Switch to dark theme
    await page.click('[data-testid="theme-toggle"]')
    
    // Wait for theme to apply
    await page.waitForTimeout(500)
    
    await expect(page).toHaveScreenshot('dashboard-dark-theme.png')
  })

  test('empty states should match screenshots', async ({ page }) => {
    // Mock empty data responses
    await page.route('**/api/posts*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            posts: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
          }
        })
      })
    })
    
    await page.goto('/dashboard/posts')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('empty-posts-state.png')
  })

  test('loading states should match screenshots', async ({ page }) => {
    // Delay API responses to capture loading state
    await page.route('**/api/posts*', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { posts: [], pagination: {} }
          })
        })
      }, 3000)
    })
    
    await page.goto('/dashboard/posts')
    
    // Capture loading state
    await expect(page).toHaveScreenshot('posts-loading-state.png')
  })

  test('error states should match screenshots', async ({ page }) => {
    // Mock error responses
    await page.route('**/api/posts*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'internal_error',
          message: 'Failed to load posts'
        })
      })
    })
    
    await page.goto('/dashboard/posts')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('posts-error-state.png')
  })
})

test.describe('Component Visual Tests', () => {
  test('button variants should match screenshots', async ({ page }) => {
    await page.goto('/dashboard/posts')
    
    // Create a test page with all button variants
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div style="padding: 20px; background: white;">
          <div style="margin-bottom: 20px;">
            <button class="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md">Primary</button>
            <button class="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 rounded-md ml-2">Secondary</button>
            <button class="border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 rounded-md ml-2">Outline</button>
            <button class="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2 rounded-md ml-2">Destructive</button>
          </div>
          <div>
            <button class="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 py-1 rounded-md text-sm">Small</button>
            <button class="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 py-2 rounded-md ml-2">Large</button>
            <button class="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 rounded-md ml-2">🔍</button>
          </div>
        </div>
      `
    })
    
    await expect(page.locator('div')).toHaveScreenshot('button-variants.png')
  })

  test('form components should match screenshots', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.click('button:has-text("Create Post")')
    
    // Focus different form elements to show states
    await page.focus('textarea[name="content"]')
    
    await expect(page.locator('[data-testid="create-post-dialog"]')).toHaveScreenshot('form-components.png')
  })

  test('card components should match screenshots', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Isolate just the overview cards
    await page.evaluate(() => {
      const cards = document.querySelector('[data-testid="overview-cards"]')
      if (cards) {
        document.body.innerHTML = ''
        document.body.appendChild(cards)
      }
    })
    
    await expect(page.locator('body')).toHaveScreenshot('overview-cards.png')
  })
})