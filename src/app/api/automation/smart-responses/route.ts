import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { BusinessLogger } from '@/lib/middleware/logging'
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify workspace access (ADR-0004): any member of THIS workspace.
    await requireWorkspaceRole(workspaceId)

    const whereClause: any = { workspaceId }
    if (status !== 'all') {
      whereClause.status = status.toUpperCase()
    }

    const responses = await prisma.smartResponse.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    BusinessLogger.logWorkspaceAction('smart_responses_viewed', workspaceId, session.user.id, {
      responsesCount: responses.length,
      statusFilter: status
    })

    return NextResponse.json(responses)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      workspaceId,
      sourceType,
      sourceId,
      sourcePlatform,
      originalMessage,
      suggestedResponse,
      responseType,
      tone,
      sentiment,
      intent,
      category,
      urgency,
      confidenceScore,
      languageDetected,
      requiresHuman
    } = body

    if (!workspaceId || !sourceId || !sourcePlatform || !originalMessage || !suggestedResponse) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify workspace access (ADR-0004): same role set as the old inline check.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    const response = await prisma.smartResponse.create({
      data: {
        workspaceId,
        sourceType: sourceType || 'COMMENT',
        sourceId,
        sourcePlatform,
        originalMessage,
        suggestedResponse,
        responseType: responseType || 'ANSWER',
        tone: tone || 'FRIENDLY',
        sentiment: sentiment || 0,
        intent: intent || 'unknown',
        category: category || 'general',
        urgency: urgency || 'MEDIUM',
        confidenceScore: confidenceScore || 0.8,
        languageDetected: languageDetected || 'en',
        requiresHuman: requiresHuman || false,
        status: 'PENDING'
      }
    })

    BusinessLogger.logWorkspaceAction('smart_response_created', workspaceId, session.user.id, {
      responseId: response.id,
      sourcePlatform,
      responseType,
      confidenceScore
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}