import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/help/articles/[slug]/feedback - Submit helpfulness vote
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { helpful } = await request.json()

    if (typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid feedback value' },
        { status: 400 }
      )
    }

    const article = await prisma.helpArticle.findUnique({
      where: { slug }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Update the appropriate vote count
    const updatedArticle = await prisma.helpArticle.update({
      where: { id: article.id },
      data: helpful
        ? { helpfulVotes: { increment: 1 } }
        : { notHelpfulVotes: { increment: 1 } }
    })

    return NextResponse.json({
      helpfulVotes: updatedArticle.helpfulVotes,
      notHelpfulVotes: updatedArticle.notHelpfulVotes,
      totalVotes: updatedArticle.helpfulVotes + updatedArticle.notHelpfulVotes
    })
  } catch (error) {
    console.error('Failed to submit article feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}