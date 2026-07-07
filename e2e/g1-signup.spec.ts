/**
 * Golden path g1 — signup → verification email (real SMTP → Mailhog) →
 * verify link → sign in → dashboard. (ADR-0021 Track E)
 *
 * Fully real: the app sends an actual email through the dev SMTP (Mailhog);
 * the test reads it back via the Mailhog API, follows the real verification
 * link, and signs in with the freshly created account. No mocks.
 *
 * Skipped when E2E_SKIP_EMAIL=1 (environments without a reachable Mailhog).
 * Mailhog API defaults to http://localhost:8025 — override with MAILHOG_URL.
 */
import { test, expect, APIRequestContext } from '@playwright/test'
import { MAILHOG_URL } from './fixtures'

test.skip(process.env.E2E_SKIP_EMAIL === '1', 'E2E_SKIP_EMAIL=1 — Mailhog not available')

/** Decode Mailhog's quoted-printable bodies enough to recover URLs. */
function decodeQuotedPrintable(body: string): string {
  return body.replace(/=\r?\n/g, '').replace(/=3D/gi, '=')
}

/** Poll the Mailhog search API for a message addressed to `email`. */
async function waitForVerificationEmail(
  request: APIRequestContext,
  email: string,
  timeoutMs = 30_000
): Promise<string> {
  const searchUrl = `${MAILHOG_URL}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await request.get(searchUrl)
    if (res.ok()) {
      const data = await res.json()
      for (const item of data.items ?? []) {
        const raw: string = item?.Content?.Body ?? ''
        const body = decodeQuotedPrintable(raw)
        const match = body.match(/\/auth\/verify-email\?token=[A-Za-z0-9-]+/)
        if (match) return match[0]
      }
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  throw new Error(
    `No verification email for ${email} arrived at Mailhog (${MAILHOG_URL}) within ${timeoutMs}ms`
  )
}

test('signup → verification email → verify → sign in → dashboard', async ({ page, request }) => {
  test.setTimeout(120_000)

  // Unique per run so the flow is deterministic and re-runnable.
  const email = `e2e-signup-${Date.now()}@sociallyhub.test`
  const password = 'E2eSignupPass123!'

  // --- Sign up ---
  await page.goto('/auth/signup')
  await page.fill('#name', 'E2E Signup User')
  await page.fill('#email', email)
  await page.fill('#workspaceName', 'E2E Signup Workspace')
  await page.fill('#password', password)
  await page.fill('#confirmPassword', password)
  await page.locator('#terms').click()
  await page.click('button[type="submit"]')

  // The API returns 201 with an "check your email" message.
  await expect(page.getByText(/check your email/i).first()).toBeVisible({ timeout: 20_000 })

  // --- Verification email really arrived at Mailhog ---
  const verifyPath = await waitForVerificationEmail(request, email)

  // --- Follow the verification link (relative path → respects baseURL) ---
  await page.goto(verifyPath)
  // REAL page behavior (first verify pass got this wrong): on success the page
  // renders an "Email Verified!" state with a "Continue to Sign In" BUTTON —
  // it does NOT auto-redirect (the redirect branch only fires from that
  // button's attempted auto-signin, falling back to signin?verified=true).
  await expect(page.getByText('Email Verified!')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /continue to sign in/i }).click()
  // The button attempts an auto sign-in → /dashboard, else /auth/signin?verified=true.
  await page.waitForURL(/\/auth\/signin|\/dashboard/, { timeout: 20_000 })

  // --- Sign in with the new, now-verified account (if not auto-signed-in) ---
  if (!page.url().includes('/dashboard')) {
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 20_000 })
  }

  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible({
    timeout: 15_000,
  })
})
