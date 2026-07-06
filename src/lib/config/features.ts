/**
 * Static feature-flag configuration — the shared deferral gate for
 * ADR-0013 (Community), ADR-0014 (Documentation management), and
 * ADR-0015 (Discord).
 *
 * These three subsystems are DEFERRED and KNOWN-BROKEN. They are gated OFF by
 * default and must stay off in production until their respective repair phases
 * ship (ADR-0013 Phase 3, ADR-0014 Phase 3, ADR-0015 Phase 3+). See
 * `.env.example` and each ADR for the un-defer criteria.
 *
 * Design constraints:
 *   - EDGE-SAFE. This module is imported by `src/middleware.ts`, which runs on
 *     the Next.js edge runtime. It therefore reads ONLY `process.env` and
 *     imports NOTHING (no Prisma, no ioredis, no `@/lib` helpers, no Node-only
 *     APIs). Keep it that way: a single node-only import here would break every
 *     API request the moment the edge runtime tries to evaluate the middleware.
 *   - Read once at module load. Flags are static deployment config, not runtime
 *     state; there is deliberately no DB-backed `FeatureFlag` evaluation here
 *     (that is ADR-0016, not yet landed — gating dead code on other dead code
 *     would be circular).
 *
 * Flag semantics:
 *   - FEATURE_COMMUNITY        gates all `/api/community/**` routes + UI.
 *   - FEATURE_DOCS_MANAGEMENT  gates all `/api/documentation/**` routes + UI.
 *   - FEATURE_DISCORD          is a SUB-FLAG of FEATURE_COMMUNITY. Discord
 *     routes live under `/api/community/discord/**`, so they are already covered
 *     by the community gate. Discord is effectively enabled ONLY when BOTH
 *     FEATURE_DISCORD and FEATURE_COMMUNITY are on:
 *     `isFeatureEnabled('FEATURE_DISCORD')` returns `false` whenever
 *     FEATURE_COMMUNITY is off, regardless of the FEATURE_DISCORD env value.
 *
 * Each flag is `process.env.<VAR> === 'true'` and defaults to `false` when the
 * variable is unset or set to anything other than the exact string `'true'`.
 */

export const FEATURES = {
  FEATURE_COMMUNITY: process.env.FEATURE_COMMUNITY === 'true',
  FEATURE_DOCS_MANAGEMENT: process.env.FEATURE_DOCS_MANAGEMENT === 'true',
  FEATURE_DISCORD: process.env.FEATURE_DISCORD === 'true',
} as const

export type FeatureName = keyof typeof FEATURES

/**
 * Returns the EFFECTIVE enabled state of a feature flag, applying flag
 * dependencies.
 *
 * FEATURE_DISCORD is a sub-flag of FEATURE_COMMUNITY: it is only enabled when
 * its parent is also enabled. All other flags return their raw env value.
 */
export function isFeatureEnabled(name: FeatureName): boolean {
  if (name === 'FEATURE_DISCORD') {
    // Sub-flag: Discord requires Community to also be on.
    return FEATURES.FEATURE_DISCORD && FEATURES.FEATURE_COMMUNITY
  }
  return FEATURES[name]
}
