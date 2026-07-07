/**
 * E2E test helpers (ADR-0021 Track E).
 *
 * Deliberately thin and DB-free: the old TestHelpers class opened its own
 * PrismaClient and asserted "counts look big / numbers don't look fake"
 * heuristics — all of that is gone. Specs now assert against the exact
 * fixture rows written by prisma/seed-e2e.ts (constants in ./fixtures).
 */
import { Page, expect } from '@playwright/test'
import { E2E_USER } from './fixtures'

export * from './fixtures'

/**
 * Sign in through the real UI. Only for specs where sign-in itself is the
 * subject — everything else should reuse the storage state saved by
 * global-setup: `test.use({ storageState: STORAGE_STATE })`.
 */
export async function signInViaUI(
  page: Page,
  email: string = E2E_USER.email,
  password: string = E2E_USER.password
) {
  await page.goto('/auth/signin')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 20_000 })
}

/**
 * Assert the page did not crash: no Next.js error overlay / error boundary
 * text. Used after actions that are expected to fail HONESTLY at the API
 * level (e.g. replying via a stub social provider) without breaking the UI.
 */
export async function expectNoAppCrash(page: Page) {
  await expect(page.getByText('Application error: a client-side exception has occurred')).toHaveCount(0)
  // Next 15.5 `next dev` ALWAYS mounts a <nextjs-portal> (the dev-tools badge),
  // so asserting the portal's absence is unsatisfiable against a dev server
  // (every spec failed on it in the first verify pass). Assert only on an
  // actual ERROR DIALOG inside the portal — present on crashes, absent on the
  // idle badge — which also works unchanged against production builds (no
  // portal at all).
  await expect(page.locator('nextjs-portal [data-nextjs-dialog], nextjs-portal [role="dialog"]')).toHaveCount(0)
  await expect(page.getByText(/internal server error/i)).toHaveCount(0)
}

/** Wait for client-side data fetches to settle without heuristic sleeps. */
export async function waitForPageReady(page: Page, timeout = 15_000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // networkidle can be flaky with SSE (notifications stream) — non-fatal.
  })
}
