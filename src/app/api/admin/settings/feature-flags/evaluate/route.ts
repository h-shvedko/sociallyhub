import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import {
  evaluateFeatureFlag,
  evaluateFlagRules,
  parsePrerequisiteKeys,
} from '@/lib/feature-flags/db'

// POST /api/admin/settings/feature-flags/evaluate - Evaluate feature flags
export async function POST(request: NextRequest) {
  try {
    // ADR-0004/ADR-0005: evaluation requires a session — 401 otherwise.
    // Authentication precedes body parsing (docs/api-conventions.md §1).
    const user = await requireSession()

    // Body-supplied userId/workspaceId overrides are honored ONLY for
    // platform admins; everyone else evaluates as themselves.
    let isPlatformAdmin = true
    try {
      await requirePlatformAdmin()
    } catch {
      isPlatformAdmin = false
    }

    const body = await request.json()

    const {
      workspaceId,
      userId: targetUserId,
      flagKeys,
      context = {}
    } = body

    // Validate required fields
    if (!flagKeys || !Array.isArray(flagKeys) || flagKeys.length === 0) {
      return NextResponse.json(
        { error: 'flagKeys array is required' },
        { status: 400 }
      )
    }

    const evaluationUserId = isPlatformAdmin ? (targetUserId || user.id) : user.id
    const effectiveWorkspaceId = isPlatformAdmin ? (workspaceId || null) : null
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined

    // Get flags to evaluate
    const flags = await prisma.featureFlag.findMany({
      where: {
        key: { in: flagKeys },
        workspaceId: effectiveWorkspaceId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    // Evaluate each flag. The per-flag targeting rules live in ONE place
    // (`evaluateFlagRules`, shared with the server-side `evaluateFeatureFlag`
    // helper); this route additionally writes the audit row + bumps the
    // evaluation count. Prerequisites are checked FIRST and fail closed.
    const evaluations = await Promise.all(
      flagKeys.map(async (key: string) => {
        const flag = flags.find(f => f.key === key)

        if (!flag) {
          return {
            key,
            result: false,
            variant: null,
            reason: 'OFF',
            flag: null
          }
        }

        // Real prerequisite check (ADR-0016): every prerequisite flag must
        // itself evaluate true (in the SAME context). If any is false the
        // dependent flag is forced off with PREREQUISITE_NOT_MET; a cyclic
        // prerequisite graph fails closed with PREREQUISITE_CYCLE.
        let evaluation: { result: boolean; variant: string | null; reason: string }
        const prereqKeys = parsePrerequisiteKeys(flag.prerequisites)
        let prereqFailure: string | null = null
        for (const prereqKey of prereqKeys) {
          const pre = await evaluateFeatureFlag(prereqKey, {
            userId: evaluationUserId,
            workspaceId: flag.workspaceId,
            context
          })
          if (!pre.result) {
            prereqFailure =
              pre.reason === 'PREREQUISITE_CYCLE'
                ? 'PREREQUISITE_CYCLE'
                : 'PREREQUISITE_NOT_MET'
            break
          }
        }

        if (prereqFailure) {
          evaluation = { result: false, variant: null, reason: prereqFailure }
        } else {
          evaluation = evaluateFlagRules(flag, { userId: evaluationUserId, context })
        }

        // Record evaluation in database
        try {
          await prisma.featureFlagEvaluation.create({
            data: {
              flagId: flag.id,
              userId: evaluationUserId,
              workspaceId: flag.workspaceId,
              sessionId: context.sessionId,
              ipAddress,
              userAgent,
              result: evaluation.result,
              variant: evaluation.variant,
              reason: evaluation.reason,
              metadata: context,
              geoLocation: context.country,
              userRole: context.userRole,
              userSegment: context.userSegment,
              deviceType: context.deviceType,
              referrer: context.referrer
            }
          })

          // Update flag evaluation count and last evaluated time
          await prisma.featureFlag.update({
            where: { id: flag.id },
            data: {
              lastEvaluated: new Date(),
              evaluationCount: { increment: 1 }
            }
          })
        } catch (evalError) {
          console.error('Failed to record evaluation:', evalError)
        }

        return {
          key: flag.key,
          result: evaluation.result,
          variant: evaluation.variant,
          reason: evaluation.reason,
          flag: {
            id: flag.id,
            name: flag.name,
            category: flag.category,
            environment: flag.environment
          }
        }
      })
    )

    return NextResponse.json({
      evaluations,
      timestamp: new Date().toISOString(),
      context: {
        userId: evaluationUserId,
        workspaceId: effectiveWorkspaceId,
        ...context
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}