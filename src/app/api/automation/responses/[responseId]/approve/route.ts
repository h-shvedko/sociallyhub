import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SmartResponseSystem } from '@/lib/automation/smart-response-system'
import { z } from 'zod'

const ApproveResponseRequestSchema = z.object({
  feedback: z.string().optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { responseId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { responseId } = params
    if (!responseId) {
      return NextResponse.json(
        { error: 'Response ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = ApproveResponseRequestSchema.parse(body)

    const smartResponseSystem = new SmartResponseSystem()
    const approvedResponse = await smartResponseSystem.approveResponse(
      responseId,
      session.user.id,
      validatedData.feedback
    )

    return NextResponse.json({
      success: true,
      response: approvedResponse,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error approving response:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to approve response' },
      { status: 500 }
    )
  }
}