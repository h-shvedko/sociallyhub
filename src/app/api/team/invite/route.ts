import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

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

    // Check if user already exists
    let invitedUser = await prisma.user.findUnique({
      where: { email }
    })

    // If user doesn't exist, create them
    if (!invitedUser) {
      invitedUser = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0], // Temporary name from email
          emailVerified: null // They'll need to verify on first login
        }
      })
    }

    // Check if user is already in workspace
    const existingMembership = await prisma.userWorkspace.findFirst({
      where: {
        userId: invitedUser.id,
        workspaceId
      }
    })

    if (existingMembership) {
      return NextResponse.json({ 
        error: 'User is already a member of this workspace' 
      }, { status: 400 })
    }

    // Define default permissions based on role
    const getDefaultPermissions = (role: string) => {
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

    // Create workspace membership
    await prisma.userWorkspace.create({
      data: {
        userId: invitedUser.id,
        workspaceId,
        role,
        permissions: getDefaultPermissions(role)
      }
    })

    // In a real app, you would send an email invitation here
    // For now, we'll just return success

    return NextResponse.json({
      success: true,
      message: `Successfully invited ${email} as ${role}`
    })

  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json({
      error: 'Failed to invite member',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}