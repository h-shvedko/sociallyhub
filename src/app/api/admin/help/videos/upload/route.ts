import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { v4 as uuidv4 } from 'uuid'
import { getStorage, buildHelpKey } from '@/lib/storage'

// Validated MIME type → canonical extension. The stored key extension comes from
// this map, not the user-supplied file.name (ADR-0007 traversal-safety).
const MIME_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/avi': '.avi',
  'video/mov': '.mov',
  'video/wmv': '.wmv',
  'video/flv': '.flv',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export async function POST(request: NextRequest) {
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

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

    // Derive the extension from the validated MIME type (never file.name).
    const fileExtension = MIME_EXT[file.type] || ''
    const fileName = `${uuidv4()}${fileExtension}`

    // Store via the storage service under a public help key. Videos go under
    // help/videos/*, thumbnails under help/thumbnails/* (ADR-0007 key scheme).
    const key = buildHelpKey(type === 'video' ? 'videos' : 'thumbnails', fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await getStorage().put(key, buffer, { contentType: file.type })

    // Help content is served publicly by the `/api/files` route.
    const publicUrl = `/api/files/${key}`

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
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

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
    return handleApiError(error)
  }
}