import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

interface RouteParams {
  params: {
    id: string
    mediaId: string
  }
}

// PUT /api/admin/help/articles/[id]/media/[mediaId] - Update media metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: articleId, mediaId } = params
    const data = await request.json()

    // Check if media exists and belongs to the article
    const existingMedia = await prisma.helpArticleMedia.findFirst({
      where: {
        id: mediaId,
        articleId
      }
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    const { alt, caption, sortOrder } = data

    // Update media metadata
    const updatedMedia = await prisma.helpArticleMedia.update({
      where: { id: mediaId },
      data: {
        ...(alt !== undefined && { alt }),
        ...(caption !== undefined && { caption }),
        ...(sortOrder !== undefined && { sortOrder }),
        updatedAt: new Date()
      }
    })

    return NextResponse.json(updatedMedia)
  } catch (error) {
    console.error('Failed to update media:', error)
    return NextResponse.json(
      { error: 'Failed to update media' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/help/articles/[id]/media/[mediaId] - Delete media
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: articleId, mediaId } = params

    // Check if media exists and belongs to the article
    const existingMedia = await prisma.helpArticleMedia.findFirst({
      where: {
        id: mediaId,
        articleId
      }
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Delete the physical file
    try {
      const filePath = path.join(process.cwd(), 'public', existingMedia.filePath)
      if (existsSync(filePath)) {
        await unlink(filePath)
      }
    } catch (fileError) {
      console.error('Failed to delete physical file:', fileError)
      // Continue with database deletion even if file deletion fails
    }

    // Delete the media record from database
    await prisma.helpArticleMedia.delete({
      where: { id: mediaId }
    })

    return NextResponse.json({
      message: 'Media deleted successfully',
      deletedMedia: {
        id: existingMedia.id,
        fileName: existingMedia.fileName,
        originalName: existingMedia.originalName
      }
    })
  } catch (error) {
    console.error('Failed to delete media:', error)
    return NextResponse.json(
      { error: 'Failed to delete media' },
      { status: 500 }
    )
  }
}