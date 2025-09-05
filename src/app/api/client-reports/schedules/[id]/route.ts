import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

// GET /api/client-reports/schedules/[id] - Get specific schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: scheduleId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    const schedule = await prisma.clientReportSchedule.findFirst({
      where: {
        id: scheduleId,
        workspaceId: userWorkspace.workspaceId,
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

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json({ schedule })

  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}

// PUT /api/client-reports/schedules/[id] - Update schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: scheduleId } = await params
    const body = await request.json()

    const {
      name,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      recipients,
      isActive
    } = body

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if schedule exists and belongs to the workspace
    const existingSchedule = await prisma.clientReportSchedule.findFirst({
      where: {
        id: scheduleId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Validation
    if (frequency && !['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(frequency)) {
      return NextResponse.json({ 
        error: 'Invalid frequency. Must be DAILY, WEEKLY, MONTHLY, or QUARTERLY' 
      }, { status: 400 })
    }

    // Validate time format if provided
    if (time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return NextResponse.json({ 
        error: 'Invalid time format. Use HH:MM format (e.g., 09:00)' 
      }, { status: 400 })
    }

    // Calculate new next run time if schedule parameters changed
    let nextRun = existingSchedule.nextRun
    if (frequency || time || dayOfWeek !== undefined || dayOfMonth !== undefined || isActive !== undefined) {
      const updatedSchedule = {
        ...existingSchedule,
        frequency: frequency || existingSchedule.frequency,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existingSchedule.dayOfWeek,
        dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : existingSchedule.dayOfMonth,
        time: time || existingSchedule.time,
        isActive: isActive !== undefined ? isActive : existingSchedule.isActive
      }
      nextRun = calculateNextRunTime(updatedSchedule)
    }

    // Update the schedule
    const updatedSchedule = await prisma.clientReportSchedule.update({
      where: {
        id: scheduleId,
      },
      data: {
        ...(name && { name: name.trim() }),
        ...(frequency && { frequency }),
        ...(dayOfWeek !== undefined && { dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null }),
        ...(dayOfMonth !== undefined && { dayOfMonth: frequency === 'MONTHLY' || frequency === 'QUARTERLY' ? dayOfMonth : null }),
        ...(time && { time }),
        ...(recipients && { recipients }),
        ...(isActive !== undefined && { isActive }),
        ...(nextRun && { nextRun })
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

    console.log(`📅 Schedule ${scheduleId} updated by user ${userId}`)

    return NextResponse.json({ schedule: updatedSchedule })

  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// DELETE /api/client-reports/schedules/[id] - Delete schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: scheduleId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if schedule exists and belongs to the workspace
    const existingSchedule = await prisma.clientReportSchedule.findFirst({
      where: {
        id: scheduleId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Delete the schedule
    await prisma.clientReportSchedule.delete({
      where: {
        id: scheduleId,
      }
    })

    console.log(`🗑️ Schedule ${scheduleId} deleted by user ${userId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    )
  }
}

// Helper function to calculate next run time
function calculateNextRunTime(schedule: any): Date | null {
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