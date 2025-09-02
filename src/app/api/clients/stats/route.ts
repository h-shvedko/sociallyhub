import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'

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

    // Mock client statistics - in real implementation, this would calculate from database
    const stats = {
      totalClients: 15,
      activeClients: 10,
      prospectClients: 3,
      churnedClients: 2,
      totalRevenue: 185000,
      monthlyRevenue: 25000,
      averageContractValue: 8500,
      clientSatisfactionScore: 4.7,
      retentionRate: 92,
      churnRate: 8,
      onboardingCompletionRate: 85,
      responseTime: 2.5,
      clientsByIndustry: {
        'Technology': 6,
        'Healthcare': 3,
        'Finance': 2,
        'Retail': 2,
        'Education': 1,
        'Other': 1
      },
      clientsByServiceLevel: {
        'Basic': 3,
        'Standard': 6,
        'Premium': 4,
        'Enterprise': 2
      },
      revenueByMonth: [
        { month: 'Jan', revenue: 22000 },
        { month: 'Feb', revenue: 25000 },
        { month: 'Mar', revenue: 24000 },
        { month: 'Apr', revenue: 28000 },
        { month: 'May', revenue: 25000 },
        { month: 'Jun', revenue: 26000 }
      ],
      growthMetrics: {
        newClientsThisMonth: 3,
        newClientsLastMonth: 2,
        growthRate: 50,
        projectedRevenue: 320000,
        clientLifetimeValue: 15000,
        acquisitionCost: 1200
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching client stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientStatsHandler, 'clients-stats')