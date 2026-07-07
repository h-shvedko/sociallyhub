import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config (ADR-0021 Track E — deterministic e2e).
 *
 * Default projects: `chromium` (golden-path + smoke specs in e2e/) and
 * `accessibility` (axe scans in e2e/accessibility/). Run them with:
 *
 *   npx playwright test --project=chromium --project=accessibility
 *   npx playwright test                       # same set (only these are defined)
 *
 * Prerequisites: a running app (dev server / compose stack) and the e2e
 * fixtures seeded once via `npx tsx prisma/seed-e2e.ts`.
 *
 * App under test:
 *   - PLAYWRIGHT_BASE_URL set  → that server is authoritative (host dev server
 *     on e.g. :3100 locally, the compose stack on :3099 in CI). No webServer
 *     is started.
 *   - CI                       → external server (docker-compose.ci.yml), no
 *     webServer here.
 *   - otherwise                → auto-start `npm run dev` on :3099 below.
 *
 * The old visual-regression and performance projects (and their spec dirs)
 * were deleted — they were theatrical, not deterministic. Cross-browser /
 * mobile projects are parked in the commented block at the bottom of
 * `projects` until the golden paths are stable enough to widen the matrix.
 */
export default defineConfig({
  testDir: './e2e',

  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  use: {
    /* PLAYWRIGHT_BASE_URL is authoritative when provided (see header note). */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3099',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    // Golden paths + smoke specs (e2e/*.spec.ts). The accessibility dir has
    // its own project below, so it is ignored here.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/accessibility/**'],
    },

    // Axe scans (chromium-only by design — see e2e/accessibility/).
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testDir: './e2e/accessibility',
    },

    /* Cross-browser / device matrix — intentionally disabled until the golden
     * paths are green and stable. Re-enable per ADR-0021 follow-up.
     *
     * { name: 'firefox',       use: { ...devices['Desktop Firefox'] } },
     * { name: 'webkit',        use: { ...devices['Desktop Safari'] } },
     * { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
     * { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
     * { name: 'Tablet',        use: { ...devices['iPad Pro'] } },
     */
  ],

  /* Global setup: waits for /api/health, signs in the e2e fixture user
   * (e2e@sociallyhub.test — seeded by prisma/seed-e2e.ts) and saves the
   * session to e2e/.auth/user.json for specs to reuse. Fails fast with the
   * seed command if the fixtures are missing. */
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  /* Server strategy:
   * - PLAYWRIGHT_BASE_URL set → that server is authoritative; never start or
   *   reuse anything else (prevents silently reusing the docker app on :3099
   *   when the tests were pointed at a host dev server).
   * - CI → external server (docker-compose.ci.yml boots the prod image and
   *   exports PLAYWRIGHT_BASE_URL).
   * - otherwise → start the local dev server. */
  webServer:
    process.env.CI || process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: 'npm run dev',
          port: 3099,
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },

  outputDir: 'test-results/',

  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  metadata: {
    project: 'SociallyHub',
    version: '1.0.0',
  },
})
