/**
 * Playwright global setup (ADR-0021 Track E).
 *
 * Deterministic and fail-fast:
 *   1. Waits for the app under test (GET /api/health) at the resolved base URL.
 *   2. Signs in as the E2E FIXTURE USER (e2e@sociallyhub.test) — NOT the demo
 *      user — and saves the session to e2e/.auth/user.json for specs to reuse
 *      via `test.use({ storageState: STORAGE_STATE })`.
 *
 * It does NOT seed the database (the old prisma/seed.ts require-fallback is
 * gone on purpose). If sign-in fails, the fixtures are missing and setup
 * aborts with the exact command to fix it: `npx tsx prisma/seed-e2e.ts`.
 *
 * Base URL: PLAYWRIGHT_BASE_URL wins (host dev server locally, compose stack
 * in CI), falling back to the config's use.baseURL. All navigations are built
 * with `new URL(path, baseURL)` — never a relative goto through this path
 * (the relative form crashed the first live CI run).
 */
import { chromium, request, FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { E2E_USER } from './fixtures'

const SEED_HINT = 'run: npx tsx prisma/seed-e2e.ts'

async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    (config.projects[0]?.use?.baseURL as string | undefined) ||
    'http://localhost:3099'

  console.log(`🚀 e2e global setup — app under test: ${baseURL}`)

  // 1) Wait for the app: /api/health responds 200 (healthy) or 503 (degraded,
  //    e.g. worker down — still fine for UI tests). Anything else keeps polling.
  const api = await request.newContext()
  const healthUrl = new URL('/api/health', baseURL).toString()
  let healthy = false
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = await api.get(healthUrl, { timeout: 5_000 })
      if (res.status() === 200 || res.status() === 503) {
        console.log(`✅ /api/health responded ${res.status()}`)
        healthy = true
        break
      }
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
  await api.dispose()
  if (!healthy) {
    throw new Error(
      `App at ${baseURL} never answered GET /api/health with 200/503. ` +
        'Is the server running (dev server / compose stack)?'
    )
  }

  // 2) Sign in as the fixture user and persist storage state.
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(new URL('/auth/signin', baseURL).toString())
    await page.fill('#email', E2E_USER.email)
    await page.fill('#password', E2E_USER.password)
    await page.click('button[type="submit"]')

    try {
      await page.waitForURL('**/dashboard', { timeout: 20_000 })
    } catch {
      throw new Error(
        `E2E fixture sign-in failed for ${E2E_USER.email} at ${baseURL}. ` +
          `The e2e fixtures are probably not seeded — ${SEED_HINT}`
      )
    }

    const statePath = path.join(__dirname, '.auth', 'user.json')
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    await page.context().storageState({ path: statePath })
    console.log(`✅ Authenticated as ${E2E_USER.email}; storage state → ${statePath}`)
  } finally {
    await browser.close()
  }

  console.log('✅ e2e global setup completed')
}

export default globalSetup
