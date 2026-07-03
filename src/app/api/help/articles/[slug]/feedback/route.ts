// @api-auth: public
import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { buildDedupKey, recordEngagementOnce } from '@/lib/api/engagement'

// POST /api/help/articles/[slug]/feedback - Submit helpfulness vote.
// Public, but deduped to one vote per identity per article per day
// (EngagementEvent unique constraint) and IP rate limited (ADR-0005 item 5).
export const POST = withApiAuth<{ slug: string }>(
  async (request, { params, user }) => {
    const { slug } = params
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return jsonError(400, 'Invalid feedback value')
    }

    const article = await prisma.helpArticle.findUnique({
      where: { slug },
    })

    if (!article) {
      return jsonError(404, 'Article not found')
    }

    // Dedup: only the first feedback for this article today increments a counter.
    const dedupKey = buildDedupKey(request, user)
    const firstToday = await recordEngagementOnce({
      eventType: 'article_feedback',
      targetType: 'help_article',
      targetId: article.id,
      dedupKey,
      value: helpful ? 'helpful' : 'not_helpful',
    })

    if (!firstToday) {
      // Already submitted feedback for this article today — do not increment.
      return NextResponse.json({
        helpfulVotes: article.helpfulVotes,
        notHelpfulVotes: article.notHelpfulVotes,
        totalVotes: article.helpfulVotes + article.notHelpfulVotes,
        alreadyRecorded: true,
      })
    }

    // Update the appropriate vote count
    const updatedArticle = await prisma.helpArticle.update({
      where: { id: article.id },
      data: helpful
        ? { helpfulVotes: { increment: 1 } }
        : { notHelpfulVotes: { increment: 1 } },
    })

    return NextResponse.json({
      helpfulVotes: updatedArticle.helpfulVotes,
      notHelpfulVotes: updatedArticle.notHelpfulVotes,
      totalVotes: updatedArticle.helpfulVotes + updatedArticle.notHelpfulVotes,
    })
  },
  { access: 'public', limit: { key: 'ip', points: 30, windowSec: 60 } }
)
