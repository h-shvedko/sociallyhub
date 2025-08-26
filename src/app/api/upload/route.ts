import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { 
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json(
        { error: 'No workspace with upload permissions' },
        { status: 403 }
      )
    }

    const data = await request.formData()
    const file: File | null = data.get('file') as unknown as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported types: JPEG, PNG, GIF, WebP, MP4, WebM' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const fileExtension = path.extname(file.name) || '.bin'
    const uniqueFilename = `${uuidv4()}${fileExtension}`
    const uploadDir = path.join(process.cwd(), 'uploads', userWorkspace.workspaceId)
    const filePath = path.join(uploadDir, uniqueFilename)

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true })

    // Write file to disk
    await writeFile(filePath, buffer)

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: `/uploads/${userWorkspace.workspaceId}/${uniqueFilename}`,
        width: null,
        height: null,
        duration: null,
        metadata: {},
        tags: []
      }
    })

    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        url: asset.url,
        filename: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}