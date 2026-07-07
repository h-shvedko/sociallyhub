// Next.js instrumentation hook (ADR-0023 Phase 1 item 6 + Phase 4 item 16).
//
// LOCATION: this project uses a `src/` directory, so Next 15 auto-loads the
// instrumentation file from `src/instrumentation.ts` (a repo-root one is
// silently ignored when `src/` is present) — no config flag needed.
//
// RUNTIME GATING (prom-client): Next compiles this file for BOTH the Node and
// the Edge runtimes. prom-client uses Node built-ins (cluster/v8/fs), so the
// metrics init is nested inside a POSITIVE `process.env.NEXT_RUNTIME ===
// 'nodejs'` block. Next replaces NEXT_RUNTIME with a literal per compilation, so
// the Edge build sees `if ('edge' === 'nodejs')`, drops the block, and never
// bundles prom-client into the edge runtime. (A negative `!== 'nodejs'` early
// return does NOT tree-shake the later import — the positive block form does.)
// The metrics endpoint and withLogging both run in the Node runtime, so nothing
// is lost.
//
// SENTRY (ADR-0023 ruling #10): Sentry/GlitchTip is DORMANT without SENTRY_DSN —
// a keyless build/run MUST be a total no-op with no import cost, and
// `withSentryConfig` is deliberately NOT added to next.config.js (it would pull
// in the webpack source-map plugin unconditionally). A plain
// `await import('@sentry/nextjs')` cannot satisfy this here: merely referencing
// @sentry/nextjs in instrumentation makes Next evaluate the edge middleware's
// next-auth chunk during page-data collection (`ReferenceError: self is not
// defined`), breaking the build — the positive nodejs guard excludes
// prom-client from the edge bundle but NOT @sentry. So the Sentry imports carry
// `/* webpackIgnore: true */`: webpack never traces or bundles @sentry (true
// zero-cost no-op when the DSN is unset, and the edge build never sees it),
// while the DSN-gated call still resolves @sentry/nextjs from node_modules at
// runtime when error tracking is turned on. The try/catch keeps a missing
// module (e.g. not traced into a standalone image) from crashing the process.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservability } = await import('@/lib/observability/metrics')
    initObservability()

    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs')
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
          environment: process.env.NODE_ENV,
        })
      } catch {
        // @sentry/nextjs not resolvable (dormant / not traced) — stay silent.
      }
    }
  }
}

export async function onRequestError(...args: unknown[]): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs')
    const h = (Sentry as { captureRequestError?: (...a: unknown[]) => void })
      .captureRequestError
    if (typeof h === 'function') h(...args)
  } catch {
    // @sentry/nextjs not resolvable — never let error reporting throw.
  }
}
