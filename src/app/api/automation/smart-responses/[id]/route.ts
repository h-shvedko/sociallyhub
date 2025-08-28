import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { BusinessLogger } from '@/lib/middleware/logging'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await prisma.smartResponse.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id
            }
          }
        }
      }
    })

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching smart response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, feedback, suggestedResponse, tone, responseType } = body

    // Find the response and verify access
    const existingResponse = await prisma.smartResponse.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
            }
          }
        }
      }
    })

    if (!existingResponse) {
      return NextResponse.json({ error: 'Response not found or access denied' }, { status: 404 })
    }

    let updateData: any = {}

    if (action) {
      switch (action) {
        case 'approve':
          updateData.status = 'APPROVED'
          updateData.usedAt = new Date()
          break
        case 'reject':
          updateData.status = 'REJECTED'
          if (feedback) {
            updateData.feedback = feedback
          }
          break
        case 'send':
          updateData.status = 'SENT'
          updateData.usedAt = new Date()
          break
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
    }

    if (suggestedResponse) updateData.suggestedResponse = suggestedResponse
    if (tone) updateData.tone = tone
    if (responseType) updateData.responseType = responseType
    if (feedback) updateData.feedback = feedback

    const updatedResponse = await prisma.smartResponse.update({
      where: { id: params.id },
      data: updateData
    })

    BusinessLogger.logWorkspaceAction('smart_response_updated', existingResponse.workspaceId, session.user.id, {
      responseId: updatedResponse.id,
      action,
      newStatus: updatedResponse.status
    })

    return NextResponse.json(updatedResponse)
  } catch (error) {
    console.error('Error updating smart response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the response and verify access
    const existingResponse = await prisma.smartResponse.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN'] } // Only owners and admins can delete
            }
          }
        }
      }
    })

    if (!existingResponse) {
      return NextResponse.json({ error: 'Response not found or access denied' }, { status: 404 })
    }

    await prisma.smartResponse.delete({
      where: { id: params.id }
    })

    BusinessLogger.logWorkspaceAction('smart_response_deleted', existingResponse.workspaceId, session.user.id, {
      responseId: existingResponse.id,
      sourcePlatform: existingResponse.sourcePlatform
    })

    return NextResponse.json({ message: 'Response deleted successfully' })
  } catch (error) {
    console.error('Error deleting smart response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}