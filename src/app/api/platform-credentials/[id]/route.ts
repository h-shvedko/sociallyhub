import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { decryptCredentials } from '@/lib/encryption'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/platform-credentials/[id] - Get specific platform credentials
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id } = await params

    // Get the credentials with workspace access check
    const credentials = await prisma.platformCredentials.findFirst({
      where: {
        id,
        workspace: {
          users: {
            some: {
              userId,
              role: { in: ['OWNER', 'ADMIN'] }
            }
          }
        }
      },
      include: {
        workspace: {
          select: { id: true, name: true }
        }
      }
    })

    if (!credentials) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    // Decrypt credentials for viewing/editing
    const decryptedCredentials = decryptCredentials(credentials.credentials)

    return NextResponse.json({
      id: credentials.id,
      platform: credentials.platform,
      credentials: decryptedCredentials,
      isActive: credentials.isActive,
      environment: credentials.environment,
      validationStatus: credentials.validationStatus,
      validationError: credentials.validationError,
      lastValidated: credentials.lastValidated,
      lastUsed: credentials.lastUsed,
      usageCount: credentials.usageCount,
      notes: credentials.notes,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt,
      workspace: credentials.workspace
    })
  } catch (error) {
    console.error('Error fetching platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch platform credentials' },
      { status: 500 }
    )
  }
}

// DELETE /api/platform-credentials/[id] - Delete platform credentials
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id } = await params

    // Verify user has access and delete
    const credentials = await prisma.platformCredentials.findFirst({
      where: {
        id,
        workspace: {
          users: {
            some: {
              userId,
              role: { in: ['OWNER', 'ADMIN'] }
            }
          }
        }
      }
    })

    if (!credentials) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    await prisma.platformCredentials.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: `${credentials.platform} credentials deleted successfully`
    })
  } catch (error) {
    console.error('Error deleting platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to delete platform credentials' },
      { status: 500 }
    )
  }
}

// PUT /api/platform-credentials/[id] - Update platform credentials
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id } = await params
    const body = await request.json()
    const { isActive, environment, notes } = body

    // Verify user has access
    const credentials = await prisma.platformCredentials.findFirst({
      where: {
        id,
        workspace: {
          users: {
            some: {
              userId,
              role: { in: ['OWNER', 'ADMIN'] }
            }
          }
        }
      }
    })

    if (!credentials) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    // Update credentials
    const updatedCredentials = await prisma.platformCredentials.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : credentials.isActive,
        environment: environment || credentials.environment,
        notes: notes !== undefined ? notes : credentials.notes
      },
      select: {
        id: true,
        platform: true,
        isActive: true,
        environment: true,
        validationStatus: true,
        validationError: true,
        lastValidated: true,
        notes: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      credentials: updatedCredentials,
      message: `${credentials.platform} credentials updated successfully`
    })
  } catch (error) {
    console.error('Error updating platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to update platform credentials' },
      { status: 500 }
    )
  }
}