// Runtime verification for the ADR-0005 OAuth state signing/verification helper
// in src/lib/security/oauth-state.ts.
//
// Why this exists: the jest suite is currently broken (invalid `moduleNameMapping`
// key in jest.config.js — ADR-0021), so this is the RUNNABLE equivalent. Pure
// crypto, no DB, no network.
//
// Usage (a signing secret MUST be set):
//   OAUTH_STATE_SECRET=test-secret npx tsx --tsconfig tsconfig.json scripts/test-oauth-state.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

import { signState, verifyState } from "../src/lib/security/oauth-state"

let passed = 0
let failed = 0

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const ctx = { userId: "user-abc-123", provider: "twitter" }

// 1) sign then verify -> valid
const token = signState(ctx)
const r1 = verifyState(token, ctx)
ok("signed token verifies (valid)", r1.valid === true, `got ${JSON.stringify(r1)}`)

// 2) tamper the hmac -> invalid
const parts = token.split(".")
const originalHmac = parts[2]
// Flip the last two hex chars while keeping valid hex + identical length.
const tamperedHmac =
  originalHmac.slice(0, -2) + (originalHmac.endsWith("00") ? "11" : "00")
const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedHmac}`
const r2 = verifyState(tamperedToken, ctx)
ok(
  "tampered hmac rejected (invalid)",
  r2.valid === false && r2.reason === "signature_mismatch",
  `got ${JSON.stringify(r2)}`
)

// 3) expired token -> invalid (mint with a negative window so expiry is in the past)
const expiredToken = signState(ctx, -1000)
const r3 = verifyState(expiredToken, ctx)
ok(
  "expired token rejected (invalid)",
  r3.valid === false && r3.reason === "expired",
  `got ${JSON.stringify(r3)}`
)

// 4) wrong userId -> invalid (identity is inside the signed payload)
const r4 = verifyState(token, { userId: "user-xyz-999", provider: "twitter" })
ok(
  "wrong userId rejected (invalid)",
  r4.valid === false && r4.reason === "signature_mismatch",
  `got ${JSON.stringify(r4)}`
)

console.log(`\nResult: ${passed}/${passed + failed} checks passed`)
process.exit(failed === 0 ? 0 : 1)
