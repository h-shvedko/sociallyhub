import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requirePlatformAdmin, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Two-tier authorization (ADR-0004): workspace-scoped configurations require
// OWNER/ADMIN membership of that workspace; global (workspaceId = null)
// configurations are platform-admin-only for reads AND writes (blanket
// admin-surface rule; ADR-0016 may relax masked reads later).
async function requireConfigurationScope(workspaceId: string | null): Promise<void> {
  if (workspaceId) {
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])
  } else {
    await requirePlatformAdmin()
  }
}

// GET /api/admin/settings/system/[id] - Get specific system configuration
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
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
      return jsonError(404, 'Configuration not found')
    }

    await requireConfigurationScope(configuration.workspaceId)

    return NextResponse.json({
      configuration: {
        ...configuration,
        // Mask secret values unless explicitly requested
        value: configuration.isSecret ? '***HIDDEN***' : configuration.value
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/admin/settings/system/[id] - Update system configuration
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireSession()
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
      return jsonError(404, 'Configuration not found')
    }

    await requireConfigurationScope(existing.workspaceId)

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
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
          default:
            return true
        }
      }

      if (!validateValue(value, existing.dataType)) {
        return jsonError(400, `Invalid value for data type ${existing.dataType}`)
      }
    }

    // Update configuration
    const updateData: any = {
      lastUpdatedBy: user.id
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
    return handleApiError(error)
  }
}

// DELETE /api/admin/settings/system/[id] - Delete system configuration
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
    const configurationId = params.id

    // Get existing configuration
    const existing = await prisma.systemConfiguration.findUnique({
      where: { id: configurationId }
    })

    if (!existing) {
      return jsonError(404, 'Configuration not found')
    }

    await requireConfigurationScope(existing.workspaceId)

    // Prevent deletion of required configurations
    if (existing.isRequired) {
      return jsonError(400, 'Cannot delete required configuration')
    }

    await prisma.systemConfiguration.delete({
      where: { id: configurationId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error)
  }
}
