/**
 * Next-run calculation for client-report schedules.
 *
 * Extracted (ADR-0021) from the two identical inline copies in
 * src/app/api/client-reports/schedules/route.ts and .../[id]/route.ts so the
 * pure date logic is unit-testable. Behavior is unchanged; the only addition
 * is the injectable `now` parameter (defaults to the current time).
 */

export interface ScheduleLike {
  isActive: boolean
  /** "HH:MM" 24h local time */
  time: string
  frequency: string // DAILY | WEEKLY | MONTHLY | QUARTERLY
  dayOfWeek?: number | null // 0 (Sunday) - 6, for WEEKLY
  dayOfMonth?: number | null // 1 - 31, for MONTHLY/QUARTERLY
}

export function calculateNextRunTime(
  schedule: ScheduleLike,
  now: Date = new Date()
): Date | null {
  if (!schedule.isActive) {
    return null
  }

  const [hours, minutes] = schedule.time.split(':').map(Number)

  const nextRun = new Date(now)
  nextRun.setHours(hours, minutes, 0, 0)

  switch (schedule.frequency) {
    case 'DAILY':
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case 'WEEKLY': {
      // Find next occurrence of the specified day of week
      const dayOfWeek = schedule.dayOfWeek || 0 // Default to Sunday
      const currentDayOfWeek = nextRun.getDay()
      let daysUntilNext = dayOfWeek - currentDayOfWeek

      if (daysUntilNext < 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7
      }

      nextRun.setDate(nextRun.getDate() + daysUntilNext)
      break
    }

    case 'MONTHLY': {
      // Next occurrence on the specified day of month
      const dayOfMonth = schedule.dayOfMonth || 1
      nextRun.setDate(dayOfMonth)

      if (nextRun <= now || nextRun.getDate() !== dayOfMonth) {
        // If current month's day has passed or doesn't exist, go to next month
        nextRun.setMonth(nextRun.getMonth() + 1, dayOfMonth)
      }
      break
    }

    case 'QUARTERLY': {
      // Every 3 months on the specified day
      const quarterlyDay = schedule.dayOfMonth || 1
      nextRun.setDate(quarterlyDay)

      while (nextRun <= now || nextRun.getDate() !== quarterlyDay) {
        nextRun.setMonth(nextRun.getMonth() + 3, quarterlyDay)
      }
      break
    }

    default:
      // Default to tomorrow
      nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}
