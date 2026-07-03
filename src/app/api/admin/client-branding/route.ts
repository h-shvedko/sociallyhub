import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return jsonError(400, 'Workspace ID is required')
    }

    // Workspace-scoped admin surface (ADR-0004): OWNER/ADMIN of THIS workspace.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Get client branding for the workspace
    const clientBranding = await prisma.clientBranding.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          select: { name: true }
        },
        client: {
          select: { name: true, company: true }
        }
      }
    })

    return NextResponse.json({ branding: clientBranding })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication precedes body parsing (docs/api-conventions.md §1).
    await requireSession()

    const body = await request.json()
    const { workspaceId, clientId, ...brandingData } = body

    if (!workspaceId) {
      return jsonError(400, 'Workspace ID is required')
    }

    // Workspace-scoped admin surface (ADR-0004): OWNER/ADMIN of THIS workspace.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Validate allowed fields
    const allowedFields = [
      'title', 'logoUrl', 'faviconUrl', 'primaryColor', 'secondaryColor', 'accentColor',
      'colorPalette', 'fontFamily', 'fontScale', 'layoutConfig', 'customCSS',
      'features', 'isWhiteLabel', 'customDomain', 'hideCredits'
    ]

    const updateData: any = { workspaceId }
    if (clientId) updateData.clientId = clientId

    for (const [key, value] of Object.entries(brandingData)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    // Validate color formats
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor']
    for (const field of colorFields) {
      if (updateData[field] && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(updateData[field])) {
        return jsonError(400, `Invalid color format for ${field}. Use hex format (#RRGGBB or #RGB)`)
      }
    }

    // Validate custom domain format
    if (updateData.customDomain && !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(updateData.customDomain)) {
      return jsonError(400, 'Invalid custom domain format')
    }

    // Upsert client branding
    const clientBranding = await prisma.clientBranding.upsert({
      where: { workspaceId },
      update: updateData,
      create: updateData,
      include: {
        workspace: {
          select: { name: true }
        },
        client: {
          select: { name: true, company: true }
        }
      }
    })

    return NextResponse.json({
      branding: clientBranding,
      message: 'Client branding updated successfully'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return jsonError(400, 'Workspace ID is required')
    }

    // Workspace-scoped admin surface (ADR-0004): OWNER/ADMIN of THIS workspace.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Delete client branding (revert to defaults)
    await prisma.clientBranding.delete({
      where: { workspaceId }
    })

    return NextResponse.json({
      message: 'Client branding reset to defaults'
    })
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'P2025') {
      // Record not found - already at defaults
      return NextResponse.json({
        message: 'Client branding already at defaults'
      })
    }

    return handleApiError(error)
  }
}
