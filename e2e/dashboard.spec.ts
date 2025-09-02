import { test, expect } from '@playwright/test'

// Use authentication state for all tests in this file
test.use({ storageState: 'e2e/auth.json' })

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('should display dashboard overview', async ({ page }) => {
    // Check page title and main elements
    await expect(page.locator('h1')).toContainText('Dashboard')
    
    // Check overview cards are present
    await expect(page.locator('[data-testid="total-users-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="active-users-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-posts-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-engagement-card"]')).toBeVisible()
  })

  test('should display navigation menu', async ({ page }) => {
    // Check main navigation items
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('text=Posts')).toBeVisible()
    await expect(page.locator('text=Calendar')).toBeVisible()
    await expect(page.locator('text=Analytics')).toBeVisible()
    await expect(page.locator('text=Team')).toBeVisible()
  })

  test('should navigate to posts page', async ({ page }) => {
    await page.click('text=Posts')
    await expect(page).toHaveURL('/dashboard/posts')
    await expect(page.locator('h1')).toContainText('Posts')
  })

  test('should navigate to calendar page', async ({ page }) => {
    await page.click('text=Calendar')
    await expect(page).toHaveURL('/dashboard/calendar')
    await expect(page.locator('h1')).toContainText('Calendar')
  })

  test('should navigate to analytics page', async ({ page }) => {
    await page.click('text=Analytics')
    await expect(page).toHaveURL('/dashboard/analytics')
    await expect(page.locator('h1')).toContainText('Analytics')
  })

  test('should toggle theme', async ({ page }) => {
    // Find and click theme toggle
    await page.click('[data-testid="theme-toggle"]')
    
    // Check if theme changed (dark mode applied)
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Toggle back to light mode
    await page.click('[data-testid="theme-toggle"]')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('should display user menu', async ({ page }) => {
    // Click user avatar/menu
    await page.click('[data-testid="user-menu"]')
    
    // Check menu items
    await expect(page.locator('text=Profile')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
    await expect(page.locator('text=Sign Out')).toBeVisible()
  })

  test('should show recent activity', async ({ page }) => {
    // Check if recent activity section exists
    const activitySection = page.locator('[data-testid="recent-activity"]')
    await expect(activitySection).toBeVisible()
    
    // Should have activity items or empty state
    const hasActivities = await page.locator('[data-testid="activity-item"]').count()
    const hasEmptyState = await page.locator('text=No recent activity').count()
    
    expect(hasActivities > 0 || hasEmptyState > 0).toBeTruthy()
  })

  test('should display workspace information', async ({ page }) => {
    // Check workspace name is displayed
    await expect(page.locator('[data-testid="workspace-name"]')).toBeVisible()
    
    // Check workspace switcher if multiple workspaces
    const workspaceSwitcher = page.locator('[data-testid="workspace-switcher"]')
    if (await workspaceSwitcher.isVisible()) {
      await workspaceSwitcher.click()
      await expect(page.locator('[data-testid="workspace-menu"]')).toBeVisible()
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Navigation should be collapsed on mobile
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible()
    
    // Click mobile menu toggle
    await page.click('[data-testid="mobile-menu-toggle"]')
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible()
    
    // Overview cards should stack vertically
    const cards = page.locator('[data-testid*="-card"]')
    const firstCard = cards.first()
    const secondCard = cards.nth(1)
    
    const firstCardBox = await firstCard.boundingBox()
    const secondCardBox = await secondCard.boundingBox()
    
    // Second card should be below first card (stacked)
    expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height - 10)
  })
})

test.describe('Posts Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/posts')
  })

  test('should display posts list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Posts')
    
    // Should have posts table or empty state
    const hasPosts = await page.locator('[data-testid="posts-table"]').count()
    const hasEmptyState = await page.locator('text=No posts yet').count()
    
    expect(hasPosts > 0 || hasEmptyState > 0).toBeTruthy()
  })

  test('should open create post dialog', async ({ page }) => {
    await page.click('button:has-text("Create Post")')
    
    // Should open post creation dialog
    await expect(page.locator('[data-testid="create-post-dialog"]')).toBeVisible()
    await expect(page.locator('textarea[name="content"]')).toBeVisible()
    await expect(page.locator('[data-testid="platform-selector"]')).toBeVisible()
  })

  test('should filter posts by status', async ({ page }) => {
    // Click status filter
    await page.click('[data-testid="status-filter"]')
    await page.click('text=Published')
    
    // URL should include filter parameter
    await expect(page).toHaveURL(/status=published/)
    
    // Posts should be filtered (if any exist)
    const posts = page.locator('[data-testid="post-item"]')
    const count = await posts.count()
    
    if (count > 0) {
      // All visible posts should have "Published" status
      for (let i = 0; i < count; i++) {
        await expect(posts.nth(i).locator('[data-testid="post-status"]')).toContainText('Published')
      }
    }
  })

  test('should search posts', async ({ page }) => {
    const searchInput = page.locator('[data-testid="posts-search"]')
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test post content')
      await page.keyboard.press('Enter')
      
      // URL should include search parameter
      await expect(page).toHaveURL(/search=test\+post\+content/)
    }
  })
})

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/calendar')
  })

  test('should display calendar interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Calendar')
    
    // Should display calendar grid
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible()
    
    // Should have view toggles
    await expect(page.locator('button:has-text("Month")')).toBeVisible()
    await expect(page.locator('button:has-text("Week")')).toBeVisible()
    await expect(page.locator('button:has-text("Day")')).toBeVisible()
  })

  test('should switch calendar views', async ({ page }) => {
    // Switch to week view
    await page.click('button:has-text("Week")')
    await expect(page.locator('[data-testid="week-view"]')).toBeVisible()
    
    // Switch to day view
    await page.click('button:has-text("Day")')
    await expect(page.locator('[data-testid="day-view"]')).toBeVisible()
    
    // Switch back to month view
    await page.click('button:has-text("Month")')
    await expect(page.locator('[data-testid="month-view"]')).toBeVisible()
  })

  test('should navigate between months', async ({ page }) => {
    // Get current month
    const currentMonth = await page.locator('[data-testid="current-month"]').textContent()
    
    // Click next month
    await page.click('[data-testid="next-month"]')
    const nextMonth = await page.locator('[data-testid="current-month"]').textContent()
    
    expect(nextMonth).not.toBe(currentMonth)
    
    // Click previous month
    await page.click('[data-testid="prev-month"]')
    const prevMonth = await page.locator('[data-testid="current-month"]').textContent()
    
    expect(prevMonth).toBe(currentMonth)
  })

  test('should create post from calendar', async ({ page }) => {
    // Click on a calendar date
    await page.click('[data-testid="calendar-date"]:first-child')
    
    // Should open scheduling dialog
    await expect(page.locator('[data-testid="schedule-post-dialog"]')).toBeVisible()
  })
})

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/analytics')
  })

  test('should display analytics overview', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Analytics')
    
    // Should display analytics cards
    await expect(page.locator('[data-testid="analytics-overview"]')).toBeVisible()
    
    // Should display charts
    await expect(page.locator('[data-testid="engagement-chart"]')).toBeVisible()
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible()
  })

  test('should change date range', async ({ page }) => {
    // Click date range selector
    await page.click('[data-testid="date-range-selector"]')
    
    // Select different range
    await page.click('text=Last 30 days')
    
    // Charts should update (loading indicator or new data)
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible()
  })

  test('should export analytics data', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export")')
    ])
    
    expect(download.suggestedFilename()).toMatch(/analytics.*\.(csv|pdf|xlsx)/)
  })
})