import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

async function getClientStatsHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get user's workspace
    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const actualWorkspaceId = userWorkspace.workspaceId

    // Calculate real statistics from database
    const totalClients = await prisma.client.count({
      where: { workspaceId: actualWorkspaceId }
    })

    const activeClients = await prisma.client.count({
      where: { 
        workspaceId: actualWorkspaceId,
        status: 'ACTIVE'
      }
    })

    const prospectClients = await prisma.client.count({
      where: { 
        workspaceId: actualWorkspaceId,
        status: 'PROSPECT'
      }
    })

    const churnedClients = await prisma.client.count({
      where: { 
        workspaceId: actualWorkspaceId,
        status: 'CHURNED'
      }
    })

    // Get clients grouped by industry
    const clientsByIndustryRaw = await prisma.client.groupBy({
      by: ['industry'],
      where: { 
        workspaceId: actualWorkspaceId,
        industry: { not: null }
      },
      _count: true
    })

    const clientsByIndustry = clientsByIndustryRaw.reduce((acc, item) => {
      if (item.industry) {
        acc[item.industry] = item._count
      }
      return acc
    }, {} as { [key: string]: number })

    // Get new clients this month and last month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    const newClientsThisMonth = await prisma.client.count({
      where: {
        workspaceId: actualWorkspaceId,
        createdAt: { gte: startOfMonth }
      }
    })

    const newClientsLastMonth = await prisma.client.count({
      where: {
        workspaceId: actualWorkspaceId,
        createdAt: { 
          gte: startOfLastMonth,
          lte: endOfLastMonth
        }
      }
    })

    const growthRate = newClientsLastMonth > 0 
      ? ((newClientsThisMonth - newClientsLastMonth) / newClientsLastMonth) * 100 
      : 0

    const stats = {
      totalClients,
      activeClients,
      prospectClients,
      churnedClients,
      totalRevenue: 0, // TODO: Implement when billing is added
      monthlyRevenue: 0, // TODO: Implement when billing is added
      averageContractValue: 0, // TODO: Implement when billing is added
      clientSatisfactionScore: 0, // TODO: Implement when surveys are added
      retentionRate: totalClients > 0 ? (activeClients / totalClients) * 100 : 0,
      churnRate: totalClients > 0 ? (churnedClients / totalClients) * 100 : 0,
      onboardingCompletionRate: 0, // TODO: Implement when onboarding tracking is added
      responseTime: 0, // TODO: Implement when communication tracking is added
      clientsByIndustry,
      clientsByServiceLevel: {}, // TODO: Implement when service levels are tracked
      revenueByMonth: [], // TODO: Implement when billing is added
      growthMetrics: {
        newClientsThisMonth,
        newClientsLastMonth,
        growthRate,
        projectedRevenue: 0, // TODO: Implement projections
        clientLifetimeValue: 0, // TODO: Implement when billing is added
        acquisitionCost: 0 // TODO: Implement when cost tracking is added
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching client stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientStatsHandler, 'clients-stats')