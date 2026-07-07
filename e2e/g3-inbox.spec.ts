/**
 * Golden path g3 — inbox: open the seeded fixture item, read it, attempt a
 * public reply. (ADR-0021 Track E)
 *
 * HONESTY NOTE (this is the current, intended behavior — not a bug):
 * the social providers are stubs with no real credentials (ADR-0009), so a
 * public reply CANNOT actually be sent. The reply API responds honestly with
 * `success: false` (provider not configured / provider send failed) instead
 * of fabricating a success. The REAL assertions here are:
 *   1. the seeded inbox item renders with its exact fixture content, and
 *   2. the reply attempt surfaces the honest failure at the API level
 *      WITHOUT crashing the page.
 * When real provider credentials exist, this spec should be extended to
 * assert a successful reply.
 */
import { test, expect } from '@playwright/test'
import { STORAGE_STATE, E2E_INBOX_ITEM_1 } from './fixtures'
import { expectNoAppCrash, waitForPageReady } from './test-helpers'

test.use({ storageState: STORAGE_STATE })

test('seeded inbox item renders; reply fails honestly without crashing', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/dashboard/inbox')
  await waitForPageReady(page)

  // 1) The fixture item is in the list with its exact seeded content.
  const item = page.getByText(E2E_INBOX_ITEM_1.content).first()
  await expect(item).toBeVisible({ timeout: 20_000 })

  // 2) Open it — the conversation/detail pane renders the fixture data.
  await item.click()
  await expect(page.getByText(E2E_INBOX_ITEM_1.authorName).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Quick Reply').first()).toBeVisible()

  // 3) Type a public reply and send it.
  const replyBox = page.getByPlaceholder('Type your reply...')
  await expect(replyBox).toBeVisible()
  await replyBox.fill('E2E reply attempt — expected to fail honestly (stub providers).')

  const [replyResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/inbox/') && res.url().includes('/reply'),
      { timeout: 20_000 }
    ),
    page.getByRole('button', { name: 'Send Reply' }).click(),
  ])

  // 4) HONEST failure: either a non-2xx status or a 200 with success:false —
  //    never a fabricated success (there are no real provider tokens).
  if (replyResponse.ok()) {
    const body = await replyResponse.json()
    expect(body.success).toBe(false)
    expect(String(body.error ?? '')).not.toHaveLength(0)
  } else {
    expect(replyResponse.status()).toBeGreaterThanOrEqual(400)
  }

  // 5) The app did not crash; the seeded item content is still rendered.
  await expectNoAppCrash(page)
  await expect(page.getByText(E2E_INBOX_ITEM_1.content).first()).toBeVisible()
})
