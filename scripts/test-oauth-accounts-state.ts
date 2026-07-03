// Runtime verification for the ADR-0006 Phase 2 `/api/accounts` OAuth state
// signer/verifier (signAccountState / verifyAccountState) in
// src/lib/security/oauth-state.ts.
//
// Why this exists: the jest suite is currently broken (invalid `moduleNameMapping`
// key in jest.config.js — ADR-0021), so this is the RUNNABLE equivalent. Pure
// crypto, no DB, no network.
//
// Usage (a signing secret MUST be set — ADR-0006 makes NEXTAUTH_SECRET canonical):
//   NEXTAUTH_SECRET=test-secret npx tsx --tsconfig tsconfig.json scripts/test-oauth-accounts-state.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

import {
  signAccountState,
  verifyAccountState,
  ACCOUNT_STATE_EXPIRY_MS,
} from "../src/lib/security/oauth-state"

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

const ctx = {
  workspaceId: "ws-demo-123",
  userId: "user-abc-123",
  provider: "twitter",
}

// 1) sign then verify -> valid, and the recovered payload matches the binding.
const token = signAccountState(ctx)
const r1 = verifyAccountState(token)
ok(
  "signed account state verifies (valid) + payload round-trips",
  r1.valid === true &&
    r1.payload?.workspaceId === ctx.workspaceId &&
    r1.payload?.userId === ctx.userId &&
    r1.payload?.provider === ctx.provider &&
    typeof r1.payload?.nonce === "string" &&
    typeof r1.payload?.iat === "number",
  `got ${JSON.stringify(r1)}`
)

// 2) tamper the MAC -> invalid. Flip the last two chars while keeping the same
//    length + a valid base64url alphabet char.
const [encoded, mac] = token.split(".")
const tamperedMac = mac.slice(0, -2) + (mac.endsWith("AA") ? "BB" : "AA")
const tamperedToken = `${encoded}.${tamperedMac}`
const r2 = verifyAccountState(tamperedToken)
ok(
  "tampered MAC rejected (invalid)",
  r2.valid === false && r2.reason === "signature_mismatch",
  `got ${JSON.stringify(r2)}`
)

// 3) expired token -> invalid (mint with an iat 11 minutes in the past).
const expiredToken = signAccountState(
  ctx,
  Date.now() - (ACCOUNT_STATE_EXPIRY_MS + 60 * 1000)
)
const r3 = verifyAccountState(expiredToken)
ok(
  "expired token rejected (invalid)",
  r3.valid === false && r3.reason === "expired",
  `got ${JSON.stringify(r3)}`
)

// 4) wrong workspaceId binding -> invalid. Forge the payload to claim a
//    different workspaceId but reuse the original MAC. This proves workspaceId
//    is cryptographically bound and cannot be swapped on the way back.
const forgedPayload = {
  ...JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
  workspaceId: "ws-attacker-999",
}
const forgedEncoded = Buffer.from(
  JSON.stringify(forgedPayload),
  "utf8"
).toString("base64url")
const forgedToken = `${forgedEncoded}.${mac}`
const r4 = verifyAccountState(forgedToken)
ok(
  "wrong workspaceId binding rejected (invalid)",
  r4.valid === false && r4.reason === "signature_mismatch",
  `got ${JSON.stringify(r4)}`
)

console.log(`\nResult: ${passed}/${passed + failed} checks passed`)
process.exit(failed === 0 ? 0 : 1)
