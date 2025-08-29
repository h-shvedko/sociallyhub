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
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // For now, we'll store dashboard configurations in a JSON field
    // In a real implementation, you might want a dedicated CustomDashboard model
    const dashboards = await prisma.userWorkspace.findMany({
      where: {
        userId,
        workspaceId: { in: workspaceIds }
      },
      select: {
        workspaceId: true,
        permissions: true, // We'll use permissions JSON field to store dashboard configs
        workspace: {
          select: { name: true }
        }
      }
    })

    // Extract dashboard configurations from permissions field
    const customDashboards = dashboards.map(uw => {
      const permissions = uw.permissions as any || {}
      const dashboardConfig = permissions.customDashboards || []
      
      return {
        workspaceId: uw.workspaceId,
        workspaceName: uw.workspace.name,
        dashboards: Array.isArray(dashboardConfig) ? dashboardConfig : [
          // Default dashboard configuration
          {
            id: 'default',
            name: 'Default Dashboard',
            description: 'Default analytics dashboard layout',
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
            ],
            isDefault: true
          }
        ]
      }
    })

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
      where: { userId, role: 'OWNER' },
      select: { workspaceId: true, permissions: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get existing permissions/dashboard configs
    const existingPermissions = userWorkspace.permissions as any || {}
    const existingDashboards = existingPermissions.customDashboards || []

    // Add new dashboard with generated ID
    const newDashboard = {
      ...dashboardData,
      id: `dashboard-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updatedDashboards = [...existingDashboards, newDashboard]

    // Update the permissions field with new dashboard configuration
    await prisma.userWorkspace.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: userWorkspace.workspaceId
        }
      },
      data: {
        permissions: {
          ...existingPermissions,
          customDashboards: updatedDashboards
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
    const dashboardData: CustomDashboard = await request.json()

    if (!dashboardData.id) {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 })
    }

    // Get user's primary workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, role: 'OWNER' },
      select: { workspaceId: true, permissions: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get existing permissions/dashboard configs
    const existingPermissions = userWorkspace.permissions as any || {}
    const existingDashboards = existingPermissions.customDashboards || []

    // Find and update the dashboard
    const dashboardIndex = existingDashboards.findIndex((d: any) => d.id === dashboardData.id)
    
    if (dashboardIndex === -1) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    // Update the dashboard
    existingDashboards[dashboardIndex] = {
      ...existingDashboards[dashboardIndex],
      ...dashboardData,
      updatedAt: new Date().toISOString()
    }

    // Update the permissions field
    await prisma.userWorkspace.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: userWorkspace.workspaceId
        }
      },
      data: {
        permissions: {
          ...existingPermissions,
          customDashboards: existingDashboards
        }
      }
    })

    return NextResponse.json({ 
      dashboard: existingDashboards[dashboardIndex],
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

    // Get user's primary workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, role: 'OWNER' },
      select: { workspaceId: true, permissions: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get existing permissions/dashboard configs
    const existingPermissions = userWorkspace.permissions as any || {}
    const existingDashboards = existingPermissions.customDashboards || []

    // Filter out the dashboard to delete
    const filteredDashboards = existingDashboards.filter((d: any) => d.id !== dashboardId)

    if (filteredDashboards.length === existingDashboards.length) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 })
    }

    // Update the permissions field
    await prisma.userWorkspace.update({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: userWorkspace.workspaceId
        }
      },
      data: {
        permissions: {
          ...existingPermissions,
          customDashboards: filteredDashboards
        }
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