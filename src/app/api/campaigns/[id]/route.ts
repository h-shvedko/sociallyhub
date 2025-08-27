import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: params.id },
        include: {
          workspace: {
            select: {
              id: true,
              name: true
            }
          },
          client: {
            select: {
              id: true,
              name: true
            }
          },
          posts: {
            include: {
              variants: {
                include: {
                  socialAccount: {
                    select: {
                      id: true,
                      provider: true,
                      displayName: true
                    }
                  }
                }
              },
              assets: {
                include: {
                  asset: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      // Calculate campaign analytics
      const analytics = await calculateCampaignAnalytics(campaign.id)

      return NextResponse.json({
        ...campaign,
        analytics
      })
    } catch (error) {
      console.error('Error fetching campaign:', error)
      return NextResponse.json({
        error: 'Failed to fetch campaign'
      }, { status: 500 })
    }
  }, 'campaign-get')(request)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const body = await request.json()
      const {
        name,
        description,
        startDate,
        endDate,
        objectives,
        status
      } = body

      const campaign = await prisma.campaign.update({
        where: { id: params.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          ...(objectives && { 
            objectives: {
              ...objectives,
              objectives: objectives.objectives?.map((obj: any) => ({
                ...obj,
                id: obj.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              }))
            }
          }),
          ...(status && { 
            objectives: {
              ...(typeof objectives === 'object' ? objectives : {}),
              status
            }
          }),
          updatedAt: new Date()
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
      })
    } catch (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json({
        error: 'Failed to update campaign'
      }, { status: 500 })
    }
  }, 'campaign-update')(request)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      // Check if campaign exists and has posts
      const campaign = await prisma.campaign.findUnique({
        where: { id: params.id },
        include: {
          _count: {
            select: {
              posts: true
            }
          }
        }
      })

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }

      if (campaign._count.posts > 0) {
        return NextResponse.json({
          error: 'Cannot delete campaign with associated posts'
        }, { status: 400 })
      }

      await prisma.campaign.delete({
        where: { id: params.id }
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Error deleting campaign:', error)
      return NextResponse.json({
        error: 'Failed to delete campaign'
      }, { status: 500 })
    }
  }, 'campaign-delete')(request)
}

// Helper function to calculate campaign analytics
async function calculateCampaignAnalytics(campaignId: string) {
  try {
    const posts = await prisma.post.findMany({
      where: { campaignId },
      include: {
        variants: true,
        metrics: true
      }
    })

    const analytics = {
      totalPosts: posts.length,
      publishedPosts: posts.filter(p => p.status === 'PUBLISHED').length,
      scheduledPosts: posts.filter(p => p.status === 'SCHEDULED').length,
      draftPosts: posts.filter(p => p.status === 'DRAFT').length,
      totalVariants: posts.reduce((sum, post) => sum + post.variants.length, 0),
      successfulVariants: posts.reduce((sum, post) => 
        sum + post.variants.filter(v => v.status === 'PUBLISHED').length, 0
      ),
      failedVariants: posts.reduce((sum, post) => 
        sum + post.variants.filter(v => v.status === 'FAILED').length, 0
      ),
      metrics: {
        totalReach: 0,
        totalImpressions: 0,
        totalEngagement: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalSpent: 0,
        averageEngagementRate: 0,
        averageCTR: 0,
        averageCPC: 0,
        averageCPA: 0
      }
    }

    // Calculate aggregated metrics from post metrics
    const allMetrics = posts.flatMap(post => post.metrics)
    if (allMetrics.length > 0) {
      analytics.metrics = allMetrics.reduce((acc, metric) => ({
        totalReach: acc.totalReach + (metric.value || 0),
        totalImpressions: acc.totalImpressions + (metric.metricType === 'impressions' ? metric.value : 0),
        totalEngagement: acc.totalEngagement + (metric.metricType === 'engagement' ? metric.value : 0),
        totalClicks: acc.totalClicks + (metric.metricType === 'clicks' ? metric.value : 0),
        totalConversions: acc.totalConversions + (metric.metricType === 'conversions' ? metric.value : 0),
        totalSpent: acc.totalSpent + (metric.metricType === 'cost' ? metric.value : 0),
        averageEngagementRate: 0, // Will calculate after
        averageCTR: 0, // Will calculate after
        averageCPC: 0, // Will calculate after
        averageCPA: 0 // Will calculate after
      }), analytics.metrics)

      // Calculate averages
      if (analytics.metrics.totalImpressions > 0) {
        analytics.metrics.averageEngagementRate = 
          (analytics.metrics.totalEngagement / analytics.metrics.totalImpressions) * 100
        analytics.metrics.averageCTR = 
          (analytics.metrics.totalClicks / analytics.metrics.totalImpressions) * 100
      }
      
      if (analytics.metrics.totalClicks > 0) {
        analytics.metrics.averageCPC = 
          analytics.metrics.totalSpent / analytics.metrics.totalClicks
      }
      
      if (analytics.metrics.totalConversions > 0) {
        analytics.metrics.averageCPA = 
          analytics.metrics.totalSpent / analytics.metrics.totalConversions
      }
    }

    return analytics
  } catch (error) {
    console.error('Error calculating campaign analytics:', error)
    return {
      totalPosts: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      draftPosts: 0,
      totalVariants: 0,
      successfulVariants: 0,
      failedVariants: 0,
      metrics: {
        totalReach: 0,
        totalImpressions: 0,
        totalEngagement: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalSpent: 0,
        averageEngagementRate: 0,
        averageCTR: 0,
        averageCPC: 0,
        averageCPA: 0
      }
    }
  }
}