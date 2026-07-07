/**
 * Golden path g8 — observability (ADR-0023).
 *
 * Proves the honest observability surface end-to-end:
 *   G8a  /api/health and /api/metrics expose real, correctly-shaped data with
 *        NO fabricated fields (no 'filesystem' health probe; a real 'worker'
 *        probe; the prom-client scrape carries the http + DB-gauge series).
 *   G8b  the monitoring dashboard renders REAL numbers (or an honest '—'),
 *        never the deleted hardcoded '99.9%' uptime lie.
 *   G8c  the campaigns analytics API never leaks fabricated audience
 *        demographics (no ageGroups / genders / locations distributions).
 *
 * The request-context parts (G8a, G8c) need no UI sign-in, so they prove green
 * even if the docker app hits the pre-existing next-auth/react chunk quirk on
 * the UI sign-in (ADR-0006/0017 note); G8b's UI sign-in is the only browser
 * step and re-runs cleanly on a host dev server.
 */
import { test, expect } from '@playwright/test'
import {
  STORAGE_STATE,
  E2E_ADMIN_USER,
  E2E_WORKSPACE,
} from './fixtures'
import { signInViaUI, waitForPageReady, expectNoAppCrash } from './test-helpers'

// ---------------------------------------------------------------------------
// G8a — health + metrics endpoints (no auth; METRICS_TOKEN unset in dev)
// ---------------------------------------------------------------------------
test.describe('G8a: health + metrics endpoints', () => {
  test('GET /api/health reports honest, correctly-shaped service probes', async ({
    request,
  }) => {
    const res = await request.get('/api/health')
    // Healthy in dev; degrades (503) rather than 500ing if a dep is down.
    expect([200, 503]).toContain(res.status())

    const body = await res.json()
    const services = body.services ?? {}

    // Real DB probe with a truthy status ('healthy'/'ok'/...), not fabricated.
    expect(services.database).toBeTruthy()
    expect(services.database.status).toBeTruthy()

    // The fabricated 'filesystem' probe was deleted (ADR-0023) — must be absent.
    expect(services).not.toHaveProperty('filesystem')

    // A real 'worker' probe exists ('disabled' unless WORKER_EXPECTED=true).
    expect(services).toHaveProperty('worker')
    expect(services.worker.status).toBeTruthy()
  })

  test('GET /api/metrics exposes the prom-client exposition', async ({
    request,
  }) => {
    const res = await request.get('/api/metrics')
    expect(res.status()).toBe(200)

    // Prometheus text exposition format.
    const contentType = res.headers()['content-type'] || ''
    expect(contentType).toContain('text')

    const text = await res.text()
    // The HTTP instrument (from withLogging → recordHttpMetric) …
    expect(text).toContain('http_requests_total')
    // … and the DB-backed gauge (async collect over the singleton prisma).
    expect(text).toContain('sociallyhub_users_total')
  })
})

// ---------------------------------------------------------------------------
// G8b — monitoring dashboard: real numbers, no fabricated 99.9% (platform admin)
// ---------------------------------------------------------------------------
test.describe('G8b: monitoring dashboard shows real numbers, no fabricated 99.9%', () => {
  test('renders an honest Uptime card and never the deleted 99.9% lie', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    // /dashboard/monitoring → /api/monitoring/metrics is platform-admin only,
    // so sign in as the platform-admin fixture (E2E_USER would get 403 there).
    await signInViaUI(page, E2E_ADMIN_USER.email, E2E_ADMIN_USER.password)

    await page.goto('/dashboard/monitoring')
    await waitForPageReady(page)
    await expectNoAppCrash(page)

    // HONESTY: the hardcoded '99.9%' uptime string is deleted — it must appear
    // nowhere on the page (uptime is now a real duration or an honest '—').
    await expect(page.locator('body')).not.toContainText('99.9%')

    // An Uptime card renders with a real value (a duration string) or '—'.
    await expect(page.getByText('Uptime', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    await expectNoAppCrash(page)
  })
})

// ---------------------------------------------------------------------------
// G8c — no fabricated audience demographics leak (authenticated via storageState)
// ---------------------------------------------------------------------------
test.describe('G8c: no fabricated demographics leak to the UI', () => {
  // Reuse the E2E_USER session (OWNER of E2E_WORKSPACE) saved by global-setup;
  // this needs no fresh UI sign-in.
  test.use({ storageState: STORAGE_STATE })

  test('/api/campaigns/analytics never returns ageGroups/genders/locations', async ({
    request,
  }) => {
    // Authenticated + scoped to the seeded workspace. The route intentionally
    // exposes only a real platform split (demographics.platforms) and OMITS
    // fabricated age/gender/location distributions (ADR-0023).
    const res = await request.get(
      `/api/campaigns/analytics?workspaceId=${E2E_WORKSPACE.id}`
    )

    // Resilient: assert on whatever the route returns (200 with data, or a
    // graceful 4xx if params/access differ) — the honesty invariant must hold
    // for ANY response body.
    const bodyText = await res.text()
    expect(bodyText).not.toContain('ageGroups')
    expect(bodyText).not.toContain('genders')
    expect(bodyText).not.toContain('locations')

    // When the call succeeds, tighten the assertion on the parsed shape.
    if (res.ok()) {
      const body = JSON.parse(bodyText)
      const demographics = body.demographics ?? {}
      expect(demographics).not.toHaveProperty('ageGroups')
      expect(demographics).not.toHaveProperty('genders')
      expect(demographics).not.toHaveProperty('locations')
    }
  })
})
