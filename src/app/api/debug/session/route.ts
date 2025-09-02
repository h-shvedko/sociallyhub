import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No session found',
        session: session
      })
    }

    // Get user workspace info
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    return NextResponse.json({
      authenticated: true,
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          currentWorkspaceId: (session.user as any).currentWorkspaceId,
          role: (session.user as any).role
        }
      },
      userWorkspace: userWorkspace ? {
        id: userWorkspace.id,
        role: userWorkspace.role,
        workspace: {
          id: userWorkspace.workspace.id,
          name: userWorkspace.workspace.name
        }
      } : null,
      debug: {
        hasUserWorkspace: !!userWorkspace,
        sessionKeys: Object.keys(session),
        userKeys: Object.keys(session.user)
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}