import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi'
}

// POST /api/media/upload - Upload media files
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const workspaceId = formData.get('workspaceId') as string

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
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
      return NextResponse.json(
        { error: 'No workspace with upload permissions' },
        { status: 403 }
      )
    }

    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }, { status: 400 })
    }

    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return NextResponse.json({
        error: 'File type not supported'
      }, { status: 400 })
    }

    try {
        // Generate unique filename
        const fileExtension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
        const uniqueFilename = `${uuidv4()}${fileExtension}`
        
        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'media')
        await mkdir(uploadDir, { recursive: true })

        // Save file to disk
        const filePath = join(uploadDir, uniqueFilename)
        const bytes = await file.arrayBuffer()
        await writeFile(filePath, Buffer.from(bytes))

        // Get file dimensions for images/videos (basic implementation)
        let width: number | null = null
        let height: number | null = null
        let duration: number | null = null

        // For a production app, you would use libraries like:
        // - sharp for images
        // - ffprobe for videos
        // Here we're just setting placeholder values
        if (file.type.startsWith('image/')) {
          width = 1920 // Placeholder
          height = 1080 // Placeholder
        } else if (file.type.startsWith('video/')) {
          width = 1920 // Placeholder
          height = 1080 // Placeholder
          duration = 60.0 // Placeholder
        }

      // Create asset record in database
      const asset = await prisma.asset.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          filename: uniqueFilename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          url: `/uploads/media/${uniqueFilename}`,
          thumbnailUrl: file.type.startsWith('image/') ? `/uploads/media/${uniqueFilename}` : null,
          width,
          height,
          duration,
          metadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString()
          },
          tags: []
        }
      })

      // Get user info for response
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      })

      return NextResponse.json({
        id: asset.id,
        filename: asset.filename,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        uploadedBy: {
          name: user?.name || 'Unknown User',
          email: user?.email || 'unknown@sociallyhub.com'
        },
        createdAt: asset.createdAt.toISOString(),
        metadata: {
          width: asset.width,
          height: asset.height,
          duration: asset.duration
        },
        tags: asset.tags || []
      })

    } catch (error) {
      console.error('Error uploading file:', error)
      return NextResponse.json({
        error: 'Failed to upload file'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in media upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}