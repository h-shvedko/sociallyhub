import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/integrations/[id] - Get specific integration setting
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const integrationId = params.id

    const integration = await prisma.integrationSetting.findUnique({
      where: { id: integrationId },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: integration.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? '***HIDDEN***' : null
      }
    })

  } catch (error) {
    console.error('Failed to fetch integration setting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch integration setting' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings/integrations/[id] - Update integration setting
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const integrationId = params.id
    const body = await request.json()

    const {
      name,
      config,
      credentials,
      isActive,
      syncInterval,
      features,
      webhookUrl,
      webhookSecret,
      resetErrorCount = false
    } = body

    // Get existing integration
    const existing = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: existing.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for name conflicts if name is being changed
    if (name && name !== existing.name) {
      const conflictingIntegration = await prisma.integrationSetting.findFirst({
        where: {
          workspaceId: existing.workspaceId,
          provider: existing.provider,
          name,
          id: { not: integrationId }
        }
      })

      if (conflictingIntegration) {
        return NextResponse.json(
          { error: 'Integration with this provider and name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: any = {
      lastUpdatedBy: normalizedUserId
    }

    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = config
    if (credentials !== undefined) {
      updateData.credentials = credentials
      updateData.isConfigured = credentials ? true : false
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (syncInterval !== undefined) updateData.syncInterval = syncInterval
    if (features !== undefined) updateData.features = features
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret

    if (resetErrorCount) {
      updateData.errorCount = 0
      updateData.lastError = null
    }

    // Update integration
    const integration = await prisma.integrationSetting.update({
      where: { id: integrationId },
      data: updateData,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? '***HIDDEN***' : null
      }
    })

  } catch (error) {
    console.error('Failed to update integration setting:', error)
    return NextResponse.json(
      { error: 'Failed to update integration setting' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/settings/integrations/[id] - Delete integration setting
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const integrationId = params.id

    // Get existing integration
    const existing = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: existing.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.integrationSetting.delete({
      where: { id: integrationId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to delete integration setting:', error)
    return NextResponse.json(
      { error: 'Failed to delete integration setting' },
      { status: 500 }
    )
  }
}