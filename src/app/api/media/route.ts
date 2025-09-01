import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // 'image', 'video', 'document'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Build where clause
    const where: any = { workspaceId }

    if (type && type !== 'all') {
      if (type === 'images') {
        where.mimeType = { startsWith: 'image/' }
      } else if (type === 'videos') {
        where.mimeType = { startsWith: 'video/' }
      } else if (type === 'documents') {
        where.mimeType = { startsWith: 'application/' }
      }
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        workspace: {
          include: {
            userWorkspaces: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Transform assets to match frontend interface
    const transformedAssets = assets.map(asset => {
      // Find the uploader from metadata or default to workspace owner
      const uploadedBy = asset.workspace.userWorkspaces.find(uw => uw.role === 'OWNER')?.user || {
        name: 'Unknown User',
        email: 'unknown@sociallyhub.com'
      }

      return {
        id: asset.id,
        filename: asset.filename,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        uploadedBy: {
          name: uploadedBy.name || 'Unknown User',
          email: uploadedBy.email
        },
        createdAt: asset.createdAt.toISOString(),
        metadata: {
          width: asset.width,
          height: asset.height,
          duration: asset.duration
        },
        tags: asset.tags || []
      }
    })

    const total = await prisma.asset.count({ where })

    return NextResponse.json({
      assets: transformedAssets,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { assetIds, workspaceId } = body

    if (!assetIds || !Array.isArray(assetIds) || !workspaceId) {
      return NextResponse.json({ error: 'Asset IDs and workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Delete assets from database
    await prisma.asset.deleteMany({
      where: {
        id: { in: assetIds },
        workspaceId: workspaceId
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting assets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}