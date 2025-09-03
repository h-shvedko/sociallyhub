import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContentCalendarOptimizer } from '@/lib/automation/content-calendar-optimizer'
import { z } from 'zod'
import { Platform, ContentType } from '@prisma/client'

const CalendarOptimizationRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  platforms: z.array(z.nativeEnum(Platform)).optional(),
  contentTypes: z.array(z.nativeEnum(ContentType)).optional(),
  timeframe: z.enum(['30d', '90d', '180d']).optional(),
  optimizationGoals: z.array(z.enum(['engagement', 'reach', 'efficiency', 'consistency'])).optional(),
  audienceSegments: z.array(z.string()).optional(),
  budgetConstraints: z.boolean().optional(),
  teamSize: z.enum(['solo', 'small', 'medium', 'large']).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = CalendarOptimizationRequestSchema.parse(body)

    const calendarOptimizer = new ContentCalendarOptimizer()
    const optimizations = await calendarOptimizer.optimizeContentCalendar(
      validatedData.workspaceId,
      {
        platforms: validatedData.platforms,
        contentTypes: validatedData.contentTypes,
        timeframe: validatedData.timeframe,
        optimizationGoals: validatedData.optimizationGoals,
        audienceSegments: validatedData.audienceSegments,
        budgetConstraints: validatedData.budgetConstraints,
        teamSize: validatedData.teamSize
      }
    )

    return NextResponse.json({
      success: true,
      optimizations,
      count: optimizations.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error optimizing content calendar:', error)
    
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
      { error: 'Failed to optimize content calendar' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') as any
    const priority = searchParams.get('priority')
    const limit = searchParams.get('limit')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const calendarOptimizer = new ContentCalendarOptimizer()
    const storedOptimizations = await calendarOptimizer.getStoredOptimizations(workspaceId, {
      status,
      priority,
      limit: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      optimizations: storedOptimizations,
      count: storedOptimizations.length
    })
  } catch (error) {
    console.error('Error fetching calendar optimizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar optimizations' },
      { status: 500 }
    )
  }
}