// Runtime verification for the ADR-0006 Phase 1 crypto rewrite in
// src/lib/encryption.ts.
//
// Why this exists: the jest suite is currently broken (invalid `moduleNameMapping`
// key in jest.config.js — ADR-0021), so this tsx script is the RUNNABLE proof.
// The jest-style mirror lives in __tests__/unit/encryption.test.ts.
//
// Pure crypto — no DB, no network. Sets its own keys via process.env so it runs
// deterministically with a single command:
//
//   npx tsx --tsconfig tsconfig.json scripts/test-encryption.ts
//
// It hard-sets ENCRYPTION_KEY to the shared dev key at startup, and individual
// cases mutate/unset env to exercise wrong-key / missing-key / rotation paths.
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

import crypto from 'crypto'

import {
  CIPHERTEXT_PREFIX,
  decryptCredentials,
  decryptString,
  decryptToken,
  encryptCredentials,
  encryptString,
  encryptToken,
  isEncrypted,
  isEncryptionConfigured,
} from '../src/lib/encryption'

// Shared dev key (host dev + docker app + tests use the same value).
const DEV_KEY = 'b29945a36f9850725969747a03f57cb7bb83d7655844f8c12d853e16e5a132c2'
// Rotation "previous" key (decrypt-only in the rotation test).
const PREV_KEY = 'adaef30fa69d6859349e3e94d90adaa41526b6f4dfd99cfe556da474c002158c'
// A third, unrelated key for the wrong-key case.
const OTHER_KEY = crypto.randomBytes(32).toString('hex')

let passed = 0
let failed = 0

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function throws(name: string, fn: () => unknown) {
  try {
    fn()
    ok(name, false, 'expected an error to be thrown, but none was')
  } catch {
    ok(name, true)
  }
}

function setKeys(current?: string, previous?: string) {
  if (current === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = current
  if (previous === undefined) delete process.env.ENCRYPTION_KEY_PREVIOUS
  else process.env.ENCRYPTION_KEY_PREVIOUS = previous
}

// Baseline: current key present, no previous key.
setKeys(DEV_KEY)

// 1) Round-trip: encrypt -> decrypt equals the input, for several shapes.
for (const sample of [
  'hello world',
  '',
  'unicode: café ☕ — 日本語 — 🔐',
  'a'.repeat(4096),
  'oauth_access_token_1234567890',
]) {
  const enc = encryptString(sample)
  const dec = decryptString(enc)
  ok(
    `round-trip preserves input (${JSON.stringify(sample.slice(0, 16))}${sample.length > 16 ? '…' : ''})`,
    dec === sample,
    `got ${JSON.stringify(dec.slice(0, 32))}`
  )
}

// 2) enc: prefix detection + format shape.
{
  const enc = encryptString('detectme')
  ok('ciphertext carries the enc:v1:k1: prefix', enc.startsWith(`${CIPHERTEXT_PREFIX}k1:`), enc.slice(0, 12))
  ok('isEncrypted(ciphertext) is true', isEncrypted(enc) === true)
  ok('isEncrypted(plaintext) is false', isEncrypted('not-a-ciphertext') === false)
  ok('ciphertext splits into exactly 6 colon parts', enc.split(':').length === 6, `parts=${enc.split(':').length}`)
}

// 3) Two encryptions of the same plaintext differ (random IV).
{
  const a = encryptString('same-input')
  const b = encryptString('same-input')
  ok('random IV => distinct ciphertexts for identical input', a !== b)
  ok('both still decrypt to the same plaintext', decryptString(a) === 'same-input' && decryptString(b) === 'same-input')
}

// 4) Tamper detection: flip one bit of the auth tag -> decrypt throws.
{
  const enc = encryptString('tamper-target')
  const parts = enc.split(':')
  const tag = Buffer.from(parts[5], 'base64url')
  tag[0] ^= 0x01
  parts[5] = tag.toString('base64url')
  const tampered = parts.join(':')
  throws('tampered auth tag is rejected (GCM auth fails)', () => decryptString(tampered))
}

// 4b) Tamper detection: flip one bit of the ciphertext body -> decrypt throws.
{
  const enc = encryptString('tamper-body')
  const parts = enc.split(':')
  const ct = Buffer.from(parts[4], 'base64url')
  ct[0] ^= 0x01
  parts[4] = ct.toString('base64url')
  throws('tampered ciphertext body is rejected', () => decryptString(parts.join(':')))
}

// 5) Wrong key: encrypt with DEV_KEY, decrypt after swapping to OTHER_KEY -> throws.
{
  const enc = encryptString('secret-under-dev-key')
  setKeys(OTHER_KEY)
  throws('decrypt with the wrong ENCRYPTION_KEY throws', () => decryptString(enc))
  setKeys(DEV_KEY) // restore
}

// 6) Missing env: unset ENCRYPTION_KEY -> encrypt AND decrypt throw (fail closed).
{
  const encWhileConfigured = encryptString('needs-a-key')
  setKeys(undefined)
  ok('isEncryptionConfigured() is false with no key', isEncryptionConfigured() === false)
  throws('encryptString throws when ENCRYPTION_KEY is unset (no fallback)', () => encryptString('x'))
  throws('decryptString throws when ENCRYPTION_KEY is unset', () => decryptString(encWhileConfigured))
  setKeys(DEV_KEY) // restore
}

// 6b) Malformed key: wrong length -> throws (strict 64-hex validation).
{
  setKeys('deadbeef') // 8 hex chars, not 64
  ok('isEncryptionConfigured() is false for a malformed key', isEncryptionConfigured() === false)
  throws('encryptString throws for a malformed (short) ENCRYPTION_KEY', () => encryptString('x'))
  setKeys(DEV_KEY) // restore
}

// 7) Previous-key decryption (rotation): a value encrypted under PREV and
//    labelled k0 still decrypts once PREV is installed as ENCRYPTION_KEY_PREVIOUS
//    and a different current key is active.
{
  // Encrypt with PREV installed as the current key -> value is tagged k1 but
  // its bytes are PREV's. Relabel k1 -> k0 to mark it as previous-generation.
  setKeys(PREV_KEY)
  const underPrev = encryptString('rotated-secret')
  const k0Token = underPrev.replace(':k1:', ':k0:')

  // Now rotate: DEV_KEY is current (k1), PREV_KEY is previous (k0).
  setKeys(DEV_KEY, PREV_KEY)
  const dec = decryptString(k0Token)
  ok('k0-tagged value decrypts via ENCRYPTION_KEY_PREVIOUS after rotation', dec === 'rotated-secret', `got ${JSON.stringify(dec)}`)

  // And a current k1 value still decrypts with the new key.
  const underCurrent = encryptString('fresh-secret')
  ok('k1-tagged value decrypts via the current ENCRYPTION_KEY', decryptString(underCurrent) === 'fresh-secret')

  // Without the previous key configured, the k0 value must fail closed.
  setKeys(DEV_KEY)
  throws('k0 value throws when ENCRYPTION_KEY_PREVIOUS is not configured', () => decryptString(k0Token))
  setKeys(DEV_KEY) // restore
}

// 8) Unknown keyId + malformed inputs -> throw.
{
  const enc = encryptString('unknown-key-id')
  const badKeyId = enc.replace(':k1:', ':k2:')
  throws('decrypt of a value with an unknown keyId throws', () => decryptString(badKeyId))
  throws('decrypt of a non-enc string throws', () => decryptString('plain-old-token'))
  throws('decrypt of a truncated ciphertext throws', () => decryptString('enc:v1:k1:onlythree'))
  throws('decrypt of an unknown version throws', () => decryptString('enc:v2:k1:a:b:c'))
}

// 9) encryptCredentials / decryptCredentials round-trip (JSON wrapper).
{
  const creds = { clientId: 'abc123', clientSecret: 's3cr3t', scopes: ['read', 'write'], nested: { n: 1 } }
  const enc = encryptCredentials(creds)
  ok('encryptCredentials returns an enc:v1 string', isEncrypted(enc))
  const dec = decryptCredentials(enc)
  ok('decryptCredentials restores the object', JSON.stringify(dec) === JSON.stringify(creds), JSON.stringify(dec))
  throws('decryptCredentials throws on a legacy (non-string) value', () =>
    decryptCredentials({ encrypted: 'x', iv: 'y', algorithm: 'aes-256-gcm' } as any)
  )
}

// 10) encryptToken / decryptToken, incl. transitional plaintext fallback.
{
  const enc = encryptToken('ya29.a0AfâccessToken')
  ok('encryptToken produces an enc:v1 ciphertext', isEncrypted(enc))
  ok('decryptToken round-trips an encrypted token', decryptToken(enc) === 'ya29.a0AfâccessToken')
  // Transitional fallback: a legacy plaintext token is returned as-is (warns).
  ok('decryptToken returns legacy plaintext as-is (transitional)', decryptToken('legacy-plaintext-token') === 'legacy-plaintext-token')
  ok('decryptToken passes through null', decryptToken(null) === null)
  ok('decryptToken passes through empty string', decryptToken('') === '')
}

// 11) isEncryptionConfigured is true for the well-formed dev key.
ok('isEncryptionConfigured() true for a valid 64-hex key', isEncryptionConfigured() === true)

console.log(`\nResult: ${passed}/${passed + failed} checks passed`)
process.exit(failed === 0 ? 0 : 1)
