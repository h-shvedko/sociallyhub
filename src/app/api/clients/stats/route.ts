import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
async function getClientStatsHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const userId = await normalizeUserId(session.user.id)
    
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceId = userWorkspace.workspaceId

    // Get real client statistics from database
    const [
      totalClients,
      clientsWithSocialAccounts,
      clientsWithCampaigns,
      clientsWithPosts,
      recentClients
    ] = await Promise.all([
      prisma.client.count({
        where: { workspaceId }
      }),
      prisma.client.count({
        where: { 
          workspaceId,
          socialAccounts: { some: {} }
        }
      }),
      prisma.client.count({
        where: { 
          workspaceId,
          campaigns: { some: {} }
        }
      }),
      prisma.client.count({
        where: { 
          workspaceId,
          posts: { some: {} }
        }
      }),
      prisma.client.count({
        where: { 
          workspaceId,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      })
    ])

    // Only real, DB-derived numbers (ADR-0023). Fabricated revenue, industry/service-level
    // splits, satisfaction, retention/churn, onboarding, response-time and acquisition figures
    // were removed rather than re-invented — SociallyHub does not store that data yet.
    const activeClients = clientsWithSocialAccounts || clientsWithCampaigns || clientsWithPosts
    const engagementRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0

    const stats = {
      totalClients,
      activeClients,                                        // clients with a social account, campaign, or post
      prospectClients: Math.max(0, totalClients - activeClients),
      recentClients,                                        // new clients in the last 30 days
      engagementRate,                                       // % of clients with any active social/campaign/post
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching client stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientStatsHandler, 'clients-stats')