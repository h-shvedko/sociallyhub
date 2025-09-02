import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SmartResponseSystem } from '@/lib/automation/smart-response-system'
import { z } from 'zod'

const RejectResponseRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required')
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
    const validatedData = RejectResponseRequestSchema.parse(body)

    const smartResponseSystem = new SmartResponseSystem()
    const rejectedResponse = await smartResponseSystem.rejectResponse(
      responseId,
      session.user.id,
      validatedData.reason
    )

    return NextResponse.json({
      success: true,
      response: rejectedResponse,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error rejecting response:', error)
    
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
      { error: 'Failed to reject response' },
      { status: 500 }
    )
  }
}