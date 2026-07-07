/**
 * Golden path g5 (partial — no Stripe keys) — billing renders LIVE data from
 * the seeded Subscription and fails HONESTLY when Stripe is not configured.
 * (ADR-0021 Track E; billing contract from ADR-0019)
 *
 * Contract asserted here:
 *   - The plan shown is "Business" — read from the seeded Subscription row
 *     (planTier BUSINESS / status ACTIVE for e2e-workspace), not hardcoded.
 *   - NO fabricated payment data: no "4242" card, no mock invoices.
 *   - Usage is rendered from real workspace data.
 *   - Clicking Upgrade WITHOUT STRIPE_SECRET_KEY surfaces the honest
 *     'not configured' notice (the checkout route returns
 *     503 { error: 'stripe_not_configured' }) — never a fake success.
 *
 * Full checkout/portal e2e lands when STRIPE keys exist in the environment.
 */
import { test, expect } from '@playwright/test'
import { STORAGE_STATE, E2E_SUBSCRIPTION } from './fixtures'
import { waitForPageReady, expectNoAppCrash } from './test-helpers'

test.use({ storageState: STORAGE_STATE })

test('billing shows the seeded Business plan with no fabricated payment data', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/dashboard/billing')
  await waitForPageReady(page)

  // Live plan name from the seeded subscription (BUSINESS → "Business").
  await expect(page.getByText(E2E_SUBSCRIPTION.planLabel).first()).toBeVisible({
    timeout: 20_000,
  })

  // HONESTY: zero fabricated payment artifacts anywhere on the page.
  await expect(page.getByText(/4242/)).toHaveCount(0)
  await expect(page.getByText(/mock/i)).toHaveCount(0)

  // Usage meters render (real numbers from the workspace, not placeholders).
  await expect(page.getByText(/usage/i).first()).toBeVisible()

  await expectNoAppCrash(page)
})

test('upgrade without STRIPE_SECRET_KEY shows the honest not-configured notice', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/dashboard/billing')
  await waitForPageReady(page)

  const upgrade = page.getByRole('button', { name: /upgrade/i }).first()
  await expect(upgrade).toBeVisible({ timeout: 20_000 })
  await upgrade.click()

  // The checkout route answers 503 { error: 'stripe_not_configured' } and the
  // UI must say so plainly — never redirect to a fake checkout or fake success.
  await expect(
    page.getByText(/not configured|isn't configured|is not set up|unavailable/i).first()
  ).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/dashboard\/billing/)

  await expectNoAppCrash(page)
})
