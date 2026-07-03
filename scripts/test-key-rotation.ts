// End-to-end proof of the ADR-0006 key-rotation flow (Phase 4 fixture).
//
// This RUNS NOW with throwaway data (no DB, pure crypto) and must PASS. It
// validates the core logic of scripts/rotate-encryption-key.ts — that a value
// encrypted under an old key survives a key rotation and, once re-encrypted,
// decrypts under the new key alone — using only the crypto module's exports.
//
// The rotation procedure it mirrors (from rotate-encryption-key.ts's header):
//   1. Value is live, encrypted under the OLD key while it was ENCRYPTION_KEY.
//   2. Operator moves OLD -> ENCRYPTION_KEY_PREVIOUS, installs NEW as
//      ENCRYPTION_KEY. The stored ciphertext still carries its original `k1`
//      label, which is now STALE (k1 == NEW key, but the bytes were sealed with
//      OLD). Direct decryption therefore fails; the rotation script recovers it
//      by relabelling k1 -> k0 so the key selector picks ENCRYPTION_KEY_PREVIOUS.
//   3. The script re-encrypts the recovered plaintext with the current key
//      (fresh IV, `k1` label under the NEW key).
//   4. Operator removes ENCRYPTION_KEY_PREVIOUS. Re-encrypted values decrypt
//      under the NEW key alone; anything NOT re-encrypted is now permanently
//      unreadable — which is why rotation must complete before dropping the
//      previous key.
//
// Keys are the shared dev fixtures from the ADR-0006 task brief so host dev,
// docker, and tests agree. Their roles here:
//   KEY_OLD  = adaef30...  (the "ENCRYPTION_KEY_PREVIOUS (rotation testing)" dev
//                            value) — the key we start on; becomes k0/previous.
//   KEY_NEW  = b29945...   (the primary dev ENCRYPTION_KEY value) — the key we
//                            rotate onto; the current k1 after rotation.
// The test drives process.env directly; getKey() reads env fresh on every call
// (uncached/lazy), so these switches take effect immediately. Ambient env is
// saved and restored at the end. Never logs key or ciphertext material.

import {
  decryptString,
  encryptString,
  isEncrypted,
} from '../src/lib/encryption'

const KEY_OLD = 'adaef30fa69d6859349e3e94d90adaa41526b6f4dfd99cfe556da474c002158c'
const KEY_NEW = 'b29945a36f9850725969747a03f57cb7bb83d7655844f8c12d853e16e5a132c2'

const SECRET = 'throwaway-oauth-token::' + Date.now()

// ── Tiny assertion harness ───────────────────────────────────────────────────
let passed = 0
let failed = 0

function check(desc: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  PASS  ${desc}`)
  } else {
    failed++
    console.error(`  FAIL  ${desc}`)
  }
}

function checkThrows(desc: string, fn: () => unknown) {
  try {
    fn()
    failed++
    console.error(`  FAIL  ${desc} (expected a throw, none occurred)`)
  } catch {
    passed++
    console.log(`  PASS  ${desc}`)
  }
}

/**
 * Mirror of rotate-encryption-key.ts's `rotateEncryptedValue`: decrypt with
 * whichever configured key authenticates the value (embedded label first, then
 * the current/previous slots to cover a stale post-rotation label), then
 * re-encrypt with the current key. Returns which slot recovered it and the
 * re-encrypted (current-key) value. This is the exact core logic the rotation
 * script relies on, exercised here against the same crypto module.
 */
function rotateReencrypt(value: string): { via: 'k1' | 'k0'; value: string } {
  const embedded = value.split(':')[2]
  const tried = new Set<string>()
  for (const keyId of [embedded, 'k1', 'k0']) {
    if (tried.has(keyId)) continue
    tried.add(keyId)
    const candidate = value.replace(/^enc:v1:[^:]+:/, `enc:v1:${keyId}:`)
    try {
      const plaintext = decryptString(candidate)
      return { via: keyId === 'k1' ? 'k1' : 'k0', value: encryptString(plaintext) }
    } catch {
      // Wrong / unconfigured key — try the next candidate.
    }
  }
  throw new Error('rotateReencrypt: value could not be decrypted with any configured key')
}

function setEnv(current: string | undefined, previous: string | undefined) {
  if (current === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = current
  if (previous === undefined) delete process.env.ENCRYPTION_KEY_PREVIOUS
  else process.env.ENCRYPTION_KEY_PREVIOUS = previous
}

function main() {
  const savedKey = process.env.ENCRYPTION_KEY
  const savedPrev = process.env.ENCRYPTION_KEY_PREVIOUS

  console.log('test-key-rotation — proving the ADR-0006 rotation flow end-to-end.\n')

  // ── Phase 1: encrypt under KEY_OLD (as the live ENCRYPTION_KEY) ────────────
  console.log('Phase 1 — encrypt under the old key (ENCRYPTION_KEY = KEY_OLD):')
  setEnv(KEY_OLD, undefined)
  const c1 = encryptString(SECRET)
  check('ciphertext is an enc:v1 value', isEncrypted(c1))
  check("ciphertext is written with the current-key label 'k1'", c1.startsWith('enc:v1:k1:'))
  check('round-trips under the old key', decryptString(c1) === SECRET)

  // ── Phase 2: rotate env (NEW current, OLD previous) ────────────────────────
  console.log('\nPhase 2 — rotate env (ENCRYPTION_KEY = KEY_NEW, ENCRYPTION_KEY_PREVIOUS = KEY_OLD):')
  setEnv(KEY_NEW, KEY_OLD)
  checkThrows(
    "direct decrypt of the stale k1-labelled value fails (k1 now selects the NEW key)",
    () => decryptString(c1)
  )
  const asK0 = c1.replace(/^enc:v1:[^:]+:/, 'enc:v1:k0:')
  check(
    'relabelling k1 -> k0 lets it decrypt via ENCRYPTION_KEY_PREVIOUS',
    decryptString(asK0) === SECRET
  )

  // ── Phase 3: rotate the value (re-encrypt onto the current key) ────────────
  console.log('\nPhase 3 — rotate the value via the rotation-script core logic:')
  const rotated = rotateReencrypt(c1)
  check("rotation recovered the value via the previous key (k0)", rotated.via === 'k0')
  check("re-encrypted value carries the current-key label 'k1'", rotated.value.startsWith('enc:v1:k1:'))
  check('re-encrypted value differs from the original ciphertext', rotated.value !== c1)
  check('re-encrypted value still decrypts to the original secret', decryptString(rotated.value) === SECRET)
  const c2 = rotated.value

  // ── Phase 4: drop the previous key; only re-encrypted values survive ───────
  console.log('\nPhase 4 — remove the previous key (ENCRYPTION_KEY = KEY_NEW only):')
  setEnv(KEY_NEW, undefined)
  check('re-encrypted value decrypts with the new key alone', decryptString(c2) === SECRET)
  checkThrows(
    'original (un-rotated) ciphertext is now permanently unreadable — direct',
    () => decryptString(c1)
  )
  checkThrows(
    'original (un-rotated) ciphertext is unreadable via k0 too (previous key removed)',
    () => decryptString(c1.replace(/^enc:v1:[^:]+:/, 'enc:v1:k0:'))
  )

  // Restore ambient env.
  setEnv(savedKey, savedPrev)

  console.log(`\nResult: ${passed} passed, ${failed} failed.`)
  if (failed === 0) {
    console.log('KEY ROTATION FLOW: PASS')
    process.exit(0)
  } else {
    console.error('KEY ROTATION FLOW: FAIL')
    process.exit(1)
  }
}

main()
