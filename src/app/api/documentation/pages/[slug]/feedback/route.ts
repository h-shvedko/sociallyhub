import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/documentation/pages/[slug]/feedback - Submit feedback for documentation page
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { helpful } = body

    if (typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'helpful field must be a boolean' },
        { status: 400 }
      )
    }

    // Find the page
    const page = await prisma.documentationPage.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Update vote count
    const updateData = helpful
      ? { helpfulVotes: { increment: 1 } }
      : { notHelpfulVotes: { increment: 1 } }

    const updatedPage = await prisma.documentationPage.update({
      where: { id: page.id },
      data: updateData,
      select: {
        id: true,
        helpfulVotes: true,
        notHelpfulVotes: true
      }
    })

    return NextResponse.json({
      success: true,
      helpful,
      helpfulVotes: updatedPage.helpfulVotes,
      notHelpfulVotes: updatedPage.notHelpfulVotes
    })
  } catch (error) {
    console.error('Failed to submit documentation page feedback:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}