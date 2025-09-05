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
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: invitation.email }
      })

      // If user doesn't exist, create them
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: invitation.email,
            name: invitation.email.split('@')[0],
            emailVerified: null
          }
        })
      }

      // Check if already a workspace member
      const existingMembership = await prisma.userWorkspace.findFirst({
        where: {
          userId: user.id,
          workspaceId: invitation.workspaceId
        }
      })

      if (!existingMembership) {
        // Create workspace membership with permissions
        const permissions = getDefaultPermissions(invitation.role)
        
        await prisma.userWorkspace.create({
          data: {
            userId: user.id,
            workspaceId: invitation.workspaceId,
            role: invitation.role,
            permissions: permissions
          }
        })
      }

      // Update invitation status
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { 
          status: 'ACCEPTED',
          respondedAt: new Date()
        }
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

// Helper function to get default permissions
function getDefaultPermissions(role: string) {
  switch (role) {
    case 'OWNER':
      return {
        canManageTeam: true,
        canManageContent: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageBilling: true
      }
    case 'ADMIN':
      return {
        canManageTeam: true,
        canManageContent: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageBilling: false
      }
    case 'PUBLISHER':
      return {
        canManageTeam: false,
        canManageContent: true,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageBilling: false
      }
    case 'ANALYST':
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageBilling: false
      }
    case 'CLIENT_VIEWER':
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageBilling: false
      }
    default:
      return {
        canManageTeam: false,
        canManageContent: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageBilling: false
      }
  }
}