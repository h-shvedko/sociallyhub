// Runtime smoke for the ADR-0005 Redis sliding-window rate limiter in
// src/lib/utils/rate-limit.ts.
//
// Why this exists: the jest suite is currently broken (invalid
// `moduleNameMapping` key in jest.config.js — ADR-0021), so this script is the
// RUNNABLE proof. It exercises the real limiter via the in-memory fallback
// (REDIS_URL unset) and simulates a Redis outage by injecting a client whose
// ops throw, asserting the limiter FAILS OPEN.
//
// Usage (host):
//   unset REDIS_URL
//   npx tsx --tsconfig tsconfig.json scripts/test-rate-limit.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

// Ensure the in-memory fallback path (no Redis configured) for section 1.
delete process.env.REDIS_URL

import {
  rateLimit,
  ratelimit,
  __setRateLimitRedisForTests,
  __resetRateLimitForTests,
} from '../src/lib/utils/rate-limit'

let failures = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    console.error(`  ✗ ${msg}`)
    failures++
  }
}

async function main() {
  // -------------------------------------------------------------------------
  // 1. In-memory sliding window: 12 calls at points:10 → first 10 ok, rest not.
  // -------------------------------------------------------------------------
  console.log('1. In-memory limiter: 12 calls, points=10, windowSec=60')
  __resetRateLimitForTests()

  const key = 'smoke:ip:1.2.3.4:/api/test'
  const results = []
  for (let i = 0; i < 12; i++) {
    results.push(await rateLimit(key, { points: 10, windowSec: 60 }))
  }

  const okCount = results.filter((r) => r.ok).length
  assert(okCount === 10, `exactly 10 of 12 calls allowed (got ${okCount})`)
  assert(results[0]!.ok === true, 'call #1 allowed')
  assert(results[9]!.ok === true, 'call #10 allowed')
  assert(results[10]!.ok === false, 'call #11 throttled')
  assert(results[11]!.ok === false, 'call #12 throttled')
  assert(
    results[9]!.remaining === 0,
    `call #10 reports 0 remaining (got ${results[9]!.remaining})`
  )
  assert(
    typeof results[10]!.retryAfterSec === 'number' &&
      results[10]!.retryAfterSec! > 0,
    `throttled call carries a positive retryAfterSec (got ${results[10]!.retryAfterSec})`
  )

  // -------------------------------------------------------------------------
  // 2. Independent keys do not interfere.
  // -------------------------------------------------------------------------
  console.log('2. Distinct keys are isolated')
  const other = await rateLimit('smoke:ip:9.9.9.9:/api/test', {
    points: 10,
    windowSec: 60,
  })
  assert(other.ok === true, 'a fresh key is allowed even after another is exhausted')

  // -------------------------------------------------------------------------
  // 3. Fail-open when Redis ops throw (simulate a Redis outage).
  // -------------------------------------------------------------------------
  console.log('3. Redis outage → fail OPEN')
  const throwingRedis = {
    eval: async () => {
      throw new Error('simulated ECONNREFUSED')
    },
    on: () => {},
  }
  // Inject the throwing client so getRedisClient() returns it and the eval
  // inside rateLimit() rejects → limiter must swallow and return ok:true.
  __setRateLimitRedisForTests(throwingRedis as any)

  let failOpenAll = true
  for (let i = 0; i < 20; i++) {
    const r = await rateLimit('smoke:failopen', { points: 3, windowSec: 60 })
    if (!r.ok) failOpenAll = false
  }
  assert(failOpenAll, 'all 20 calls allowed despite points=3 (failed open on Redis error)')

  // -------------------------------------------------------------------------
  // 4. Legacy shim: ratelimit.limit(id) → { success } at 10/min.
  // -------------------------------------------------------------------------
  console.log('4. Backward-compatible ratelimit.limit() shim (10/min)')
  __resetRateLimitForTests()
  delete process.env.REDIS_URL

  const shim = []
  for (let i = 0; i < 12; i++) {
    shim.push(await ratelimit.limit('legacy-user-42'))
  }
  const shimOk = shim.filter((r) => r.success).length
  assert(shimOk === 10, `shim allows exactly 10 of 12 (got ${shimOk})`)
  assert(shim[10]!.success === false, 'shim throttles the 11th call')
  assert(
    typeof shim[0]!.remaining === 'number',
    'shim result exposes numeric `remaining`'
  )

  __resetRateLimitForTests()

  console.log('')
  if (failures === 0) {
    console.log('PASS — all rate-limit assertions passed')
    process.exit(0)
  } else {
    console.error(`FAIL — ${failures} assertion(s) failed`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
