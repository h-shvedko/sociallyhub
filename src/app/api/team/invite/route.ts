import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/notifications/email-service'
import { notifyUser } from '@/lib/notifications/notify'

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()
    const userId = user.id
    const body = await request.json()
    const { email, role, workspaceId } = body

    if (!email || !role || !workspaceId) {
      return jsonError(400, 'Email, role, and workspaceId are required')
    }

    // Verify user has permission to invite (OWNER or ADMIN)
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

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

    // ADR-0010: if the invitee already has a SociallyHub account, drop an in-app
    // notification so they can accept from within the app (the email above is the
    // channel for brand-new emails, which have no userId to notify). Persist-first
    // + best-effort — a notify failure must never fail the invitation.
    if (existingUser && workspace) {
      try {
        await notifyUser(existingUser.id, {
          type: 'TEAM_INVITATION',
          title: `Invitation to join ${workspace.name}`,
          message: `${inviter?.name || inviter?.email || 'A team admin'} invited you to join ${workspace.name} as ${role}.`,
          data: {
            workspaceId,
            role,
            invitationToken: invitation.token,
            actionUrl: `/team/invite/${invitation.token}`,
          },
        })
      } catch (notifyError) {
        console.error('Failed to send team invitation notification:', notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent invitation to ${email}`,
      invitationUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3099'}/team/invite/${invitation.token}` // For testing
    })

  } catch (error) {
    return handleApiError(error)
  }
}