import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.use({ storageState: 'e2e/auth.json' })

test.describe('Accessibility Tests', () => {
  test('landing page should be accessible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('dashboard should be accessible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('posts page should be accessible', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.waitForLoadState('networkidle')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('form elements should have proper labels', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.click('button:has-text("Create Post")')
    
    // Check form has proper labels
    const textarea = page.locator('textarea[name="content"]')
    const textareaId = await textarea.getAttribute('id')
    const label = page.locator(`label[for="${textareaId}"]`)
    
    await expect(label).toBeVisible()
    
    // Check accessibility of the form
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="create-post-dialog"]')
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('keyboard navigation should work', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    const firstFocusable = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT']).toContain(firstFocusable)
    
    // Continue tabbing through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
    }
    
    // Should still have focus on a focusable element
    const currentFocused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(currentFocused)
  })

  test('color contrast should meet WCAG standards', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze()
    
    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    )
    
    expect(contrastViolations).toEqual([])
  })

  test('images should have alt text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check all images have alt attributes
    const imagesWithoutAlt = await page.locator('img:not([alt])').count()
    expect(imagesWithoutAlt).toBe(0)
    
    // Check no empty alt text on important images
    const importantImagesWithEmptyAlt = await page.locator('img[alt=""]:not([role="presentation"])').count()
    expect(importantImagesWithEmptyAlt).toBe(0)
  })

  test('headings should be properly structured', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Check heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
    
    // Should have at least one h1
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(1)
    
    // Run axe check for heading structure
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Tab to first focusable element
    await page.keyboard.press('Tab')
    
    // Check if focus indicator is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Check focus indicator styling exists
    const hasOutline = await focusedElement.evaluate(el => {
      const styles = window.getComputedStyle(el)
      return styles.outline !== 'none' && styles.outline !== '' ||
             styles.boxShadow !== 'none' ||
             styles.border !== styles.getPropertyValue('--unfocused-border') // Check if border changes
    })
    
    expect(hasOutline).toBeTruthy()
  })

  test('skip links should be available', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Press Tab to focus first element (should be skip link)
    await page.keyboard.press('Tab')
    
    const skipLink = page.locator('a[href="#main-content"], a[href="#main"]').first()
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeFocused()
      
      // Test skip link functionality
      await page.keyboard.press('Enter')
      const mainContent = page.locator('#main-content, #main, main').first()
      await expect(mainContent).toBeFocused()
    }
  })

  test('aria-live regions should be present for dynamic content', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Check for aria-live regions
    const liveRegions = page.locator('[aria-live]')
    const liveRegionCount = await liveRegions.count()
    
    // Should have at least one live region for notifications/updates
    expect(liveRegionCount).toBeGreaterThan(0)
    
    // Check live regions have appropriate values
    for (let i = 0; i < liveRegionCount; i++) {
      const liveValue = await liveRegions.nth(i).getAttribute('aria-live')
      expect(['polite', 'assertive']).toContain(liveValue)
    }
  })

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await page.waitForLoadState('networkidle')
    
    // Get all buttons
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      
      // Check if button has accessible name (text content, aria-label, or aria-labelledby)
      const hasText = await button.textContent().then(text => text?.trim().length > 0)
      const hasAriaLabel = await button.getAttribute('aria-label').then(label => label?.length > 0)
      const hasAriaLabelledBy = await button.getAttribute('aria-labelledby')
      
      const hasAccessibleName = hasText || hasAriaLabel || hasAriaLabelledBy
      
      if (!hasAccessibleName) {
        const buttonHtml = await button.innerHTML()
        console.warn(`Button without accessible name found: ${buttonHtml}`)
      }
      
      expect(hasAccessibleName).toBeTruthy()
    }
  })

  test('dark theme should be accessible', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Switch to dark theme
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForTimeout(500)
    
    // Run accessibility scan on dark theme
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    
    expect(accessibilityScanResults.violations).toEqual([])
  })
})