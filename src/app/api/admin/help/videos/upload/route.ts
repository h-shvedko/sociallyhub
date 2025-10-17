import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'video' or 'thumbnail'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const validVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv'
    ]
    const validImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ]

    if (type === 'video' && !validVideoTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid video file type. Supported: MP4, WebM, OGG, AVI, MOV, WMV, FLV'
      }, { status: 400 })
    }

    if (type === 'thumbnail' && !validImageTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid image file type. Supported: JPEG, PNG, WebP, GIF'
      }, { status: 400 })
    }

    // Validate file size (100MB for videos, 10MB for images)
    const maxVideoSize = 100 * 1024 * 1024 // 100MB
    const maxImageSize = 10 * 1024 * 1024 // 10MB

    if (type === 'video' && file.size > maxVideoSize) {
      return NextResponse.json({
        error: 'Video file too large. Maximum size: 100MB'
      }, { status: 400 })
    }

    if (type === 'thumbnail' && file.size > maxImageSize) {
      return NextResponse.json({
        error: 'Image file too large. Maximum size: 10MB'
      }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const uniqueId = uuidv4()
    const fileName = `${uniqueId}${fileExtension}`

    // Create upload directory structure
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', type === 'video' ? 'files' : 'thumbnails')

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Write file to disk
    const filePath = path.join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Generate public URL
    const publicUrl = `/uploads/videos/${type === 'video' ? 'files' : 'thumbnails'}/${fileName}`

    // For video files, we could add encoding/transcoding here
    // This would typically involve ffmpeg or a cloud service like AWS Elemental MediaConvert

    const response = {
      success: true,
      url: publicUrl,
      fileName,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString()
    }

    // Add video-specific metadata if it's a video file
    if (type === 'video') {
      // In a production environment, you would extract video metadata here
      // using ffprobe or similar tools
      response.duration = 0 // Would be extracted from video
      response.resolution = '1920x1080' // Would be extracted from video
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return upload configuration and limits
    return NextResponse.json({
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedVideoTypes: [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/flv'
      ],
      supportedImageTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
      ],
      encodingFormats: [
        { format: 'mp4', codec: 'h264', quality: 'high' },
        { format: 'webm', codec: 'vp9', quality: 'medium' },
        { format: 'hls', codec: 'h264', quality: 'adaptive' }
      ]
    })
  } catch (error) {
    console.error('Error getting upload config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}