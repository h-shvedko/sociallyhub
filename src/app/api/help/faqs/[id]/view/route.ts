// @api-auth: public
import { NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { buildDedupKey, recordEngagementOnce } from '@/lib/api/engagement'

// POST /api/help/faqs/[id]/view - Track FAQ view.
// Public, but deduped to one counted view per identity per FAQ per day
// (EngagementEvent unique constraint) and IP rate limited (ADR-0005 item 5).
export const POST = withApiAuth<{ id: string }>(
  async (request, { params, user }) => {
    const { id } = params

    const faq = await prisma.helpFAQ.findUnique({
      where: { id },
    })

    if (!faq) {
      return jsonError(404, 'FAQ not found')
    }

    // Dedup: only the first view for this FAQ today increments the counter.
    const dedupKey = buildDedupKey(request, user)
    const firstToday = await recordEngagementOnce({
      eventType: 'faq_view',
      targetType: 'help_faq',
      targetId: id,
      dedupKey,
    })

    if (!firstToday) {
      // Already counted a view for this FAQ today — do not increment.
      return NextResponse.json({
        success: true,
        views: faq.views,
        alreadyRecorded: true,
      })
    }

    // Increment view count
    const updatedFAQ = await prisma.helpFAQ.update({
      where: { id },
      data: {
        views: { increment: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      views: updatedFAQ.views,
    })
  },
  { access: 'public', limit: { key: 'ip', points: 30, windowSec: 60 } }
)
