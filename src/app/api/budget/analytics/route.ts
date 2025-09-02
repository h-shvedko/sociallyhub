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
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, workspaceId }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Get campaigns with budget data
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        client: {
          select: { id: true, name: true }
        }
      }
    })

    // Calculate budget analytics
    const analytics = campaigns.map(campaign => {
      const budget = campaign.budget as any
      const totalBudget = budget?.totalBudget || 0
      const spentAmount = budget?.spentAmount || 0
      const remainingAmount = budget?.remainingAmount || (totalBudget - spentAmount)
      const dailyBudget = budget?.dailyBudget || 0
      
      const spentPercentage = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0
      const daysRemaining = campaign.endDate ? 
        Math.ceil((new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0
      
      const projectedSpend = dailyBudget > 0 && daysRemaining > 0 ? 
        spentAmount + (dailyBudget * daysRemaining) : spentAmount
      
      const budgetPacing = totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0
      
      let alertLevel = 'none'
      if (spentPercentage >= 90) alertLevel = 'critical'
      else if (spentPercentage >= 75) alertLevel = 'warning'

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        clientName: campaign.client?.name || 'No Client',
        status: campaign.status,
        budget: {
          total: totalBudget,
          spent: spentAmount,
          remaining: remainingAmount,
          daily: dailyBudget,
          currency: budget?.currency || 'USD'
        },
        performance: {
          spentPercentage: Math.round(spentPercentage * 10) / 10,
          budgetPacing: Math.round(budgetPacing * 10) / 10,
          projectedSpend,
          daysRemaining,
          alertLevel,
          isOverBudget: spentAmount > totalBudget,
          burnRate: dailyBudget > 0 ? spentAmount / Math.max(1, Math.ceil((new Date().getTime() - new Date(campaign.startDate || new Date()).getTime()) / (1000 * 60 * 60 * 24))) : 0
        },
        dates: {
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          createdAt: campaign.createdAt
        }
      }
    })

    // Calculate overall statistics
    const totalBudget = analytics.reduce((sum, item) => sum + item.budget.total, 0)
    const totalSpent = analytics.reduce((sum, item) => sum + item.budget.spent, 0)
    const totalRemaining = analytics.reduce((sum, item) => sum + item.budget.remaining, 0)
    
    const overBudgetCampaigns = analytics.filter(item => item.performance.isOverBudget).length
    const criticalAlerts = analytics.filter(item => item.performance.alertLevel === 'critical').length
    const warningAlerts = analytics.filter(item => item.performance.alertLevel === 'warning').length

    // Budget by status
    const budgetByStatus = campaigns.reduce((acc: any, campaign) => {
      const budget = (campaign.budget as any)?.totalBudget || 0
      acc[campaign.status] = (acc[campaign.status] || 0) + budget
      return acc
    }, {})

    // Monthly budget trends (last 6 months)
    const monthlyTrends = []
    const today = new Date()
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      
      const monthCampaigns = campaigns.filter(campaign => {
        const startDate = new Date(campaign.startDate || campaign.createdAt)
        return startDate >= month && startDate <= monthEnd
      })
      
      const monthBudget = monthCampaigns.reduce((sum, campaign) => {
        return sum + ((campaign.budget as any)?.totalBudget || 0)
      }, 0)
      
      const monthSpent = monthCampaigns.reduce((sum, campaign) => {
        return sum + ((campaign.budget as any)?.spentAmount || 0)
      }, 0)

      monthlyTrends.push({
        month: month.toISOString().substr(0, 7),
        monthName: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        budget: monthBudget,
        spent: monthSpent,
        campaigns: monthCampaigns.length
      })
    }

    const overview = {
      totalBudget,
      totalSpent,
      totalRemaining,
      spentPercentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0,
      campaignCount: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
      alerts: {
        critical: criticalAlerts,
        warning: warningAlerts,
        overBudget: overBudgetCampaigns,
        total: criticalAlerts + warningAlerts + overBudgetCampaigns
      }
    }

    return NextResponse.json({
      overview,
      campaigns: analytics,
      trends: {
        monthly: monthlyTrends,
        budgetByStatus
      }
    })
  } catch (error) {
    console.error('Error fetching budget analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget analytics' },
      { status: 500 }
    )
  }
}