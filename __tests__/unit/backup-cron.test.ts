/**
 * Unit tests for the self-contained cron evaluator `computeNextRun` in
 * src/lib/jobs/backup-queue.ts (ADR-0021 Track C).
 *
 * Pure date math, no DB / no Redis: importing backup-queue.ts must not
 * construct a queue at module scope (it is lazy per the ADR-0022 build
 * lesson) — these tests double as a regression guard for that.
 *
 * computeNextRun evaluates in SERVER LOCAL TIME, so all fixtures use the
 * local-time Date constructor (year, monthIndex, day, h, m).
 */

// backup-queue imports queue-manager → @/lib/middleware/logging → @/lib/auth
// → @auth/prisma-adapter, which ships untransformed ESM that jest cannot
// parse. These tests only need the pure cron evaluator, so cut the chain at
// the same boundaries auth-helpers.test.ts already mocks.
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }))
jest.mock("@/lib/auth/config", () => ({ authOptions: {} }))

import { computeNextRun } from "@/lib/jobs/backup-queue"

describe("computeNextRun — daily at 02:00 ('0 2 * * *')", () => {
  it("fires later the same day when 02:00 has not passed", () => {
    const from = new Date(2026, 6, 7, 0, 30) // 2026-07-07 00:30 local
    expect(computeNextRun("0 2 * * *", from)).toEqual(new Date(2026, 6, 7, 2, 0))
  })

  it("fires the next day when 02:00 has passed", () => {
    const from = new Date(2026, 6, 7, 3, 0)
    expect(computeNextRun("0 2 * * *", from)).toEqual(new Date(2026, 6, 8, 2, 0))
  })

  it("is strictly after `from`: at exactly 02:00 it schedules tomorrow", () => {
    const from = new Date(2026, 6, 7, 2, 0, 0, 0)
    expect(computeNextRun("0 2 * * *", from)).toEqual(new Date(2026, 6, 8, 2, 0))
  })
})

describe("computeNextRun — every 15 minutes ('*/15 * * * *')", () => {
  it("rounds up to the next quarter hour", () => {
    const from = new Date(2026, 6, 7, 10, 7)
    expect(computeNextRun("*/15 * * * *", from)).toEqual(new Date(2026, 6, 7, 10, 15))
  })

  it("on a boundary minute moves to the NEXT boundary (strictly after)", () => {
    const from = new Date(2026, 6, 7, 10, 15, 0, 0)
    expect(computeNextRun("*/15 * * * *", from)).toEqual(new Date(2026, 6, 7, 10, 30))
  })

  it("wraps across the hour", () => {
    const from = new Date(2026, 6, 7, 10, 46)
    expect(computeNextRun("*/15 * * * *", from)).toEqual(new Date(2026, 6, 7, 11, 0))
  })
})

describe("computeNextRun — day-of-week alias 7 == 0 (Sunday)", () => {
  // 2026-07-07 is a Tuesday; the next Sunday is 2026-07-12.
  const from = new Date(2026, 6, 7, 0, 0)

  it("treats '* * * * 7' the same as '* * * * 0'", () => {
    const via7 = computeNextRun("0 12 * * 7", from)
    const via0 = computeNextRun("0 12 * * 0", from)
    expect(via7).toEqual(via0)
    expect(via7).toEqual(new Date(2026, 6, 12, 12, 0))
    expect(via7!.getDay()).toBe(0)
  })
})

describe("computeNextRun — Vixie cron dom/dow OR semantics", () => {
  it("when BOTH dom and dow are restricted, the earlier of the two wins", () => {
    // '0 0 13 * 5' = midnight on the 13th OR on any Friday.
    // From Wed 2026-07-01 the next Friday (2026-07-03) precedes the 13th.
    const from = new Date(2026, 6, 1, 6, 0)
    expect(computeNextRun("0 0 13 * 5", from)).toEqual(new Date(2026, 6, 3, 0, 0))
  })

  it("dom alone is an AND-style restriction (no Friday short-circuit)", () => {
    const from = new Date(2026, 6, 1, 6, 0)
    expect(computeNextRun("0 0 13 * *", from)).toEqual(new Date(2026, 6, 13, 0, 0))
  })

  it("dow alone matches the weekday only", () => {
    const from = new Date(2026, 6, 7, 0, 0) // Tuesday
    expect(computeNextRun("0 0 * * 5", from)).toEqual(new Date(2026, 6, 10, 0, 0)) // Friday
  })
})

describe("computeNextRun — malformed expressions return null", () => {
  const from = new Date(2026, 6, 7, 0, 0)

  it.each([
    ["", "empty string"],
    ["* * * *", "four fields"],
    ["* * * * * *", "six fields"],
    ["61 * * * *", "minute out of range"],
    ["0 24 * * *", "hour out of range"],
    ["0 0 0 * *", "day-of-month below 1"],
    ["0 0 * 13 *", "month out of range"],
    ["a b c d e", "non-numeric fields"],
    ["*/0 * * * *", "zero step"],
    ["5-2 * * * *", "inverted range"],
    ["1,,2 * * * *", "empty list element"],
  ])("returns null for %p (%s)", (expr) => {
    expect(computeNextRun(expr, from)).toBeNull()
  })

  it("returns null when nothing can match within the 366-day horizon", () => {
    // Feb 30 never exists; dom-only restriction means it never fires.
    expect(computeNextRun("0 0 30 2 *", from)).toBeNull()
  })
})
