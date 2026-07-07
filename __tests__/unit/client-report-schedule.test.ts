/**
 * Unit tests for calculateNextRunTime in src/lib/client-reports/schedule.ts
 * (extracted in ADR-0021 Track C from the two identical inline copies in the
 * client-reports schedules API routes; behavior unchanged, `now` injectable).
 *
 * All schedule times are LOCAL time ("HH:MM"), so fixtures use the local-time
 * Date constructor. Baseline `now`: Tuesday 2026-07-07 08:00 local.
 */

import { calculateNextRunTime } from "@/lib/client-reports/schedule"

const NOW = new Date(2026, 6, 7, 8, 0, 0, 0) // Tue 2026-07-07 08:00

function sched(overrides: Partial<Parameters<typeof calculateNextRunTime>[0]>) {
  return {
    isActive: true,
    time: "09:00",
    frequency: "DAILY",
    dayOfWeek: null,
    dayOfMonth: null,
    ...overrides,
  }
}

describe("inactive schedules", () => {
  it("returns null when isActive is false", () => {
    expect(calculateNextRunTime(sched({ isActive: false }), NOW)).toBeNull()
  })
})

describe("DAILY", () => {
  it("runs later today when the time has not passed", () => {
    expect(calculateNextRunTime(sched({ time: "09:00" }), NOW)).toEqual(
      new Date(2026, 6, 7, 9, 0)
    )
  })

  it("runs tomorrow when the time has already passed", () => {
    expect(calculateNextRunTime(sched({ time: "07:00" }), NOW)).toEqual(
      new Date(2026, 6, 8, 7, 0)
    )
  })

  it("runs tomorrow when the time is exactly now (strictly-after semantics)", () => {
    expect(calculateNextRunTime(sched({ time: "08:00" }), NOW)).toEqual(
      new Date(2026, 6, 8, 8, 0)
    )
  })
})

describe("WEEKLY", () => {
  it("targets the next occurrence of a later weekday (Friday from Tuesday)", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "WEEKLY", dayOfWeek: 5 }), NOW)
    ).toEqual(new Date(2026, 6, 10, 9, 0)) // Fri 2026-07-10
  })

  it("wraps to next week for an earlier weekday (Monday from Tuesday)", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "WEEKLY", dayOfWeek: 1 }), NOW)
    ).toEqual(new Date(2026, 6, 13, 9, 0)) // Mon 2026-07-13
  })

  it("stays today when today is the target weekday and the time is still ahead", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "WEEKLY", dayOfWeek: 2, time: "09:00" }), NOW)
    ).toEqual(new Date(2026, 6, 7, 9, 0))
  })

  it("moves a full week out when today's target time already passed", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "WEEKLY", dayOfWeek: 2, time: "07:00" }), NOW)
    ).toEqual(new Date(2026, 6, 14, 7, 0))
  })

  it("defaults a missing dayOfWeek to Sunday", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "WEEKLY", dayOfWeek: null }), NOW)
    ).toEqual(new Date(2026, 6, 12, 9, 0)) // Sun 2026-07-12
  })
})

describe("MONTHLY", () => {
  it("runs this month when the day is still ahead", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "MONTHLY", dayOfMonth: 15 }), NOW)
    ).toEqual(new Date(2026, 6, 15, 9, 0))
  })

  it("rolls to next month when the day already passed", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "MONTHLY", dayOfMonth: 1 }), NOW)
    ).toEqual(new Date(2026, 7, 1, 9, 0)) // Aug 1
  })

  it("defaults a missing dayOfMonth to the 1st (of next month, since the 1st passed)", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "MONTHLY", dayOfMonth: null }), NOW)
    ).toEqual(new Date(2026, 7, 1, 9, 0))
  })
})

describe("QUARTERLY", () => {
  it("advances in 3-month steps past `now`", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "QUARTERLY", dayOfMonth: 1 }), NOW)
    ).toEqual(new Date(2026, 9, 1, 9, 0)) // Oct 1
  })

  it("stays in the current month when the day is still ahead", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "QUARTERLY", dayOfMonth: 20 }), NOW)
    ).toEqual(new Date(2026, 6, 20, 9, 0))
  })
})

describe("unknown frequency", () => {
  it("falls back to tomorrow at the scheduled time", () => {
    expect(
      calculateNextRunTime(sched({ frequency: "SOMETIMES" }), NOW)
    ).toEqual(new Date(2026, 6, 8, 9, 0))
  })
})
