import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// POST /api/admin/settings/feature-flags/evaluate - Evaluate feature flags
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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

    const evaluationUserId = targetUserId || (session ? normalizeUserId(session.user.id) : null)
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined

    // Get flags to evaluate
    const flags = await prisma.featureFlag.findMany({
      where: {
        key: { in: flagKeys },
        workspaceId: workspaceId || null,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    // Evaluation function
    const evaluateFlag = (flag: any, userId?: string): { result: boolean; variant?: string; reason: string } => {
      const now = new Date()

      // Check if flag is expired
      if (flag.expiresAt && now > flag.expiresAt) {
        return { result: false, reason: 'OFF' }
      }

      // Check prerequisites
      if (flag.prerequisites && flag.prerequisites.length > 0) {
        // In a real implementation, you'd check other flags
        // For now, assume prerequisites are met
      }

      // Time-based targeting
      if (flag.timeTargeting) {
        const timeTarget = flag.timeTargeting
        if (timeTarget.startDate && now < new Date(timeTarget.startDate)) {
          return { result: false, reason: 'OFF' }
        }
        if (timeTarget.endDate && now > new Date(timeTarget.endDate)) {
          return { result: false, reason: 'OFF' }
        }
      }

      // User targeting
      if (flag.userTargeting && userId) {
        const userTarget = flag.userTargeting
        if (userTarget.include && userTarget.include.includes(userId)) {
          return { result: true, variant: flag.defaultVariant, reason: 'TARGET_MATCH' }
        }
        if (userTarget.exclude && userTarget.exclude.includes(userId)) {
          return { result: false, reason: 'OFF' }
        }
      }

      // Group/Role targeting
      if (flag.groupTargeting && context.userRole) {
        const groupTarget = flag.groupTargeting
        if (groupTarget.include && groupTarget.include.includes(context.userRole)) {
          return { result: true, variant: flag.defaultVariant, reason: 'TARGET_MATCH' }
        }
        if (groupTarget.exclude && groupTarget.exclude.includes(context.userRole)) {
          return { result: false, reason: 'OFF' }
        }
      }

      // Geographic targeting
      if (flag.geoTargeting && context.country) {
        const geoTarget = flag.geoTargeting
        if (geoTarget.include && !geoTarget.include.includes(context.country)) {
          return { result: false, reason: 'OFF' }
        }
        if (geoTarget.exclude && geoTarget.exclude.includes(context.country)) {
          return { result: false, reason: 'OFF' }
        }
      }

      // Complex conditions
      if (flag.conditions) {
        // In a real implementation, you'd evaluate complex conditions
        // For now, assume conditions are met
      }

      // Percentage rollout
      if (flag.rolloutPercent > 0) {
        let hash = 0
        const key = `${flag.key}:${userId || 'anonymous'}`
        for (let i = 0; i < key.length; i++) {
          hash = ((hash << 5) - hash) + key.charCodeAt(i)
          hash = hash & hash // Convert to 32-bit integer
        }

        const percentage = Math.abs(hash) % 100
        const isIncluded = percentage < flag.rolloutPercent

        return {
          result: isIncluded,
          variant: flag.defaultVariant,
          reason: isIncluded ? 'PERCENT_ROLLOUT' : 'OFF'
        }
      }

      // Default to off if no targeting rules apply
      return { result: false, reason: 'DEFAULT' }
    }

    // Evaluate each flag
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

        const evaluation = evaluateFlag(flag, evaluationUserId)

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
        workspaceId,
        ...context
      }
    })

  } catch (error) {
    console.error('Failed to evaluate feature flags:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate feature flags' },
      { status: 500 }
    )
  }
}