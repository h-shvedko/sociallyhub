/**
 * Jest configuration (ADR-0021 Track C).
 *
 * KEY FIX: jest ignores top-level `transform`/`moduleNameMapper` when a
 * `projects` array is present — each project is a standalone config. The old
 * config only wrapped the (unused) top level with next/jest, so every project
 * ran WITHOUT Next's SWC transform and died on the first ESM import.
 *
 * Here nextJest() is applied to EACH project, so every project gets the
 * Next.js transform, env loading, and css/image mocks.
 *
 * Multi-project quirk: coverage options must live at the ROOT config, next to
 * `projects` — per-project coverage options are ignored.
 *
 * RATCHET RULE (ADR-0021): coverageThreshold is the HONEST measured baseline
 * (global floor rounded DOWN to integers; measured 2026-07-07 at ~2% for
 * statements/lines with ±0.2 run-to-run variance from DB-dependent API
 * suites, so the floor sits one notch below the measurement). Thresholds
 * only move UP, and must be raised in the same PR as the tests that justify
 * the raise. Lowering a threshold requires an ADR amendment — never a
 * drive-by edit.
 */
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** Options shared by every project. */
const shared = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Order matters: the more specific test-utils alias must precede '^@/'.
    // (In the old config this lived in a DUPLICATE moduleNameMapper key that
    // the second literal silently overwrote.)
    '^@/__tests__/(.*)$': '<rootDir>/__tests__/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // identity-obj-proxy is NOT installed; use a local stub. (next/jest also
    // ships its own css mocks — this mapping is a harmless backstop.)
    '\\.(css|less|scss|sass)$': '<rootDir>/__tests__/setup/style-stub.js',
  },
  clearMocks: true,
}

const projects = [
  {
    ...shared,
    displayName: 'Components',
    testEnvironment: 'jsdom',
    testEnvironmentOptions: { url: 'http://localhost:3099' },
    testMatch: ['<rootDir>/__tests__/components/**/*.(test|spec).(js|jsx|ts|tsx)'],
  },
  {
    ...shared,
    displayName: 'API',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/__tests__/api/**/*.(test|spec).(js|jsx|ts|tsx)'],
    // NOTE: `testTimeout` is global-scope only (invalid in a projects entry);
    // the API project's 20s budget lives in api-timeout.js instead.
    setupFilesAfterEnv: [...shared.setupFilesAfterEnv, '<rootDir>/__tests__/setup/api-timeout.js'],
  },
  {
    ...shared,
    displayName: 'Unit',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/__tests__/unit/**/*.(test|spec).(js|jsx|ts|tsx)'],
  },
]

/**
 * ESM-only node_modules that jest must transform (next/jest hardcodes
 * '/node_modules/' into transformIgnorePatterns and APPENDS user entries, so
 * loosening it requires post-processing the resolved config). Without this,
 * any import chain reaching next-auth's adapter dies on
 * "Unexpected token 'export'" (e.g. @auth/prisma-adapter).
 */
const ESM_MODULES = [
  '@auth',
  'next-auth',
  'jose',
  'openid-client',
  '@panva',
  'oauth4webapi',
  'uuid',
  'preact',
  'preact-render-to-string',
]

async function buildProject(p) {
  const resolved = await createJestConfig(p)()
  const esm = ESM_MODULES.join('|')
  resolved.transformIgnorePatterns = (resolved.transformIgnorePatterns || []).map((pattern) => {
    // Plain form (no transpilePackages in next.config).
    if (pattern === '/node_modules/') return `/node_modules/(?!(${esm})/)`
    // next/jest's transpilePackages forms:
    //   '/node_modules/(?!.pnpm)(?!(geist)/)' and '/node_modules/.pnpm/(?!(geist)@)'
    return pattern
      .replace(/\(\?!\(([^)]*)\)\/\)/, (_m, pkgs) => `(?!(${pkgs}|${esm})/)`)
      .replace(/\(\?!\(([^)]*)\)@\)/, (_m, pkgs) => `(?!(${pkgs}|${esm})@)`)
  })
  return resolved
}

module.exports = async () => ({
  projects: await Promise.all(projects.map(buildProject)),

  // Coverage (root-level only in multi-project mode).
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
    '!src/app/**/not-found.tsx',
    '!src/lib/prisma.ts',
    '!src/middleware.ts',
  ],
  coverageReporters: ['json', 'json-summary', 'lcov', 'text'],
  coverageDirectory: 'coverage',

  // RATCHET RULE: see header comment. Global = measured floor rounded down
  // (green on day one). encryption.ts is pinned at its measured level because
  // it is security-critical (ADR-0006) and already well-covered — do not let
  // it regress while the global floor is still near zero.
  coverageThreshold: {
    global: {
      statements: 1,
      branches: 1,
      functions: 1,
      lines: 1,
    },
    'src/lib/encryption.ts': {
      statements: 82,
      branches: 75,
      functions: 83,
      lines: 82,
    },
  },

  globalSetup: '<rootDir>/__tests__/setup/global-setup.js',
  globalTeardown: '<rootDir>/__tests__/setup/global-teardown.js',
})
