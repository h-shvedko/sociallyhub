import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireSession()
    const { userId } = await params
    const body = await request.json()
    const { role, workspaceId } = body

    if (!role || !workspaceId) {
      return jsonError(400, 'Role and workspaceId are required')
    }

    // Verify current user has permission to change roles (OWNER or ADMIN)
    const currentUserWorkspace = await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

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
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireSession()
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return jsonError(400, 'workspaceId is required')
    }

    // Verify current user has permission to remove members (OWNER or ADMIN)
    const currentUserWorkspace = await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

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
    if (userId === currentUserWorkspace.userId) {
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
    return handleApiError(error)
  }
}