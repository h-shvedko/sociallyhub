import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/client-reports/templates - List report templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

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

    if (type) {
      where.type = type
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const templates = await prisma.clientReportTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    console.log(`📊 Retrieved ${templates.length} report templates`)

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching report templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/client-reports/templates - Create new report template
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
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const template = await prisma.clientReportTemplate.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        name: body.name,
        description: body.description || null,
        type: body.type || 'CUSTOM',
        format: body.format || ['PDF'],
        metrics: body.metrics || [],
        sections: body.sections || {},
        isActive: body.isActive !== false,
        isDefault: body.isDefault || false,
        customDashboard: body.customDashboard || false,
        autoEmail: body.autoEmail || false,
        emailTemplate: body.emailTemplate || null
      }
    })

    console.log(`📊 Created report template ${template.id}: ${template.name}`)

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('Error creating report template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}