import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: workspaceId || ''
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get client branding for the workspace
    const clientBranding = await prisma.clientBranding.findUnique({
      where: { workspaceId: workspaceId || '' },
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
    console.error('Error fetching client branding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const body = await request.json()
    const { workspaceId, clientId, ...brandingData } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

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
        return NextResponse.json(
          { error: `Invalid color format for ${field}. Use hex format (#RRGGBB or #RGB)` },
          { status: 400 }
        )
      }
    }

    // Validate custom domain format
    if (updateData.customDomain && !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(updateData.customDomain)) {
      return NextResponse.json(
        { error: 'Invalid custom domain format' },
        { status: 400 }
      )
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
    console.error('Error updating client branding:', error)
    return NextResponse.json(
      { error: 'Failed to update client branding' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to the workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Delete client branding (revert to defaults)
    await prisma.clientBranding.delete({
      where: { workspaceId }
    })

    return NextResponse.json({ 
      message: 'Client branding reset to defaults' 
    })
  } catch (error) {
    if (error.code === 'P2025') {
      // Record not found - already at defaults
      return NextResponse.json({ 
        message: 'Client branding already at defaults' 
      })
    }
    
    console.error('Error deleting client branding:', error)
    return NextResponse.json(
      { error: 'Failed to reset client branding' },
      { status: 500 }
    )
  }
}