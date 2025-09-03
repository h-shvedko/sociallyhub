import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      include: { workspace: true }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Get all reports for user's workspaces
    const reports = await prisma.campaignReport.findMany({
      where: {
        workspaceId: { in: workspaceIds }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error fetching campaign reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const data = await request.json()

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceId = userWorkspace.workspaceId

    // Validate campaigns exist and user has access
    if (data.campaigns && data.campaigns.length > 0) {
      const campaignCount = await prisma.campaign.count({
        where: {
          id: { in: data.campaigns },
          workspaceId
        }
      })

      if (campaignCount !== data.campaigns.length) {
        return NextResponse.json({ error: 'Some campaigns not found or access denied' }, { status: 404 })
      }
    }

    // Create campaign report
    const report = await prisma.campaignReport.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description,
        type: data.type,
        format: data.format,
        frequency: data.frequency,
        campaigns: data.campaigns || [],
        sections: data.includeSections || {},
        recipients: data.recipients || null,
        status: 'READY'
      }
    })

    return NextResponse.json({ 
      report,
      message: 'Campaign report created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}