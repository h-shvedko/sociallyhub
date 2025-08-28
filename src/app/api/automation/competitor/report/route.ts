import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CompetitorAnalyzer } from '@/lib/automation/competitor-analyzer'
import { z } from 'zod'

const ReportRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  timeframe: z.enum(['30d', '90d', '180d']).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = ReportRequestSchema.parse(body)

    const competitorAnalyzer = new CompetitorAnalyzer()
    const report = await competitorAnalyzer.generateCompetitiveReport(
      validatedData.workspaceId,
      validatedData.timeframe || '90d'
    )

    return NextResponse.json({
      success: true,
      report,
      timeframe: validatedData.timeframe || '90d',
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating competitive report:', error)
    
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
      { error: 'Failed to generate competitive report' },
      { status: 500 }
    )
  }
}