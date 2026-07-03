import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
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

    // Verify user has access to this workspace (ADR-0004)
    await requireWorkspaceRole(workspaceId)

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
    if (error instanceof ApiError) return handleApiError(error)
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}