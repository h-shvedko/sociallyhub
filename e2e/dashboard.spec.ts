/**
 * Dashboard smoke — fixture-based and deterministic (ADR-0021 Track E).
 *
 * The old spec asserted a dozen data-testids that never existed and
 * "counts look big" heuristics. This version asserts only what the real
 * dashboard renders, against the e2e fixture user/workspace seeded by
 * prisma/seed-e2e.ts.
 */
import { test, expect } from '@playwright/test'
import { STORAGE_STATE, E2E_USER } from './fixtures'
import { waitForPageReady, expectNoAppCrash } from './test-helpers'

test.use({ storageState: STORAGE_STATE })

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await waitForPageReady(page)
  })

  test('greets the fixture user and renders real stat cards', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: new RegExp(`Welcome back, ${E2E_USER.firstName}`) })
    ).toBeVisible({ timeout: 20_000 })

    // Stat card titles from src/app/dashboard/page.tsx (values come from the DB)
    await expect(page.getByText('Posts This Month').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Connected Accounts').first()).toBeVisible()

    await expect(page.getByRole('button', { name: /compose post/i })).toBeVisible()
    await expectNoAppCrash(page)
  })

  test('navigates to the posts page', async ({ page }) => {
    await page.goto('/dashboard/posts')
    await expect(page).toHaveURL(/\/dashboard\/posts/)
    await waitForPageReady(page)
    await expectNoAppCrash(page)
  })

  test('navigates to the calendar page', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await expect(page).toHaveURL(/\/dashboard\/calendar/)
    await waitForPageReady(page)
    await expectNoAppCrash(page)
  })

  test('navigates to the analytics page', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await expect(page).toHaveURL(/\/dashboard\/analytics/)
    await waitForPageReady(page)
    await expectNoAppCrash(page)
  })
})
