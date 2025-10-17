import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/system/[id] - Get specific system configuration
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
    const configurationId = params.id

    const configuration = await prisma.systemConfiguration.findUnique({
      where: { id: configurationId },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Check permissions
    if (configuration.workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: configuration.workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({
      configuration: {
        ...configuration,
        // Mask secret values unless explicitly requested
        value: configuration.isSecret ? '***HIDDEN***' : configuration.value
      }
    })

  } catch (error) {
    console.error('Failed to fetch system configuration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system configuration' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings/system/[id] - Update system configuration
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
    const configurationId = params.id
    const body = await request.json()

    const {
      value,
      description,
      isRequired,
      isSecret,
      validationRules,
      defaultValue
    } = body

    // Get existing configuration
    const existing = await prisma.systemConfiguration.findUnique({
      where: { id: configurationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Check permissions
    if (existing.workspaceId) {
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
    }

    // Validate value if provided
    if (value !== undefined) {
      const validateValue = (val: string, type: string): boolean => {
        switch (type) {
          case 'INTEGER':
            return !isNaN(parseInt(val)) && isFinite(parseInt(val))
          case 'FLOAT':
            return !isNaN(parseFloat(val)) && isFinite(parseFloat(val))
          case 'BOOLEAN':
            return val === 'true' || val === 'false'
          case 'JSON':
            try {
              JSON.parse(val)
              return true
            } catch {
              return false
            }
          case 'URL':
            try {
              new URL(val)
              return true
            } catch {
              return false
            }
          case 'EMAIL':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
          default:
            return true
        }
      }

      if (!validateValue(value, existing.dataType)) {
        return NextResponse.json(
          { error: `Invalid value for data type ${existing.dataType}` },
          { status: 400 }
        )
      }
    }

    // Update configuration
    const updateData: any = {
      lastUpdatedBy: normalizedUserId
    }

    if (value !== undefined) updateData.value = String(value)
    if (description !== undefined) updateData.description = description
    if (isRequired !== undefined) updateData.isRequired = isRequired
    if (isSecret !== undefined) updateData.isSecret = isSecret
    if (validationRules !== undefined) updateData.validationRules = validationRules
    if (defaultValue !== undefined) updateData.defaultValue = defaultValue

    const configuration = await prisma.systemConfiguration.update({
      where: { id: configurationId },
      data: updateData,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      configuration: {
        ...configuration,
        // Mask secret values
        value: configuration.isSecret ? '***HIDDEN***' : configuration.value
      }
    })

  } catch (error) {
    console.error('Failed to update system configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update system configuration' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/settings/system/[id] - Delete system configuration
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
    const configurationId = params.id

    // Get existing configuration
    const existing = await prisma.systemConfiguration.findUnique({
      where: { id: configurationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Check permissions
    if (existing.workspaceId) {
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
    }

    // Prevent deletion of required configurations
    if (existing.isRequired) {
      return NextResponse.json(
        { error: 'Cannot delete required configuration' },
        { status: 400 }
      )
    }

    await prisma.systemConfiguration.delete({
      where: { id: configurationId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to delete system configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete system configuration' },
      { status: 500 }
    )
  }
}