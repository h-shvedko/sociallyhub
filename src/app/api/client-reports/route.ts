import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/client-reports - List all client reports for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    // Build where clause
    const where: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    // Get reports with related data
    const reports = await prisma.clientReport.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get total count
    const totalCount = await prisma.clientReport.count({ where })

    console.log(`📊 Retrieved ${reports.length} client reports for workspace ${userWorkspace.workspaceId}`)

    return NextResponse.json({
      reports,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching client reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

// POST /api/client-reports - Create new client report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    // Validate client exists in workspace
    const client = await prisma.client.findFirst({
      where: {
        id: body.clientId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Create report
    const report = await prisma.clientReport.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        clientId: body.clientId,
        templateId: body.templateId || null,
        name: body.name,
        description: body.description || null,
        type: body.type || 'CUSTOM',
        format: body.format || 'PDF',
        frequency: body.frequency || 'ON_DEMAND',
        status: 'DRAFT',
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

    console.log(`📊 Created client report ${report.id} for client ${client.name}`)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Error creating client report:', error)
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    )
  }
}