import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/user/workspace - Get user's primary workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace ID from user's primary workspace
    const userId = await normalizeUserId(session.user.id)

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    return NextResponse.json({
      workspaceId: userWorkspace.workspaceId,
      workspace: userWorkspace.workspace
    })

  } catch (error) {
    console.error('Error fetching user workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}