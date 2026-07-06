// ADR-0024 Phase 7 — knip "keep-it-clean" gate.
// Runs as a NON-BLOCKING report for one sprint (ADR-0024 risk mitigation);
// CI wiring happens in ADR-0022. Local usage: `npm run knip` / `npm run knip:prod`.
//
// Knip's Next.js plugin auto-detects next.config.js, src/middleware.ts and all
// src/app/** page/layout/route/template/not-found/error/loading entries;
// prisma/seed.ts is picked up from package.json "prisma.seed". The Playwright
// and Jest plugins normally pick up e2e/** and __tests__/** from their configs,
// but both configs transitively require devDependencies (@playwright/test,
// @next/bundle-analyzer via next.config.js) that may be absent in a partial
// node_modules — the explicit test entries below keep the report honest either
// way (they are harmless duplicates when the plugins load).
import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    // BullMQ worker process ("!" = production scope for `knip --production`;
    // otherwise it is only picked up from the package.json "worker" script,
    // which counts as a dev entry). KEEP despite the default-mode
    // "redundant entry pattern" hint — removing it makes `knip --production`
    // report src/worker.ts (and its dependency graph) as unused.
    'src/worker.ts!',
    // Operational one-off scripts (encryption migrations, auth checks, deploy/backup)
    'scripts/**/*.{ts,js}',
    // Standalone seeders invoked with tsx
    'src/scripts/**/*.ts',
    // Playwright e2e (fallback for when playwright.config.ts fails to load)
    'e2e/**/*.spec.ts',
    'e2e/global-setup.ts',
    'e2e/global-teardown.ts',
    // Jest unit tests (fallback for when jest.config.js fails to load)
    '__tests__/**/*.{ts,tsx}',
    'jest.setup.js',
  ],
  project: [
    'src/**/*.{ts,tsx}!',
    'scripts/**/*.{ts,js}',
    'prisma/**/*.ts',
    'e2e/**/*.ts',
    '__tests__/**/*.{ts,tsx}',
  ],
  ignore: [
    // Intentionally-unmounted UI layers: ADR-0018 will mount these.
    // Do NOT extend this list to silence real findings.
    'src/components/ai/**',
    'src/components/audience/**',
  ],
}

export default config
