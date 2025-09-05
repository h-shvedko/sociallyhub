import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { emailService } from '@/lib/notifications/email-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()
    const { email, role, workspaceId } = body

    if (!email || !role || !workspaceId) {
      return NextResponse.json({ 
        error: 'Email, role, and workspaceId are required' 
      }, { status: 400 })
    }

    // Verify user has permission to invite (OWNER or ADMIN)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ 
        error: 'No permission to invite members' 
      }, { status: 403 })
    }

    // Check if user already exists and is already in workspace
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      const existingMembership = await prisma.userWorkspace.findFirst({
        where: {
          userId: existingUser.id,
          workspaceId
        }
      })

      if (existingMembership) {
        return NextResponse.json({ 
          error: 'User is already a member of this workspace' 
        }, { status: 400 })
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        email,
        workspaceId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date()
        }
      }
    })

    if (existingInvitation) {
      return NextResponse.json({ 
        error: 'An invitation has already been sent to this email' 
      }, { status: 400 })
    }

    // Create invitation with 7-day expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = await prisma.teamInvitation.create({
      data: {
        email,
        role,
        workspaceId,
        invitedById: userId,
        expiresAt
      }
    })

    // Get workspace and inviter info for email
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true }
    })

    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    })

    // Send team invitation email with token
    try {
      if (workspace && inviter) {
        const invitationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3099'}/team/invite/${invitation.token}`
        
        await emailService.sendTeamInvitationEmail(
          email,
          inviter.name || inviter.email || 'Team Admin',
          workspace.name,
          invitationUrl
        )
        
        console.log('Team invitation email sent successfully to:', email)
      }
    } catch (emailError) {
      console.error('Failed to send team invitation email:', emailError)
      // Don't fail the invitation if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent invitation to ${email}`,
      invitationUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3099'}/team/invite/${invitation.token}` // For testing
    })

  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json({
      error: 'Failed to invite member',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}