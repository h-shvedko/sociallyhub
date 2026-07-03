// @api-auth: public
import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { buildDedupKey, recordEngagementOnce } from '@/lib/api/engagement'

// POST /api/help/faqs/[id]/feedback - Submit helpfulness vote.
// Public, but deduped to one vote per identity per FAQ per day
// (EngagementEvent unique constraint) and IP rate limited (ADR-0005 item 5).
export const POST = withApiAuth<{ id: string }>(
  async (request, { params, user }) => {
    const { id } = params
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return jsonError(400, 'Invalid feedback value')
    }

    const faq = await prisma.helpFAQ.findUnique({
      where: { id },
    })

    if (!faq) {
      return jsonError(404, 'FAQ not found')
    }

    // Dedup: only the first feedback for this FAQ today increments a counter.
    const dedupKey = buildDedupKey(request, user)
    const firstToday = await recordEngagementOnce({
      eventType: 'faq_feedback',
      targetType: 'help_faq',
      targetId: id,
      dedupKey,
      value: helpful ? 'helpful' : 'not_helpful',
    })

    if (!firstToday) {
      // Already submitted feedback for this FAQ today — do not increment.
      return NextResponse.json({
        helpfulVotes: faq.helpfulVotes,
        notHelpfulVotes: faq.notHelpfulVotes,
        totalVotes: faq.helpfulVotes + faq.notHelpfulVotes,
        alreadyRecorded: true,
      })
    }

    // Update the appropriate vote count
    const updatedFAQ = await prisma.helpFAQ.update({
      where: { id },
      data: helpful
        ? { helpfulVotes: { increment: 1 } }
        : { notHelpfulVotes: { increment: 1 } },
    })

    return NextResponse.json({
      helpfulVotes: updatedFAQ.helpfulVotes,
      notHelpfulVotes: updatedFAQ.notHelpfulVotes,
      totalVotes: updatedFAQ.helpfulVotes + updatedFAQ.notHelpfulVotes,
    })
  },
  { access: 'public', limit: { key: 'ip', points: 30, windowSec: 60 } }
)
