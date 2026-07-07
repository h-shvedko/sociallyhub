/**
 * Golden path g4 — client reports: the seeded client renders, a report is
 * created for it from the seeded template, and it appears in the UI.
 * (ADR-0021 Track E)
 *
 * DETERMINISM NOTE: the multi-tab CreateReportDialog UI flow is deep (3 tabs,
 * template hydration, metric pickers) and was flaky to drive; per the track
 * brief ("deterministic > heroic") the report is created through the real API
 * (POST /api/client-reports) using the page's authenticated session cookies
 * (`page.request` shares the browser context's storage state), then asserted
 * in the UI after reload. The API is exactly what the dialog submits to.
 */
import { test, expect } from '@playwright/test'
import { STORAGE_STATE, E2E_CLIENT, E2E_REPORT_TEMPLATE } from './fixtures'
import { waitForPageReady, expectNoAppCrash } from './test-helpers'

test.use({ storageState: STORAGE_STATE })

test('seeded client renders and a created report appears in the Reports tab', async ({ page }) => {
  test.setTimeout(90_000)

  // 1) The clients dashboard renders the seeded fixture client.
  await page.goto('/dashboard/clients')
  await waitForPageReady(page)
  await expect(page.getByText(E2E_CLIENT.name).first()).toBeVisible({ timeout: 20_000 })

  // 2) Create a report for the fixture client via the real, authenticated API.
  const reportName = `E2E Report ${Date.now()}`
  const createRes = await page.request.post('/api/client-reports', {
    data: {
      clientId: E2E_CLIENT.id,
      templateId: E2E_REPORT_TEMPLATE.id,
      name: reportName,
      description: 'Deterministic e2e-created report',
      type: E2E_REPORT_TEMPLATE.type,
      format: 'PDF',
    },
  })
  expect(createRes.status(), await createRes.text()).toBeLessThan(300)
  const created = await createRes.json()
  const reportId: string | undefined = created?.report?.id ?? created?.id
  expect(reportId, 'create response should contain the new report id').toBeTruthy()

  // 3) The new report is visible in the Reports tab after reload.
  await page.reload()
  await waitForPageReady(page)
  await page.getByRole('tab', { name: 'Reports' }).click()
  await expect(page.getByText(reportName).first()).toBeVisible({ timeout: 20_000 })

  await expectNoAppCrash(page)
})
