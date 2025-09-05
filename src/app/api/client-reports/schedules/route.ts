import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

// GET /api/client-reports/schedules - List scheduled reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const isActive = searchParams.get('isActive')

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    // Build where clause
    const where: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const schedules = await prisma.clientReportSchedule.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true,
            format: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Calculate next run times for active schedules
    const schedulesWithNextRun = schedules.map(schedule => {
      if (schedule.isActive) {
        const nextRun = calculateNextRunTime(schedule)
        return { ...schedule, nextRun }
      }
      return schedule
    })

    console.log(`📅 Retrieved ${schedules.length} report schedules`)

    return NextResponse.json({ schedules: schedulesWithNextRun })
  } catch (error) {
    console.error('Error fetching report schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// POST /api/client-reports/schedules - Create new schedule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      clientId,
      templateId,
      name,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      recipients,
      isActive
    } = body

    // Validation
    if (!clientId || !templateId || !name || !frequency || !time) {
      return NextResponse.json({ 
        error: 'Missing required fields: clientId, templateId, name, frequency, time' 
      }, { status: 400 })
    }

    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(frequency)) {
      return NextResponse.json({ 
        error: 'Invalid frequency. Must be DAILY, WEEKLY, MONTHLY, or QUARTERLY' 
      }, { status: 400 })
    }

    // Validate time format (HH:MM)
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return NextResponse.json({ 
        error: 'Invalid time format. Use HH:MM format (e.g., 09:00)' 
      }, { status: 400 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify client and template exist in workspace
    const [client, template] = await Promise.all([
      prisma.client.findFirst({
        where: {
          id: clientId,
          workspaceId: userWorkspace.workspaceId
        }
      }),
      prisma.clientReportTemplate.findFirst({
        where: {
          id: templateId,
          workspaceId: userWorkspace.workspaceId
        }
      })
    ])

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Calculate initial next run time
    const nextRun = calculateNextRunTime({
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      isActive: isActive !== false
    } as any)

    const schedule = await prisma.clientReportSchedule.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        clientId,
        templateId,
        name: name.trim(),
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        dayOfMonth: frequency === 'MONTHLY' || frequency === 'QUARTERLY' ? dayOfMonth : null,
        time,
        recipients: recipients || [],
        isActive: isActive !== false,
        nextRun: nextRun
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true,
            format: true
          }
        }
      }
    })

    console.log(`📅 Created report schedule ${schedule.id}: ${schedule.name}`)

    return NextResponse.json({ success: true, schedule })
  } catch (error) {
    console.error('Error creating report schedule:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}

// Helper function to calculate next run time
function calculateNextRunTime(schedule: any): Date {
  if (!schedule.isActive) {
    return null
  }

  const now = new Date()
  const [hours, minutes] = schedule.time.split(':').map(Number)
  
  let nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  switch (schedule.frequency) {
    case 'DAILY':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY':
      // Find next occurrence of the specified day of week
      const dayOfWeek = schedule.dayOfWeek || 0 // Default to Sunday
      const currentDayOfWeek = nextRun.getDay()
      let daysUntilNext = dayOfWeek - currentDayOfWeek

      if (daysUntilNext < 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7
      }

      nextRun.setDate(nextRun.getDate() + daysUntilNext)
      break

    case 'MONTHLY':
      // Next occurrence on the specified day of month
      const dayOfMonth = schedule.dayOfMonth || 1
      nextRun.setDate(dayOfMonth)

      if (nextRun <= now || nextRun.getDate() !== dayOfMonth) {
        // If current month's day has passed or doesn't exist, go to next month
        nextRun.setMonth(nextRun.getMonth() + 1, dayOfMonth)
      }
      break

    case 'QUARTERLY':
      // Every 3 months on the specified day
      const quarterlyDay = schedule.dayOfMonth || 1
      nextRun.setDate(quarterlyDay)

      while (nextRun <= now || nextRun.getDate() !== quarterlyDay) {
        nextRun.setMonth(nextRun.getMonth() + 3, quarterlyDay)
      }
      break

    default:
      // Default to tomorrow
      nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}