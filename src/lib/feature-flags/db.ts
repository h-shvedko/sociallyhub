/**
 * DB-backed feature-flag evaluation engine (ADR-0016 Phase 3).
 *
 * This module is the SINGLE source of truth for evaluating runtime/rollout
 * `FeatureFlag` rows (percentage rollout, user/group/geo/time targeting,
 * prerequisites). It lets server-side application code gate on a DB flag
 * WITHOUT an HTTP round-trip to `/api/admin/settings/feature-flags/evaluate`,
 * and the route itself delegates its per-flag rule logic here so the two can
 * never drift.
 *
 * ⚠️ This deliberately does NOT collide with ADR-0013's `isFeatureEnabled`
 * in `src/lib/config/features.ts`. That module is a STATIC, edge-safe
 * `process.env` gate that stays authoritative for the deferred, known-broken
 * community / documentation / discord subsystems. THIS module is a dynamic,
 * DB-backed engine for runtime rollout flags and is Node-only (it imports
 * Prisma) — never import it from `src/middleware.ts` or any edge code.
 *
 * Side-effect free: `evaluateFeatureFlag` performs only reads. Writing the
 * `FeatureFlagEvaluation` audit row + bumping `evaluationCount` is the job of
 * the HTTP audit path, NOT this helper — keep it fast and pure so it is cheap
 * to call on hot request paths.
 */

import { prisma } from '@/lib/prisma'

export interface FlagEvaluationResult {
  result: boolean
  variant: string | null
  reason: string
}

export interface EvaluationContext {
  userId?: string
  workspaceId?: string | null
  context?: Record<string, any>
}

/**
 * The minimal structural shape `evaluateFlagRules` needs. A Prisma
 * `FeatureFlag` row satisfies this, so it can be passed directly.
 */
export interface EvaluableFlag {
  key: string
  rolloutPercent: number
  defaultVariant?: string | null
  userTargeting?: unknown
  groupTargeting?: unknown
  geoTargeting?: unknown
  timeTargeting?: unknown
  prerequisites?: unknown
  expiresAt?: Date | string | null
}

/** Backstop against a pathological/cyclic prerequisite graph. */
const MAX_PREREQUISITE_DEPTH = 25

/**
 * Normalize the free-form `FeatureFlag.prerequisites` Json into a list of
 * prerequisite flag keys. Accepts either an array of string keys (the
 * documented shape) or an array of `{ key }` / `{ flagKey }` objects.
 * Anything else yields an empty list (no prerequisites).
 */
export function parsePrerequisiteKeys(prerequisites: unknown): string[] {
  if (!Array.isArray(prerequisites)) return []
  const keys: string[] = []
  for (const entry of prerequisites) {
    if (typeof entry === 'string') {
      if (entry.trim()) keys.push(entry)
    } else if (entry && typeof entry === 'object') {
      const k = (entry as any).key ?? (entry as any).flagKey
      if (typeof k === 'string' && k.trim()) keys.push(k)
    }
  }
  return keys
}

/**
 * Pure, side-effect-free evaluation of a SINGLE flag's targeting rules.
 *
 * This intentionally does NOT resolve prerequisites (that requires loading
 * OTHER flags and belongs in `evaluateFeatureFlag` / the HTTP route, which
 * gate on the outcome BEFORE calling this). It mirrors the exact rule order
 * the evaluate route has always used: expiry → time → user → group → geo →
 * percentage rollout → default-off.
 */
export function evaluateFlagRules(
  flag: EvaluableFlag,
  { userId, context = {} }: { userId?: string; context?: Record<string, any> }
): FlagEvaluationResult {
  const now = new Date()
  const variant = flag.defaultVariant ?? null

  // Expired flags are off.
  if (flag.expiresAt && now > new Date(flag.expiresAt)) {
    return { result: false, variant: null, reason: 'OFF' }
  }

  // Time-based targeting window.
  if (flag.timeTargeting) {
    const t = flag.timeTargeting as any
    if (t.startDate && now < new Date(t.startDate)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
    if (t.endDate && now > new Date(t.endDate)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
  }

  // User targeting (explicit include/exclude lists).
  if (flag.userTargeting && userId) {
    const u = flag.userTargeting as any
    if (u.include && u.include.includes(userId)) {
      return { result: true, variant, reason: 'TARGET_MATCH' }
    }
    if (u.exclude && u.exclude.includes(userId)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
  }

  // Group / role targeting.
  if (flag.groupTargeting && context.userRole) {
    const g = flag.groupTargeting as any
    if (g.include && g.include.includes(context.userRole)) {
      return { result: true, variant, reason: 'TARGET_MATCH' }
    }
    if (g.exclude && g.exclude.includes(context.userRole)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
  }

  // Geographic targeting.
  if (flag.geoTargeting && context.country) {
    const geo = flag.geoTargeting as any
    if (geo.include && !geo.include.includes(context.country)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
    if (geo.exclude && geo.exclude.includes(context.country)) {
      return { result: false, variant: null, reason: 'OFF' }
    }
  }

  // Deterministic percentage rollout (stable per flag.key + user).
  if (flag.rolloutPercent > 0) {
    let hash = 0
    const key = `${flag.key}:${userId || 'anonymous'}`
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i)
      hash = hash & hash // Convert to 32-bit integer
    }
    const percentage = Math.abs(hash) % 100
    const isIncluded = percentage < flag.rolloutPercent
    return {
      result: isIncluded,
      variant,
      reason: isIncluded ? 'PERCENT_ROLLOUT' : 'OFF',
    }
  }

  // No targeting rule applied → default off.
  return { result: false, variant: null, reason: 'DEFAULT' }
}

/**
 * Evaluate a DB feature flag by key for the given context, WITHOUT an HTTP
 * round-trip and WITHOUT writing an audit row.
 *
 * Loads the active, non-expired `FeatureFlag` for `(key, workspaceId ?? null)`,
 * enforces prerequisites (see below), then applies `evaluateFlagRules`.
 *
 * Prerequisite semantics (the real check — ADR-0016):
 *   - `flag.prerequisites` is a list of other flag keys that must themselves
 *     evaluate `true` (in the SAME context) for this flag to be on.
 *   - If ANY prerequisite evaluates false → `{ result:false,
 *     reason:'PREREQUISITE_NOT_MET' }` (fail closed).
 *   - Prerequisites are expected to form a DAG. A cycle fails closed with
 *     `{ result:false, reason:'PREREQUISITE_CYCLE' }` (guarded by a visited-set
 *     plus a depth cap as a backstop).
 *   - A prerequisite key with no matching active flag evaluates false → the
 *     dependent flag is `PREREQUISITE_NOT_MET`.
 */
export async function evaluateFeatureFlag(
  key: string,
  ctx: EvaluationContext
): Promise<FlagEvaluationResult> {
  return evaluateFeatureFlagInternal(key, ctx, new Set<string>(), 0)
}

async function evaluateFeatureFlagInternal(
  key: string,
  ctx: EvaluationContext,
  visited: Set<string>,
  depth: number
): Promise<FlagEvaluationResult> {
  // Cycle / runaway-depth guard — fail closed.
  if (visited.has(key) || depth > MAX_PREREQUISITE_DEPTH) {
    return { result: false, variant: null, reason: 'PREREQUISITE_CYCLE' }
  }

  const workspaceId = ctx.workspaceId ?? null

  const flag = await prisma.featureFlag.findFirst({
    where: {
      key,
      workspaceId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  // No active flag for this key → off (so a dependent flag is NOT_MET).
  if (!flag) {
    return { result: false, variant: null, reason: 'OFF' }
  }

  // Real prerequisite check.
  const prereqKeys = parsePrerequisiteKeys(flag.prerequisites)
  if (prereqKeys.length > 0) {
    const nextVisited = new Set(visited)
    nextVisited.add(key)
    for (const prereqKey of prereqKeys) {
      const pre = await evaluateFeatureFlagInternal(
        prereqKey,
        ctx,
        nextVisited,
        depth + 1
      )
      if (!pre.result) {
        // Propagate a cycle as a cycle; anything else is simply unmet.
        return {
          result: false,
          variant: null,
          reason:
            pre.reason === 'PREREQUISITE_CYCLE'
              ? 'PREREQUISITE_CYCLE'
              : 'PREREQUISITE_NOT_MET',
        }
      }
    }
  }

  return evaluateFlagRules(flag, { userId: ctx.userId, context: ctx.context })
}
