import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''

    // Build where clause for FAQs
    const where: any = {}
    if (category) {
      where.categoryId = category
    }

    // Get basic FAQ stats
    const [
      totalFaqs,
      activeFaqs,
      totalViews,
      totalVotes,
      topFaqs,
      categoryStats,
      helpfulnessStats
    ] = await Promise.all([
      // Total FAQs
      prisma.helpFAQ.count({ where }),

      // Active FAQs
      prisma.helpFAQ.count({ where: { ...where, isActive: true } }),

      // Total views
      prisma.helpFAQ.aggregate({
        where,
        _sum: { views: true }
      }),

      // Total votes
      prisma.helpFAQ.aggregate({
        where,
        _sum: {
          helpfulVotes: true,
          notHelpfulVotes: true
        }
      }),

      // Top performing FAQs
      prisma.helpFAQ.findMany({
        where,
        include: {
          category: {
            select: { name: true }
          }
        },
        orderBy: [
          { views: 'desc' },
          { helpfulVotes: 'desc' }
        ],
        take: 10
      }),

      // Category distribution
      prisma.helpFAQ.groupBy({
        by: ['categoryId'],
        where,
        _count: { id: true },
        _sum: {
          views: true,
          helpfulVotes: true,
          notHelpfulVotes: true
        }
      }),

      // Helpfulness distribution
      prisma.helpFAQ.findMany({
        where,
        select: {
          id: true,
          helpfulVotes: true,
          notHelpfulVotes: true
        }
      })
    ])

    // Get category names for distribution
    const categoryIds = categoryStats.map(stat => stat.categoryId)
    const categories = await prisma.helpCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    })

    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat.id] = cat.name
      return acc
    }, {} as Record<string, string>)

    // Process category distribution
    const categoryDistribution = categoryStats.map(stat => ({
      categoryId: stat.categoryId,
      categoryName: categoryMap[stat.categoryId] || 'Unknown',
      count: stat._count.id,
      views: stat._sum.views || 0,
      helpfulVotes: stat._sum.helpfulVotes || 0,
      notHelpfulVotes: stat._sum.notHelpfulVotes || 0
    }))

    // Calculate helpfulness metrics
    const helpfulnessDistribution = helpfulnessStats.reduce((acc, faq) => {
      const total = faq.helpfulVotes + faq.notHelpfulVotes
      if (total === 0) {
        acc.noRating++
      } else {
        const rate = (faq.helpfulVotes / total) * 100
        if (rate >= 70) acc.helpful++
        else if (rate >= 30) acc.neutral++
        else acc.notHelpful++
      }
      return acc
    }, { helpful: 0, neutral: 0, notHelpful: 0, noRating: 0 })

    // Calculate average helpfulness rate
    const totalHelpfulVotes = totalVotes._sum.helpfulVotes || 0
    const totalNotHelpfulVotes = totalVotes._sum.notHelpfulVotes || 0
    const totalAllVotes = totalHelpfulVotes + totalNotHelpfulVotes
    const averageHelpfulnessRate = totalAllVotes > 0
      ? ((totalHelpfulVotes / totalAllVotes) * 100).toFixed(1)
      : '0'

    // Process top FAQs with helpfulness rate
    const topFaqsWithRate = topFaqs.map(faq => {
      const total = faq.helpfulVotes + faq.notHelpfulVotes
      const rate = total > 0 ? ((faq.helpfulVotes / total) * 100).toFixed(1) : '0'
      return {
        id: faq.id,
        question: faq.question,
        category: faq.category.name,
        views: faq.views,
        helpfulVotes: faq.helpfulVotes,
        notHelpfulVotes: faq.notHelpfulVotes,
        helpfulnessRate: rate,
        isPinned: faq.isPinned
      }
    })

    return NextResponse.json({
      overview: {
        totalFaqs,
        activeFaqs,
        totalViews: totalViews._sum.views || 0,
        averageHelpfulnessRate: parseFloat(averageHelpfulnessRate),
        totalVotes: totalAllVotes
      },
      trends: {
        // No per-day FAQ view/interaction events are recorded yet, and search
        // queries are not tracked — these are empty rather than fabricated
        // (ADR-0016: no fabricated data). They can be populated once real
        // event tracking exists.
        viewsTrend: [],
        categoryDistribution,
        helpfulnessDistribution
      },
      topPerforming: topFaqsWithRate,
      searchFrequency: [],
      insights: {
        mostViewedCategory: categoryDistribution.length > 0
          ? categoryDistribution.sort((a, b) => b.views - a.views)[0]?.categoryName
          : 'N/A',
        avgViewsPerFaq: totalFaqs > 0
          ? Math.round((totalViews._sum.views || 0) / totalFaqs)
          : 0,
        engagementRate: totalFaqs > 0
          ? ((totalAllVotes / totalFaqs) * 100).toFixed(1)
          : '0'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}