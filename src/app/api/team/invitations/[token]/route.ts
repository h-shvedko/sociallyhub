import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        workspace: {
          select: {
            name: true,
            id: true
          }
        },
        invitedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!invitation) {
      return NextResponse.json({ 
        error: 'Invalid or expired invitation' 
      }, { status: 404 })
    }

    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        workspaceName: invitation.workspace.name,
        invitedBy: invitation.invitedBy.name,
        invitedByEmail: invitation.invitedBy.email,
        createdAt: invitation.createdAt
      }
    })

  } catch (error) {
    console.error('Invitation lookup error:', error)
    return NextResponse.json({
      error: 'Failed to lookup invitation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action } = body // 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be either accept or decline' 
      }, { status: 400 })
    }

    // Find the invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      }
    })

    if (!invitation) {
      return NextResponse.json({ 
        error: 'Invalid or expired invitation' 
      }, { status: 404 })
    }

    if (action === 'accept') {
      // Run user creation, membership creation and invitation acceptance atomically
      // so a mid-flow failure can't strand an orphan User with a stuck PENDING invitation.
      await prisma.$transaction(async (tx) => {
        // Check if user exists
        let user = await tx.user.findUnique({
          where: { email: invitation.email }
        })

        // If user doesn't exist, create them
        if (!user) {
          user = await tx.user.create({
            data: {
              email: invitation.email,
              name: invitation.email.split('@')[0],
              emailVerified: null
            }
          })
        }

        // Check if already a workspace member
        const existingMembership = await tx.userWorkspace.findFirst({
          where: {
            userId: user.id,
            workspaceId: invitation.workspaceId
          }
        })

        if (!existingMembership) {
          // Create workspace membership (role is the sole authz field;
          // per-member permissions column was removed)
          await tx.userWorkspace.create({
            data: {
              userId: user.id,
              workspaceId: invitation.workspaceId,
              role: invitation.role
            }
          })
        }

        // Update invitation status
        await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            respondedAt: new Date()
          }
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted! Welcome to the team.',
        redirectUrl: '/dashboard'
      })
    } else {
      // Decline invitation
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { 
          status: 'DECLINED',
          respondedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation declined.'
      })
    }

  } catch (error) {
    console.error('Invitation response error:', error)
    return NextResponse.json({
      error: 'Failed to process invitation response',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
