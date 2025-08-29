import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

interface Widget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'progress' | 'activity_feed' | 'calendar' | 'gauge'
  title: string
  metric?: string
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'donut'
  size: 'small' | 'medium' | 'large' | 'full'
  color: string
  position: { x: number; y: number }
  config: Record<string, any>
}

interface CustomDashboard {
  id?: string
  name: string
  description?: string
  widgets: Widget[]
  layout?: string
  isDefault?: boolean
}

// GET - List all custom dashboards for the user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true, workspace: { select: { name: true } } }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Fetch custom dashboards from the database
    const customDashboards = await prisma.customDashboard.findMany({
      where: {
        userId,
        workspaceId: { in: workspaceIds }
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        widgets: true,
        layout: true,
        settings: true,
        isPublic: true,
        tags: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { name: true }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // If no dashboards exist, create a default one
    if (customDashboards.length === 0 && workspaceIds.length > 0) {
      const defaultDashboard = await prisma.customDashboard.create({
        data: {
          userId,
          workspaceId: workspaceIds[0],
          name: 'Default Dashboard',
          description: 'Default analytics dashboard layout',
          isDefault: true,
          layout: { cols: 12, rowHeight: 150, margin: [16, 16] },
          widgets: [
            {
              id: '1',
              type: 'metric',
              title: 'Total Posts',
              metric: 'posts_published',
              size: 'small',
              color: 'blue',
              position: { x: 0, y: 0 },
              config: { showTrend: true }
            },
            {
              id: '2',
              type: 'chart',
              title: 'Engagement Trend',
              chartType: 'line',
              size: 'medium',
              color: 'green',
              position: { x: 1, y: 0 },
              config: { timeRange: '30d' }
            }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          isDefault: true,
          widgets: true,
          layout: true,
          settings: true,
          isPublic: true,
          tags: true,
          workspaceId: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: { name: true }
          }
        }
      })

      return NextResponse.json({ dashboards: [defaultDashboard] })
    }

    return NextResponse.json({ dashboards: customDashboards })

  } catch (error) {
    console.error('Get dashboards API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch custom dashboards' },
      { status: 500 }
    )
  }
}

// POST - Create a new custom dashboard
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const dashboardData: CustomDashboard = await request.json()

    // Get user's primary workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { workspaceId: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Create new dashboard in database
    const newDashboard = await prisma.customDashboard.create({
      data: {
        userId,
        workspaceId: userWorkspace.workspaceId,
        name: dashboardData.name,
        description: dashboardData.description,
        isDefault: dashboardData.isDefault || false,
        layout: dashboardData.layout || { cols: 12, rowHeight: 150, margin: [16, 16] },
        widgets: dashboardData.widgets || [],
        settings: dashboardData.settings || {},
        isPublic: false,
        tags: []
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        widgets: true,
        layout: true,
        settings: true,
        isPublic: true,
        tags: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({ 
      dashboard: newDashboard,
      message: 'Dashboard created successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('Create dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to create custom dashboard' },
      { status: 500 }
    )
  }
}

// PUT - Update an existing custom dashboard
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const dashboardData: CustomDashboard & { id: string } = await request.json()

    if (!dashboardData.id) {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 })
    }

    // Check if dashboard exists and belongs to user
    const existingDashboard = await prisma.customDashboard.findFirst({
      where: {
        id: dashboardData.id,
        userId
      }
    })

    if (!existingDashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    // Update the dashboard in database
    const updatedDashboard = await prisma.customDashboard.update({
      where: {
        id: dashboardData.id
      },
      data: {
        name: dashboardData.name ?? existingDashboard.name,
        description: dashboardData.description ?? existingDashboard.description,
        isDefault: dashboardData.isDefault ?? existingDashboard.isDefault,
        layout: dashboardData.layout ?? existingDashboard.layout,
        widgets: dashboardData.widgets ?? existingDashboard.widgets,
        settings: dashboardData.settings ?? existingDashboard.settings,
        tags: dashboardData.tags ?? existingDashboard.tags
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        widgets: true,
        layout: true,
        settings: true,
        isPublic: true,
        tags: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({ 
      dashboard: updatedDashboard,
      message: 'Dashboard updated successfully' 
    })

  } catch (error) {
    console.error('Update dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to update custom dashboard' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a custom dashboard
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const dashboardId = searchParams.get('id')

    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 })
    }

    // Check if dashboard exists and belongs to user
    const existingDashboard = await prisma.customDashboard.findFirst({
      where: {
        id: dashboardId,
        userId
      }
    })

    if (!existingDashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    // Prevent deleting the default dashboard if it's the only one
    if (existingDashboard.isDefault) {
      const dashboardCount = await prisma.customDashboard.count({
        where: {
          userId,
          workspaceId: existingDashboard.workspaceId
        }
      })

      if (dashboardCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot delete the last dashboard. Please create another dashboard first.' 
        }, { status: 400 })
      }
    }

    // Delete the dashboard from database
    await prisma.customDashboard.delete({
      where: {
        id: dashboardId
      }
    })

    return NextResponse.json({ 
      message: 'Dashboard deleted successfully' 
    })

  } catch (error) {
    console.error('Delete dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to delete custom dashboard' },
      { status: 500 }
    )
  }
}