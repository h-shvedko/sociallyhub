import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
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

    // Handle demo user ID compatibility
    let userId = session.user.id
    if (userId === 'demo-user-id') {
      userId = 'cmesceft00000r6gjl499x7dl' // Use actual demo user ID from database
    }

    // Ensure user exists in database (handles both demo and regular users)
    let existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!existingUser) {
      // Try finding by email (handles demo user case)
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email || 'demo@sociallyhub.com' }
      })
      
      if (userByEmail) {
        console.log(`User exists by email but different ID. Session ID: ${session.user.id}, DB ID: ${userByEmail.id}`)
        existingUser = userByEmail
      } else {
        // Create user record if it doesn't exist
        existingUser = await prisma.user.create({
          data: {
            id: userId,
            email: session.user.email || 'unknown@sociallyhub.com',
            name: session.user.name || 'User',
            emailVerified: new Date()
          }
        })
      }
    }

    // Get user's primary workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { 
        userId: existingUser.id,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json(
        { error: 'No workspace with upload permissions' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadResults = []

    for (const file of files) {
      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        uploadResults.push({
          filename: file.name,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        })
        continue
      }

      if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
        uploadResults.push({
          filename: file.name,
          error: 'File type not supported'
        })
        continue
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
              uploadedBy: existingUser.id,
              uploadedAt: new Date().toISOString()
            },
            tags: []
          }
        })

        uploadResults.push({
          id: asset.id,
          filename: file.name,
          url: asset.url,
          thumbnailUrl: asset.thumbnailUrl,
          size: asset.size,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          success: true
        })

      } catch (error) {
        console.error('Error uploading file:', error)
        uploadResults.push({
          filename: file.name,
          error: 'Failed to upload file'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results: uploadResults
    })

  } catch (error) {
    console.error('Error in media upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/media/upload - Get uploaded media (with pagination)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // 'image' or 'video'

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: existingUser.id },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Build where clause
    const where: any = {
      workspaceId: { in: workspaceIds }
    }

    if (type) {
      where.mimeType = {
        startsWith: type + '/'
      }
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        url: true,
        thumbnailUrl: true,
        width: true,
        height: true,
        duration: true,
        tags: true,
        createdAt: true
      }
    })

    const total = await prisma.asset.count({ where })

    return NextResponse.json({
      assets,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}