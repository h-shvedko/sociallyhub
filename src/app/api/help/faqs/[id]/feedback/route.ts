import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/help/faqs/[id]/feedback - Submit helpfulness vote
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid feedback value' },
        { status: 400 }
      )
    }

    const faq = await prisma.helpFAQ.findUnique({
      where: { id }
    })

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Update the appropriate vote count
    const updatedFAQ = await prisma.helpFAQ.update({
      where: { id },
      data: helpful
        ? { helpfulVotes: { increment: 1 } }
        : { notHelpfulVotes: { increment: 1 } }
    })

    return NextResponse.json({
      helpfulVotes: updatedFAQ.helpfulVotes,
      notHelpfulVotes: updatedFAQ.notHelpfulVotes,
      totalVotes: updatedFAQ.helpfulVotes + updatedFAQ.notHelpfulVotes
    })
  } catch (error) {
    console.error('Failed to submit FAQ feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}