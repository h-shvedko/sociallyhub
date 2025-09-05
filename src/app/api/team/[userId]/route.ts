import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = await normalizeUserId(session.user.id)
    const { userId } = await params
    const body = await request.json()
    const { role, workspaceId } = body

    if (!role || !workspaceId) {
      return NextResponse.json({ 
        error: 'Role and workspaceId are required' 
      }, { status: 400 })
    }

    // Verify current user has permission to change roles (OWNER or ADMIN)
    const currentUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: currentUserId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!currentUserWorkspace) {
      return NextResponse.json({ 
        error: 'No permission to change member roles' 
      }, { status: 403 })
    }

    // Get target user's current membership
    const targetUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    })

    if (!targetUserWorkspace) {
      return NextResponse.json({ 
        error: 'Member not found in workspace' 
      }, { status: 404 })
    }

    // Prevent changing OWNER role (only one OWNER allowed)
    if (targetUserWorkspace.role === 'OWNER') {
      return NextResponse.json({ 
        error: 'Cannot change role of workspace owner' 
      }, { status: 400 })
    }

    // Prevent non-owners from making others OWNER
    if (role === 'OWNER' && currentUserWorkspace.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Only workspace owner can assign owner role' 
      }, { status: 403 })
    }

    // Update the role
    await prisma.userWorkspace.update({
      where: {
        id: targetUserWorkspace.id
      },
      data: {
        role
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully updated role to ${role}`
    })

  } catch (error) {
    console.error('Role change error:', error)
    return NextResponse.json({
      error: 'Failed to update role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = await normalizeUserId(session.user.id)
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ 
        error: 'workspaceId is required' 
      }, { status: 400 })
    }

    // Verify current user has permission to remove members (OWNER or ADMIN)
    const currentUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: currentUserId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!currentUserWorkspace) {
      return NextResponse.json({ 
        error: 'No permission to remove members' 
      }, { status: 403 })
    }

    // Get target user's membership
    const targetUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    })

    if (!targetUserWorkspace) {
      return NextResponse.json({ 
        error: 'Member not found in workspace' 
      }, { status: 404 })
    }

    // Prevent removing OWNER
    if (targetUserWorkspace.role === 'OWNER') {
      return NextResponse.json({ 
        error: 'Cannot remove workspace owner' 
      }, { status: 400 })
    }

    // Prevent users from removing themselves (unless they're leaving)
    if (userId === currentUserId) {
      return NextResponse.json({ 
        error: 'Use leave workspace function to remove yourself' 
      }, { status: 400 })
    }

    // Remove the membership
    await prisma.userWorkspace.delete({
      where: {
        id: targetUserWorkspace.id
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully removed member from workspace'
    })

  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json({
      error: 'Failed to remove member',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}