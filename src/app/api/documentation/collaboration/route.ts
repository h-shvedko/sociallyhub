import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/collaboration - Get collaborators for a page
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const collaborators = await prisma.documentationCollaborator.findMany({
      where: { pageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    })

    return NextResponse.json(collaborators)
  } catch (error) {
    console.error('Failed to fetch collaborators:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collaborators' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/collaboration - Add collaborator to a page
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      pageId,
      userId,
      role = 'VIEWER',
      permissions = ['READ']
    } = body

    if (!pageId || !userId) {
      return NextResponse.json(
        { error: 'Page ID and user ID are required' },
        { status: 400 }
      )
    }

    // Verify page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Check if user is already a collaborator
    const existingCollaborator = await prisma.documentationCollaborator.findUnique({
      where: {
        pageId_userId: {
          pageId,
          userId
        }
      }
    })

    if (existingCollaborator) {
      return NextResponse.json(
        { error: 'User is already a collaborator' },
        { status: 409 }
      )
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const collaborator = await prisma.documentationCollaborator.create({
      data: {
        pageId,
        userId,
        role,
        permissions,
        addedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId,
        authorId: normalizedUserId,
        action: 'COLLABORATOR_ADD',
        changes: {
          userId,
          role,
          permissions
        },
        comment: `Added ${user.name} as ${role}`
      }
    })

    return NextResponse.json(collaborator, { status: 201 })
  } catch (error) {
    console.error('Failed to add collaborator:', error)
    return NextResponse.json(
      { error: 'Failed to add collaborator' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/collaboration/[id] - Update collaborator permissions
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    const body = await request.json()
    const { role, permissions } = body

    // Check if collaborator exists
    const existingCollaborator = await prisma.documentationCollaborator.findUnique({
      where: { id },
      include: {
        user: true,
        page: true
      }
    })

    if (!existingCollaborator) {
      return NextResponse.json(
        { error: 'Collaborator not found' },
        { status: 404 }
      )
    }

    const updatedCollaborator = await prisma.documentationCollaborator.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(permissions && { permissions })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId: existingCollaborator.pageId,
        authorId: normalizedUserId,
        action: 'COLLABORATOR_UPDATE',
        changes: {
          userId: existingCollaborator.userId,
          oldRole: existingCollaborator.role,
          newRole: role || existingCollaborator.role,
          oldPermissions: existingCollaborator.permissions,
          newPermissions: permissions || existingCollaborator.permissions
        },
        comment: `Updated ${existingCollaborator.user.name}'s permissions`
      }
    })

    return NextResponse.json(updatedCollaborator)
  } catch (error) {
    console.error('Failed to update collaborator:', error)
    return NextResponse.json(
      { error: 'Failed to update collaborator' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/collaboration/[id] - Remove collaborator
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if collaborator exists
    const existingCollaborator = await prisma.documentationCollaborator.findUnique({
      where: { id },
      include: {
        user: true
      }
    })

    if (!existingCollaborator) {
      return NextResponse.json(
        { error: 'Collaborator not found' },
        { status: 404 }
      )
    }

    await prisma.documentationCollaborator.delete({
      where: { id }
    })

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId: existingCollaborator.pageId,
        authorId: normalizedUserId,
        action: 'COLLABORATOR_REMOVE',
        changes: {
          userId: existingCollaborator.userId,
          role: existingCollaborator.role
        },
        comment: `Removed ${existingCollaborator.user.name} as collaborator`
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove collaborator:', error)
    return NextResponse.json(
      { error: 'Failed to remove collaborator' },
      { status: 500 }
    )
  }
}