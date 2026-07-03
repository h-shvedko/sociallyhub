// @api-auth: public
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/utils/rate-limit'

interface RouteParams {
  params: Promise<{
    requestId: string
  }>
}

// First x-forwarded-for hop (falling back to x-real-ip) for rate-limit keying.
function rateLimitIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

// Enforce a per-IP sliding-window limit; returns a 429 response when exceeded,
// or null when the request may proceed. Fails open on Redis errors.
async function enforceIpRateLimit(
  request: NextRequest,
  scope: string,
  points: number
): Promise<NextResponse | null> {
  const result = await rateLimit(`ip:${rateLimitIp(request)}:feature-vote:${scope}`, {
    points,
    windowSec: 60,
  })
  if (result.ok) return null
  const res = NextResponse.json(
    { error: 'Too many requests', code: 'RATE_LIMITED' },
    { status: 429 }
  )
  if (result.retryAfterSec !== undefined) {
    res.headers.set('Retry-After', String(result.retryAfterSec))
  }
  return res
}

// POST /api/community/feature-requests/[requestId]/vote - Vote on a feature request
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const limited = await enforceIpRateLimit(request, 'POST', 30)
    if (limited) return limited

    const session = await getServerSession(authOptions)
    const { requestId } = params
    const body = await request.json()
    const { guestIdentifier, guestName, guestEmail } = body

    // Get guest identifier from IP if not provided
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const finalGuestIdentifier = guestIdentifier || `ip_${clientIp}`

    // Check if feature request exists
    const featureRequest = await prisma.featureRequest.findUnique({
      where: { id: requestId }
    })

    if (!featureRequest) {
      return NextResponse.json(
        { error: 'Feature request not found' },
        { status: 404 }
      )
    }

    const userId = session?.user?.id ? await normalizeUserId(session.user.id) : null

    // Check if user/guest has already voted
    const existingVote = await prisma.featureRequestVote.findFirst({
      where: {
        requestId,
        OR: [
          { userId },
          { guestIdentifier: finalGuestIdentifier }
        ]
      }
    })

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this feature request' },
        { status: 400 }
      )
    }

    // Create vote. The unique constraints @@unique([requestId, userId]) and
    // @@unique([requestId, guestIdentifier]) guard against a concurrent
    // double-vote that slips past the findFirst check above — catch the P2002
    // and report "already voted" instead of crashing with a 500.
    let vote
    try {
      vote = await prisma.featureRequestVote.create({
        data: {
          requestId,
          userId,
          guestIdentifier: userId ? null : finalGuestIdentifier,
          guestName: guestName?.trim(),
          guestEmail: guestEmail?.trim()
        }
      })
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already voted on this feature request' },
          { status: 409 }
        )
      }
      throw err
    }

    // Update vote count on feature request
    await prisma.featureRequest.update({
      where: { id: requestId },
      data: {
        votes: {
          increment: 1
        }
      }
    })

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'FEATURE_REQUEST_VOTED',
        title: 'Feature request voted',
        description: `Voted on: ${featureRequest.title}`,
        userId,
        userName: session?.user?.name || guestName || 'Anonymous',
        userAvatar: session?.user?.image,
        targetId: requestId,
        targetType: 'feature_request',
        targetTitle: featureRequest.title,
        workspaceId: featureRequest.workspaceId,
        metadata: {
          voteType: 'upvote'
        }
      }
    })

    return NextResponse.json({
      message: 'Vote recorded successfully',
      vote
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to vote on feature request:', error)
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/feature-requests/[requestId]/vote - Remove vote from feature request
export async function DELETE(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const limited = await enforceIpRateLimit(request, 'DELETE', 30)
    if (limited) return limited

    const session = await getServerSession(authOptions)
    const { requestId } = params

    // Get guest identifier from IP
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const guestIdentifier = `ip_${clientIp}`

    const userId = session?.user?.id ? await normalizeUserId(session.user.id) : null

    // Find existing vote
    const existingVote = await prisma.featureRequestVote.findFirst({
      where: {
        requestId,
        OR: [
          { userId },
          { guestIdentifier }
        ]
      }
    })

    if (!existingVote) {
      return NextResponse.json(
        { error: 'No vote found to remove' },
        { status: 404 }
      )
    }

    // Remove vote
    await prisma.featureRequestVote.delete({
      where: { id: existingVote.id }
    })

    // Update vote count on feature request
    await prisma.featureRequest.update({
      where: { id: requestId },
      data: {
        votes: {
          decrement: 1
        }
      }
    })

    return NextResponse.json({
      message: 'Vote removed successfully'
    })

  } catch (error) {
    console.error('Failed to remove vote:', error)
    return NextResponse.json(
      { error: 'Failed to remove vote' },
      { status: 500 }
    )
  }
}

// GET /api/community/feature-requests/[requestId]/vote - Check if user has voted
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const limited = await enforceIpRateLimit(request, 'GET', 60)
    if (limited) return limited

    const session = await getServerSession(authOptions)
    const { requestId } = params

    // Get guest identifier from IP
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const guestIdentifier = `ip_${clientIp}`

    const userId = session?.user?.id ? await normalizeUserId(session.user.id) : null

    // Check if user/guest has voted
    const existingVote = await prisma.featureRequestVote.findFirst({
      where: {
        requestId,
        OR: [
          { userId },
          { guestIdentifier }
        ]
      }
    })

    return NextResponse.json({
      hasVoted: !!existingVote,
      vote: existingVote
    })

  } catch (error) {
    console.error('Failed to check vote status:', error)
    return NextResponse.json(
      { error: 'Failed to check vote status' },
      { status: 500 }
    )
  }
}
