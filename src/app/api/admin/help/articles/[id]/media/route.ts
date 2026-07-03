import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/admin/help/articles/[id]/media - Get article media
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

    const { id: articleId } = params

    // Verify article exists
    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId }
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Fetch article media
    const media = await prisma.helpArticleMedia.findMany({
      where: { articleId },
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ media })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/help/articles/[id]/media - Upload media for article
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

    const { id: articleId } = params

    // Verify article exists
    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId }
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const alt = formData.get('alt') as string
    const caption = formData.get('caption') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/ogg'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and videos are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Create upload directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'help-articles')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const fileName = `${uuidv4()}${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)
    const relativeFilePath = `/uploads/help-articles/${fileName}`

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Get the next sort order
    const lastMedia = await prisma.helpArticleMedia.findFirst({
      where: { articleId },
      orderBy: { sortOrder: 'desc' }
    })
    const sortOrder = lastMedia ? lastMedia.sortOrder + 1 : 0

    // Save media record to database
    const media = await prisma.helpArticleMedia.create({
      data: {
        articleId,
        fileName,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        filePath: relativeFilePath,
        alt: alt || '',
        caption: caption || '',
        sortOrder
      }
    })

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}