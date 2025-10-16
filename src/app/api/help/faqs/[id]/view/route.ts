import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/help/faqs/[id]/view - Track FAQ view
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const faq = await prisma.helpFAQ.findUnique({
      where: { id }
    })

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Increment view count
    const updatedFAQ = await prisma.helpFAQ.update({
      where: { id },
      data: {
        views: { increment: 1 }
      }
    })

    return NextResponse.json({
      success: true,
      views: updatedFAQ.views
    })
  } catch (error) {
    console.error('Failed to track FAQ view:', error)
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    )
  }
}