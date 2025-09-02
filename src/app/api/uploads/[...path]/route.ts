import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filePath = params.path.join('/')
    const [workspaceId, filename] = params.path

    if (!workspaceId || !filename) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Verify user has access to this workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify asset exists in database
    const asset = await prisma.asset.findFirst({
      where: {
        workspaceId: workspaceId,
        url: `/uploads/${filePath}`
      }
    })

    if (!asset) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file from disk
    const fullPath = path.join(process.cwd(), 'uploads', filePath)
    const fileBuffer = await readFile(fullPath)

    // Set appropriate headers
    const headers = new Headers()
    headers.set('Content-Type', asset.mimeType)
    headers.set('Content-Length', asset.size.toString())
    headers.set('Cache-Control', 'public, max-age=86400') // Cache for 1 day

    return new NextResponse(fileBuffer, { headers })

  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}