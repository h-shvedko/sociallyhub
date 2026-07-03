/**
 * Unit tests for the ADR-0006 Phase 1 crypto rewrite in src/lib/encryption.ts:
 * the enc:v1 AES-256-GCM format, fail-closed key loading, tamper detection,
 * previous-key (rotation) decryption, and the JSON/token wrappers.
 *
 * NOTE (ADR-0021): the jest infrastructure is currently broken — jest.config.js
 * uses the invalid option name `moduleNameMapping` (should be `moduleNameMapper`),
 * so the `@/` alias never resolves and this suite cannot run until ADR-0021
 * repairs the config. It is written jest-style for that future suite. Until then,
 * the RUNNABLE proof of the same cases lives in scripts/test-encryption.ts (tsx,
 * pure crypto, run per ADR-0006 Phase 1 step 4) — verified 35/35 passing.
 *
 * No mocks: this module is pure Node crypto. Keys are supplied via process.env,
 * saved and restored around every test.
 */

import crypto from "crypto"

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
} from "@/lib/encryption"

const DEV_KEY = "b29945a36f9850725969747a03f57cb7bb83d7655844f8c12d853e16e5a132c2"
const PREV_KEY = "adaef30fa69d6859349e3e94d90adaa41526b6f4dfd99cfe556da474c002158c"
const OTHER_KEY = crypto.randomBytes(32).toString("hex")

let savedCurrent: string | undefined
let savedPrevious: string | undefined

function setKeys(current?: string, previous?: string) {
  if (current === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = current
  if (previous === undefined) delete process.env.ENCRYPTION_KEY_PREVIOUS
  else process.env.ENCRYPTION_KEY_PREVIOUS = previous
}

beforeEach(() => {
  savedCurrent = process.env.ENCRYPTION_KEY
  savedPrevious = process.env.ENCRYPTION_KEY_PREVIOUS
  setKeys(DEV_KEY) // baseline: current key present, no previous key
})

afterEach(() => {
  setKeys(savedCurrent, savedPrevious)
})

describe("encryptString / decryptString round-trip", () => {
  it.each([
    "hello world",
    "",
    "unicode: café ☕ — 日本語 — 🔐",
    "a".repeat(4096),
    "oauth_access_token_1234567890",
  ])("preserves %p", (sample) => {
    expect(decryptString(encryptString(sample))).toBe(sample)
  })

  it("emits the enc:v1:k1: format", () => {
    const enc = encryptString("detectme")
    expect(enc.startsWith(`${CIPHERTEXT_PREFIX}k1:`)).toBe(true)
    expect(enc.split(":")).toHaveLength(6)
  })

  it("uses a random IV so identical inputs yield distinct ciphertexts", () => {
    const a = encryptString("same-input")
    const b = encryptString("same-input")
    expect(a).not.toBe(b)
    expect(decryptString(a)).toBe("same-input")
    expect(decryptString(b)).toBe("same-input")
  })
})

describe("detection helpers", () => {
  it("isEncrypted() distinguishes ciphertext from plaintext", () => {
    expect(isEncrypted(encryptString("x"))).toBe(true)
    expect(isEncrypted("not-a-ciphertext")).toBe(false)
    expect(isEncrypted(null)).toBe(false)
  })

  it("isEncryptionConfigured() reflects key presence and shape without throwing", () => {
    expect(isEncryptionConfigured()).toBe(true)
    setKeys(undefined)
    expect(isEncryptionConfigured()).toBe(false)
    setKeys("deadbeef") // wrong length
    expect(isEncryptionConfigured()).toBe(false)
  })
})

describe("tamper detection (authenticated encryption)", () => {
  it("rejects a flipped auth tag", () => {
    const parts = encryptString("tamper-target").split(":")
    const tag = Buffer.from(parts[5], "base64url")
    tag[0] ^= 0x01
    parts[5] = tag.toString("base64url")
    expect(() => decryptString(parts.join(":"))).toThrow()
  })

  it("rejects a flipped ciphertext body", () => {
    const parts = encryptString("tamper-body").split(":")
    const ct = Buffer.from(parts[4], "base64url")
    ct[0] ^= 0x01
    parts[4] = ct.toString("base64url")
    expect(() => decryptString(parts.join(":"))).toThrow()
  })
})

describe("fail-closed key handling", () => {
  it("throws when decrypting with the wrong key", () => {
    const enc = encryptString("secret-under-dev-key")
    setKeys(OTHER_KEY)
    expect(() => decryptString(enc)).toThrow()
  })

  it("throws (no fallback) when ENCRYPTION_KEY is unset", () => {
    const enc = encryptString("needs-a-key")
    setKeys(undefined)
    expect(() => encryptString("x")).toThrow()
    expect(() => decryptString(enc)).toThrow()
  })

  it("throws for a malformed (wrong-length) key", () => {
    setKeys("deadbeef")
    expect(() => encryptString("x")).toThrow()
  })
})

describe("previous-key decryption (rotation)", () => {
  it("decrypts a k0-tagged value via ENCRYPTION_KEY_PREVIOUS", () => {
    // Encrypt under PREV (installed as current), then relabel k1 -> k0.
    setKeys(PREV_KEY)
    const k0Token = encryptString("rotated-secret").replace(":k1:", ":k0:")

    // Rotate: DEV_KEY current, PREV_KEY previous.
    setKeys(DEV_KEY, PREV_KEY)
    expect(decryptString(k0Token)).toBe("rotated-secret")
    // A fresh k1 value still decrypts with the new current key.
    expect(decryptString(encryptString("fresh-secret"))).toBe("fresh-secret")

    // Fail closed once the previous key is gone.
    setKeys(DEV_KEY)
    expect(() => decryptString(k0Token)).toThrow()
  })
})

describe("malformed / unknown inputs", () => {
  it("throws on an unknown keyId", () => {
    const badKeyId = encryptString("x").replace(":k1:", ":k2:")
    expect(() => decryptString(badKeyId)).toThrow()
  })

  it("throws on non-enc, truncated, and unknown-version inputs", () => {
    expect(() => decryptString("plain-old-token")).toThrow()
    expect(() => decryptString("enc:v1:k1:onlythree")).toThrow()
    expect(() => decryptString("enc:v2:k1:a:b:c")).toThrow()
  })
})

describe("credentials JSON wrappers", () => {
  it("round-trips an object", () => {
    const creds = { clientId: "abc123", clientSecret: "s3cr3t", scopes: ["read", "write"] }
    const enc = encryptCredentials(creds)
    expect(isEncrypted(enc)).toBe(true)
    expect(decryptCredentials(enc)).toEqual(creds)
  })

  it("throws on a legacy (non-string) credentials value", () => {
    expect(() =>
      decryptCredentials({ encrypted: "x", iv: "y", algorithm: "aes-256-gcm" } as any)
    ).toThrow()
  })
})

describe("token wrappers", () => {
  it("round-trips an encrypted token", () => {
    const enc = encryptToken("ya29.a0Af-access-token")
    expect(isEncrypted(enc)).toBe(true)
    expect(decryptToken(enc)).toBe("ya29.a0Af-access-token")
  })

  it("returns legacy plaintext as-is (transitional fallback)", () => {
    expect(decryptToken("legacy-plaintext-token")).toBe("legacy-plaintext-token")
  })

  it("passes through null and empty values", () => {
    expect(decryptToken(null)).toBeNull()
    expect(decryptToken(undefined)).toBeUndefined()
    expect(decryptToken("")).toBe("")
  })
})
