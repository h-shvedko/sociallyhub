/**
 * Golden path g7 — ADR-0020: report share links + client portal.
 *
 * Fixtures (prisma/seed-e2e.ts):
 *   - E2E_REPORT_COMPLETED: a COMPLETED ClientReport with a frozen data
 *     snapshot (impressions 12345 → renders "12,345").
 *   - E2E_PORTAL_USER: CLIENT_VIEWER member of e2e-workspace bound to
 *     e2e-client via UserWorkspace.clientId.
 *
 * G7a drives the real share flow end-to-end: dashboard → Reports tab →
 * "Share link" action → create → read the one-time URL from the dialog's
 * read-only input (inputValue(), never the clipboard) → open it in a fully
 * ANONYMOUS context and assert the snapshot renders. Unknown tokens 404.
 * G7b proves revocation is a uniform 404 (indistinguishable from unknown).
 * G7c signs in as the portal user through the real UI and walks the portal.
 *
 * ANONYMITY NOTE: @playwright/test applies config/use options (including a
 * describe-level storageState) to manually created contexts, so anonymous
 * contexts are created with an EXPLICIT empty storageState. Share tokens are
 * navigated via `new URL(path, baseURL)` so the spec keeps working when the
 * app's NEXTAUTH_URL differs from PLAYWRIGHT_BASE_URL (host dev server).
 */
import { test, expect } from '@playwright/test'
import {
  STORAGE_STATE,
  E2E_CLIENT,
  E2E_REPORT_COMPLETED,
  E2E_PORTAL_USER,
} from './fixtures'
import { waitForPageReady, expectNoAppCrash } from './test-helpers'

const EMPTY_STORAGE_STATE = { cookies: [], origins: [] }

/** The dialog/API return an absolute URL built from the SERVER's NEXTAUTH_URL;
 * extract the token and rebuild against the test-run baseURL. */
function sharePathFromUrl(shareUrl: string): string {
  const pathname = new URL(shareUrl).pathname
  expect(pathname, `share URL should be /share/reports/<token>: ${shareUrl}`).toMatch(
    /^\/share\/reports\/[A-Za-z0-9_-]+$/
  )
  return pathname
}

test.describe('G7a: share link', () => {
  test.use({ storageState: STORAGE_STATE })

  test('create in the UI, view the snapshot anonymously', async ({ page, browser, baseURL }) => {
    test.setTimeout(120_000)

    // 1) Reports tab of the clients dashboard shows the seeded COMPLETED report.
    await page.goto('/dashboard/clients')
    await waitForPageReady(page)
    await expectNoAppCrash(page)
    await page.getByRole('tab', { name: 'Reports' }).click()

    const reportCard = page
      .locator('div.rounded-xl.border.bg-card')
      .filter({ hasText: E2E_REPORT_COMPLETED.name })
      .first()
    await expect(reportCard).toBeVisible({ timeout: 20_000 })

    // 2) Open the card's action menu (trailing ghost icon button) → Share link.
    await reportCard.locator('button').last().click()
    await page.getByRole('menuitem', { name: 'Share link' }).click()

    const dialog = page.getByTestId('share-report-dialog')
    await expect(dialog).toBeVisible()

    // 3) Create the link and read the one-time URL from the read-only input.
    await dialog.getByTestId('create-share-link').click()
    const urlInput = dialog.getByTestId('share-url')
    await expect(urlInput).toBeVisible({ timeout: 15_000 })
    const shareUrl = await urlInput.inputValue()
    const sharePath = sharePathFromUrl(shareUrl)
    await expectNoAppCrash(page)

    // 4) Anonymous context (explicit empty storage state): snapshot renders.
    const anon = await browser.newContext({ storageState: EMPTY_STORAGE_STATE })
    try {
      const anonPage = await anon.newPage()
      await anonPage.goto(new URL(sharePath, baseURL).toString())
      await expect(anonPage.getByTestId('report-snapshot-header')).toBeVisible({
        timeout: 20_000,
      })
      await expect(anonPage.getByText(E2E_REPORT_COMPLETED.name).first()).toBeVisible()
      await expect(anonPage.getByText('Prepared for').first()).toBeVisible()
      await expect(anonPage.getByText(E2E_CLIENT.name).first()).toBeVisible()
      await expect(anonPage.getByText('12,345').first()).toBeVisible()
      await expect(anonPage.getByTestId('generated-on')).toBeVisible()
      await expectNoAppCrash(anonPage)
    } finally {
      await anon.close()
    }
  })

  test('unknown token is a 404', async ({ browser, baseURL }) => {
    const anon = await browser.newContext({ storageState: EMPTY_STORAGE_STATE })
    try {
      const anonPage = await anon.newPage()
      const response = await anonPage.goto(
        new URL(
          '/share/reports/definitely-not-a-real-token-aaaaaaaaaaaaaaaaaaaa',
          baseURL
        ).toString()
      )
      expect(response?.status()).toBe(404)
      await expect(anonPage.getByText(/could not be found/i).first()).toBeVisible()
    } finally {
      await anon.close()
    }
  })
})

test.describe('G7b: revoked link is a uniform 404', () => {
  test.use({ storageState: STORAGE_STATE })

  test('revoke via API, then anonymous access 404s', async ({ page, browser, baseURL }) => {
    test.setTimeout(60_000)

    // Create a second link through the real, authenticated API (the exact
    // endpoint the dialog submits to). page.request shares the session cookies.
    const createRes = await page.request.post(
      `/api/client-reports/${E2E_REPORT_COMPLETED.id}/share-links`,
      { data: {} }
    )
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = await createRes.json()
    const linkId: string | undefined = created?.shareLink?.id
    const token: string | undefined = created?.token
    expect(linkId, 'create response should contain shareLink.id').toBeTruthy()
    expect(token, 'create response should contain the one-time token').toBeTruthy()

    // Revoke it.
    const revokeRes = await page.request.delete(
      `/api/client-reports/${E2E_REPORT_COMPLETED.id}/share-links/${linkId}`
    )
    expect(revokeRes.status(), await revokeRes.text()).toBe(200)

    // Anonymous access to the revoked token: uniform 404, indistinguishable
    // from an unknown token.
    const anon = await browser.newContext({ storageState: EMPTY_STORAGE_STATE })
    try {
      const anonPage = await anon.newPage()
      const response = await anonPage.goto(
        new URL(`/share/reports/${token}`, baseURL).toString()
      )
      expect(response?.status()).toBe(404)
      await expect(anonPage.getByText(/could not be found/i).first()).toBeVisible()
    } finally {
      await anon.close()
    }
  })
})

test.describe('G7c: client portal', () => {
  // No storageState: this flow signs in as the CLIENT_VIEWER portal user
  // through the real UI (same steps as global-setup/g1).

  test('portal user signs in and reads the delivered report', async ({ page }) => {
    test.setTimeout(120_000)

    // 1) Sign in via the UI (the signin page always pushes to /dashboard).
    await page.goto('/auth/signin')
    await page.fill('#email', E2E_PORTAL_USER.email)
    await page.fill('#password', E2E_PORTAL_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 20_000 })

    // 2) Portal overview: shell + summary render.
    await page.goto('/portal')
    await waitForPageReady(page)
    await expect(page.getByTestId('portal-shell')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('portal-summary')).toBeVisible({ timeout: 20_000 })
    await expectNoAppCrash(page)

    // The portal shell is NOT the dashboard: no sidebar navigation.
    await expect(page.locator('a[href="/dashboard/settings"]')).toHaveCount(0)

    // 3) Delivered reports list shows the seeded COMPLETED report.
    await page.goto('/portal/reports')
    await waitForPageReady(page)
    const row = page
      .getByTestId('portal-report-row')
      .filter({ hasText: E2E_REPORT_COMPLETED.name })
      .first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expectNoAppCrash(page)

    // 4) Detail renders the same frozen snapshot component.
    await row.getByRole('link', { name: 'View report' }).click()
    await expect(page.getByTestId('metric-cards')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('12,345').first()).toBeVisible()
    await expectNoAppCrash(page)

    // 5) Default-deny (ADR-0020): the portal-only JWT claim + edge middleware
    // 403 every /api/* outside the allowlist — this is the regression test
    // the ADR demands ("the role appears in exactly one allowlist"). These
    // legacy routes check membership but not role, so without the middleware
    // gate they would answer 200 (the exact lateral-movement hole).
    for (const denied of [
      '/api/posts?workspaceId=e2e-workspace',
      '/api/clients',
      '/api/analytics/dashboard?workspaceId=e2e-workspace',
      '/api/campaigns',
      '/api/inbox',
      '/api/templates',
    ]) {
      const res = await page.request.get(denied)
      expect(res.status(), `${denied} must be 403 for a portal-only user`).toBe(403)
      expect((await res.json()).code, `${denied} deny must come from the middleware gate`).toBe(
        'PORTAL_ONLY'
      )
    }

    // ...while the allowlist keeps working for the same session.
    for (const allowed of ['/api/portal/summary', '/api/client-reports']) {
      const res = await page.request.get(allowed)
      expect(res.status(), `${allowed} must stay allowed for the portal user`).toBe(200)
    }
  })
})
