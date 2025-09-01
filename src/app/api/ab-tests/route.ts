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

    // Get all A/B tests for user's workspaces
    const contentTests = await prisma.contentABTest.findMany({
      where: {
        workspaceId: { in: workspaceIds }
      },
      include: {
        variants: {
          include: {
            executions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const imageTests = await prisma.imageABTest.findMany({
      where: {
        workspaceId: { in: workspaceIds }
      },
      include: {
        variants: {
          include: {
            executions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Combine and format for dashboard
    const allTests = [
      ...contentTests.map(test => ({
        id: test.id,
        type: 'content',
        name: test.name,
        description: test.description,
        status: test.status,
        campaignId: test.campaignId,
        variants: test.variants.length,
        executions: test.variants.reduce((sum, v) => sum + v.executions.length, 0),
        createdAt: test.createdAt
      })),
      ...imageTests.map(test => ({
        id: test.id,
        type: 'image',
        name: test.name,
        description: test.description,
        status: test.status,
        campaignId: test.campaignId,
        variants: test.variants.length,
        executions: test.variants.reduce((sum, v) => sum + v.executions.length, 0),
        createdAt: test.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ abTests: allTests })
  } catch (error) {
    console.error('Error fetching A/B tests:', error)
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

    // Validate campaign exists and user has access
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: data.campaignId,
        workspaceId
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 })
    }

    // Create content A/B test (could also create image test based on type)
    const abTest = await prisma.contentABTest.create({
      data: {
        workspaceId,
        campaignId: data.campaignId,
        name: data.testName,
        description: data.description,
        trafficSplit: data.splitPercentage[0], // percentage for variant A
        testMetrics: data.metrics,
        status: 'ACTIVE',
        variants: {
          create: [
            {
              name: data.variantA.name,
              content: data.variantA.content,
              trafficPercentage: data.splitPercentage[0]
            },
            {
              name: data.variantB.name,
              content: data.variantB.content,
              trafficPercentage: 100 - data.splitPercentage[0]
            }
          ]
        }
      },
      include: {
        variants: true,
        campaign: true
      }
    })

    return NextResponse.json({ 
      abTest,
      message: 'A/B test created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating A/B test:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}