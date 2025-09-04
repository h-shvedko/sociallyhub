import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

// DELETE /api/client-reports/[id] - Delete client report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: reportId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true,
        role: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if report exists and belongs to the workspace
    const report = await prisma.clientReport.findFirst({
      where: {
        id: reportId,
        workspaceId: userWorkspace.workspaceId,
      },
      include: {
        client: true
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Delete the report
    await prisma.clientReport.delete({
      where: {
        id: reportId,
      }
    })

    console.log(`📊 Deleted client report ${reportId} for client ${report.client.name}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Report deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting client report:', error)
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    )
  }
}

// GET /api/client-reports/[id] - Get specific client report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: reportId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Get the report with full details
    const report = await prisma.clientReport.findFirst({
      where: {
        id: reportId,
        workspaceId: userWorkspace.workspaceId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error fetching client report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    )
  }
}

// PUT /api/client-reports/[id] - Update client report
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: reportId } = await params
    const body = await request.json()

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true,
        role: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if report exists and belongs to the workspace
    const existingReport = await prisma.clientReport.findFirst({
      where: {
        id: reportId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Verify client belongs to the workspace
    const client = await prisma.client.findFirst({
      where: {
        id: body.clientId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Update report
    const report = await prisma.clientReport.update({
      where: {
        id: reportId,
      },
      data: {
        clientId: body.clientId,
        templateId: body.templateId || null,
        name: body.name,
        description: body.description || null,
        type: body.type || 'CUSTOM',
        format: body.format || 'PDF',
        frequency: body.frequency || 'ON_DEMAND',
        config: body.config || null,
        recipients: body.recipients || []
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    console.log(`📊 Updated client report ${report.id} for client ${client.name}`)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Error updating client report:', error)
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    )
  }
}