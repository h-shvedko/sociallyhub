import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: true }
    })

    if (!user?.workspaces?.[0]) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const category = searchParams.get('category') || ''
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true'

    // Build where clause
    const where: any = {}
    if (category) {
      where.categoryId = category
    }
    if (!includeInactive) {
      where.isActive = true
    }

    // Fetch FAQs
    const faqs = await prisma.helpFAQ.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: [
        { categoryId: 'asc' },
        { sortOrder: 'asc' }
      ]
    })

    if (format === 'json') {
      const exportData = faqs.map(faq => {
        const data: any = {
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category.name,
          categoryId: faq.categoryId,
          tags: faq.tags,
          sortOrder: faq.sortOrder,
          isActive: faq.isActive,
          isPinned: faq.isPinned,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString()
        }

        if (includeAnalytics) {
          data.analytics = {
            views: faq.views,
            helpfulVotes: faq.helpfulVotes,
            notHelpfulVotes: faq.notHelpfulVotes,
            helpfulnessRate: faq.helpfulVotes + faq.notHelpfulVotes > 0
              ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
              : '0'
          }
        }

        return data
      })

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="faqs-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      })

    } else if (format === 'csv') {
      const headers = [
        'ID',
        'Question',
        'Answer',
        'Category',
        'CategoryId',
        'Tags',
        'SortOrder',
        'IsActive',
        'IsPinned',
        'CreatedAt',
        'UpdatedAt'
      ]

      if (includeAnalytics) {
        headers.push('Views', 'HelpfulVotes', 'NotHelpfulVotes', 'HelpfulnessRate')
      }

      const csvRows = [headers.join(',')]

      faqs.forEach(faq => {
        const row = [
          faq.id,
          `"${faq.question.replace(/"/g, '""')}"`,
          `"${faq.answer.replace(/"/g, '""')}"`,
          `"${faq.category.name}"`,
          faq.categoryId,
          `"${faq.tags.join(';')}"`,
          faq.sortOrder,
          faq.isActive,
          faq.isPinned,
          faq.createdAt.toISOString(),
          faq.updatedAt.toISOString()
        ]

        if (includeAnalytics) {
          const helpfulnessRate = faq.helpfulVotes + faq.notHelpfulVotes > 0
            ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
            : '0'

          row.push(
            faq.views.toString(),
            faq.helpfulVotes.toString(),
            faq.notHelpfulVotes.toString(),
            helpfulnessRate
          )
        }

        csvRows.push(row.join(','))
      })

      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="faqs-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })

    } else if (format === 'markdown') {
      let markdown = '# FAQ Export\n\n'
      markdown += `Generated on: ${new Date().toLocaleDateString()}\n\n`

      // Group by category
      const faqsByCategory = faqs.reduce((acc, faq) => {
        const categoryName = faq.category.name
        if (!acc[categoryName]) {
          acc[categoryName] = []
        }
        acc[categoryName].push(faq)
        return acc
      }, {} as Record<string, typeof faqs>)

      Object.entries(faqsByCategory).forEach(([categoryName, categoryFaqs]) => {
        markdown += `## ${categoryName}\n\n`

        categoryFaqs.forEach((faq, index) => {
          markdown += `### ${index + 1}. ${faq.question}\n\n`
          markdown += `${faq.answer}\n\n`

          if (faq.tags.length > 0) {
            markdown += `**Tags:** ${faq.tags.join(', ')}\n\n`
          }

          if (includeAnalytics) {
            const helpfulnessRate = faq.helpfulVotes + faq.notHelpfulVotes > 0
              ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
              : '0'

            markdown += `**Analytics:** ${faq.views} views, ${helpfulnessRate}% helpful\n\n`
          }

          markdown += '---\n\n'
        })
      })

      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="faqs-export-${new Date().toISOString().split('T')[0]}.md"`
        }
      })

    } else {
      return NextResponse.json(
        { error: 'Unsupported format. Use json, csv, or markdown.' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error exporting FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}