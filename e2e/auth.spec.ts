/**
 * Authentication golden path (deterministic, fixture-based — ADR-0021 Track E).
 *
 * Uses the e2e fixture user seeded by prisma/seed-e2e.ts. Sign-in IS the
 * subject here, so no storageState. The old spec asserted selectors that never
 * existed (input[name=...], rememberMe, testids) — the signin form exposes
 * #email / #password only.
 */
import { test, expect } from '@playwright/test'
import { E2E_USER } from './fixtures'

test.describe('Sign in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin')
  })

  test('renders the sign-in form', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('rejects invalid credentials with an honest error', async ({ page }) => {
    await page.fill('#email', 'nobody@sociallyhub.test')
    await page.fill('#password', 'definitely-wrong')
    await page.click('button[type="submit"]')

    // Exact copy from src/app/auth/signin/page.tsx
    await expect(page.getByText('Invalid credentials. Please try again.')).toBeVisible()
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('signs in the e2e fixture user and lands on the dashboard', async ({ page }) => {
    await page.fill('#email', E2E_USER.email)
    await page.fill('#password', E2E_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/dashboard', { timeout: 20_000 })
    // Dashboard greets the fixture user by first name
    await expect(
      page.getByRole('heading', { name: new RegExp(`Welcome back, ${E2E_USER.firstName}`) })
    ).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Protected routes', () => {
  test('redirects unauthenticated /dashboard to /auth/signin', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/signin/)
  })
})
