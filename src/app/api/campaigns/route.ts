import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { CampaignStatus, CampaignType } from '@/types/campaign'

export async function GET(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const clientId = searchParams.get('clientId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const skip = (page - 1) * limit

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Build filters
    const where: any = {
      workspaceId,
      ...(status && { status }),
      ...(type && { type }),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true
            }
          },
          posts: {
            select: {
              id: true,
              status: true
            }
          },
          _count: {
            select: {
              posts: true
            }
          }
        },
        orderBy: [
          { updatedAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.campaign.count({ where })
    ])

    return NextResponse.json({
      campaigns: campaigns.map(campaign => ({
        ...campaign,
        postCount: campaign._count.posts
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  }, 'campaigns-list')(request)
}

export async function POST(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      clientId,
      name,
      description,
      type = CampaignType.CUSTOM,
      status = CampaignStatus.DRAFT,
      startDate,
      endDate,
      objectives = [],
      budget,
      targeting,
      abTesting
    } = body

    if (!workspaceId || !name) {
      return NextResponse.json({ 
        error: 'Workspace ID and campaign name are required' 
      }, { status: 400 })
    }

    try {
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId,
          clientId: clientId || null,
          name,
          description: description || null,
          type,
          status,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          objectives: {
            objectives: objectives.map((obj: any) => ({
              ...obj,
              id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              currentValue: 0,
              isCompleted: false
            })),
            budget: budget ? {
              ...budget,
              spentAmount: 0,
              remainingAmount: budget.totalBudget || 0
            } : null,
            targeting,
            abTesting: abTesting?.isEnabled ? {
              ...abTesting,
              status: 'SETUP',
              variants: abTesting.variants?.map((variant: any, index: number) => ({
                ...variant,
                id: `var_${Date.now()}_${index}`,
                performance: {
                  impressions: 0,
                  reach: 0,
                  clicks: 0,
                  engagement: 0,
                  conversions: 0,
                  cost: 0,
                  conversionRate: 0,
                  clickThroughRate: 0,
                  engagementRate: 0,
                  costPerConversion: 0
                }
              })) || []
            } : null
          }
        },
        include: {
          client: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              posts: true
            }
          }
        }
      })

      return NextResponse.json({
        ...campaign,
        postCount: campaign._count.posts
      }, { status: 201 })
    } catch (error) {
      console.error('Error creating campaign:', error)
      return NextResponse.json({
        error: 'Failed to create campaign'
      }, { status: 500 })
    }
  }, 'campaigns-create')(request)
}