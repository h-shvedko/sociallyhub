/**
 * Golden path g6 — AI availability contract in the UI (ADR-0018 Track E).
 *
 * The dev/e2e server normally has a REAL OPENAI_API_KEY (provider 'openai').
 * COST RULE: this spec must NEVER trigger an actual OpenAI generation — it
 * asserts presence/gating states only (status endpoint, tabs, toggles).
 *
 * Env-adaptive: every UI assertion first reads GET /api/ai/status and
 * branches — provider 'none' environments assert the HONEST unavailable
 * behavior (503 AI_UNAVAILABLE gating / unavailable notice) instead of the
 * available UI. A clear 503 beats a fabricated prediction.
 */
import { test, expect, type Page } from '@playwright/test'
import { STORAGE_STATE } from './fixtures'
import { waitForPageReady, expectNoAppCrash } from './test-helpers'

test.use({ storageState: STORAGE_STATE })

interface AIStatus {
  available: boolean
  provider: 'openai' | 'mock' | 'none'
  model?: string
  reason?: string
}

async function readAIStatus(page: Page): Promise<AIStatus> {
  const res = await page.request.get('/api/ai/status')
  expect(res.status(), 'GET /api/ai/status must answer 200 for a signed-in user').toBe(200)
  return (await res.json()) as AIStatus
}

test('GET /api/ai/status reports the provider truthfully; provider none gates AI routes with 503', async ({ page }) => {
  const status = await readAIStatus(page)

  if (status.provider === 'none') {
    // Keyless, non-demo environment: availability must be reported honestly
    // and every /api/ai/** route must refuse work with the contract 503.
    expect(status.available).toBe(false)
    const gated = await page.request.post('/api/ai/tone/analyze', {
      data: { content: 'Availability gating check — must not reach a provider.' },
    })
    expect(gated.status()).toBe(503)
    const body = await gated.json()
    expect(body.error).toBe('AI_UNAVAILABLE')
  } else {
    // Dev server has a real key → expect 'openai' ('mock' only under
    // ENABLE_DEMO without a key). Never fire a generation to verify it.
    expect(status.available).toBe(true)
    expect(['openai', 'mock']).toContain(status.provider)
    expect(status.model).toBeTruthy()
  }
})

test('/dashboard/audience renders the audience tabs (or the honest unavailable state)', async ({ page }) => {
  test.setTimeout(90_000)
  const status = await readAIStatus(page)

  await page.goto('/dashboard/audience')
  await waitForPageReady(page)

  if (status.provider === 'none') {
    // HONESTY: no fake dashboards without a provider — an explicit
    // unavailable notice must render instead.
    await expect(
      page.getByText(/unavailable|OPENAI_API_KEY|AI features/i).first()
    ).toBeVisible({ timeout: 20_000 })
  } else {
    // THREE honest tabs. The former "Overview" (AudienceIntelligenceDashboard)
    // was intentionally NOT mounted and then DELETED: it consisted entirely of
    // hardcoded fabricated data (fake "125.4K" audience, invented per-platform
    // stats) — rendering it would violate the no-fabricated-data rule.
    await expect(page.getByRole('tab', { name: /segments/i }).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('tab', { name: /posting times/i }).first()).toBeVisible()
    await expect(page.getByRole('tab', { name: /sentiment/i }).first()).toBeVisible()
  }

  await expectNoAppCrash(page)
})

test('post composer exposes the AI Assistant toggle without firing a generation', async ({ page }) => {
  test.setTimeout(90_000)
  const status = await readAIStatus(page)

  await page.goto('/dashboard/posts')
  await waitForPageReady(page)

  // Open the composer (the page's "Create Post" button).
  await page.getByRole('button', { name: /create post/i }).first().click()
  await expect(page.getByText(/create new post/i).first()).toBeVisible({ timeout: 20_000 })

  // The AI Assistant toggle must exist. With a live provider it is enabled;
  // we assert presence/enabled state ONLY — clicking through to a generation
  // would spend real OpenAI tokens.
  const aiToggle = page.getByRole('button', { name: /ai assistant/i }).first()
  await expect(aiToggle).toBeVisible({ timeout: 20_000 })
  if (status.provider !== 'none') {
    await expect(aiToggle).toBeEnabled()
  }

  await expectNoAppCrash(page)
})

test('/dashboard/analytics Visual Insights tab is present and clickable', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/dashboard/analytics')
  await waitForPageReady(page)

  // Tab implementations vary (Radix tab vs button) — accept either role.
  const visualInsights = page
    .getByRole('tab', { name: /visual insights/i })
    .or(page.getByRole('button', { name: /visual insights/i }))
    .first()

  await expect(visualInsights).toBeVisible({ timeout: 20_000 })
  await visualInsights.click()
  await waitForPageReady(page)

  await expectNoAppCrash(page)
})
