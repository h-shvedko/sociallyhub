// Runtime verification for the ADR-0007 Phase 1 storage service
// (src/lib/storage/{index,local,keys}).
//
// Why this exists: the jest suite is currently broken (invalid `moduleNameMapping`
// key in jest.config.js — ADR-0021), so this tsx script is the RUNNABLE proof.
// The jest-style mirror lives in __tests__/unit/storage.test.ts.
//
// Pure filesystem — no DB, no network. Uses a throwaway temp root and cleans it
// up. Run:
//
//   npx tsx --tsconfig tsconfig.json scripts/test-storage.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

import { randomUUID } from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { Readable } from "stream"

import {
  LocalStorageDriver,
  buildHelpKey,
  buildMediaKey,
  buildTicketKey,
  resolveWithinRoot,
  validateKey,
} from "../src/lib/storage"

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

function throwsSync(name: string, fn: () => unknown) {
  try {
    fn()
    ok(name, false, "expected an error to be thrown, but none was")
  } catch {
    ok(name, true)
  }
}

async function rejects(name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    ok(name, false, "expected the promise to reject, but it resolved")
  } catch {
    ok(name, true)
  }
}

// Throwaway root under the scratchpad temp area (falls back to os.tmpdir()).
const SCRATCH =
  "/tmp/claude-1000/-home-gena-sociallyhub/a1ac87c8-d275-4548-81a3-22cab53df9df/scratchpad"
const baseTmp = fs.existsSync(SCRATCH) ? SCRATCH : os.tmpdir()
const ROOT = path.join(baseTmp, `adr7-storage-test-${randomUUID()}`)

async function main() {
  fs.mkdirSync(ROOT, { recursive: true })
  process.env.STORAGE_LOCAL_ROOT = ROOT
  const storage = new LocalStorageDriver(ROOT)

  console.log(`\nADR-0007 storage service — verification (root: ${ROOT})\n`)

  // --- validateKey: traversal / malformed rejection ---
  console.log("validateKey rejects unsafe keys:")
  throwsSync("rejects '../etc/passwd'", () => validateKey("../etc/passwd"))
  throwsSync("rejects '/abs' (leading slash)", () => validateKey("/abs"))
  throwsSync("rejects absolute path", () => validateKey("/etc/passwd"))
  throwsSync("rejects 'a/../../b' (mid traversal)", () => validateKey("a/../../b"))
  throwsSync("rejects 'a\\b' (backslash)", () => validateKey("a\\b"))
  throwsSync("rejects NUL byte", () => validateKey("a/\0/b"))
  throwsSync("rejects empty key", () => validateKey(""))
  throwsSync("rejects '//double' (empty segment)", () => validateKey("a//b"))
  throwsSync("rejects trailing slash", () => validateKey("media/x/"))

  // --- validateKey: valid keys pass through unchanged ---
  console.log("\nvalidateKey accepts valid keys:")
  ok(
    "accepts 'media/ws/uuid.png'",
    validateKey("media/ws/uuid.png") === "media/ws/uuid.png"
  )
  ok(
    "accepts 'help/articles/id/file.jpg'",
    validateKey("help/articles/id/file.jpg") === "help/articles/id/file.jpg"
  )

  // --- key builders ---
  console.log("\nkey builders:")
  ok(
    "buildMediaKey composes media/{ws}/{file}",
    buildMediaKey("demo-workspace", "abc.png") === "media/demo-workspace/abc.png"
  )
  ok(
    "buildTicketKey composes tickets/{id}/{file}",
    buildTicketKey("t1", "doc.pdf") === "tickets/t1/doc.pdf"
  )
  ok(
    "buildHelpKey composes help/{kind}/{...}",
    buildHelpKey("videos", "intro.mp4") === "help/videos/intro.mp4"
  )
  throwsSync("buildMediaKey rejects traversal in filename", () =>
    buildMediaKey("ws", "../evil")
  )
  throwsSync("buildTicketKey rejects slash in id", () =>
    buildTicketKey("a/b", "doc.pdf")
  )
  throwsSync("buildHelpKey rejects unknown kind", () =>
    // @ts-expect-error deliberately wrong kind
    buildHelpKey("secrets", "x")
  )

  // --- put -> getBuffer round-trip (Buffer) ---
  console.log("\nput/get round-trips:")
  const mediaKey = buildMediaKey("demo-workspace", `${randomUUID()}.txt`)
  const payload = Buffer.from("hello storage service", "utf8")
  await storage.put(mediaKey, payload, { contentType: "text/plain" })
  const readBack = await storage.getBuffer(mediaKey)
  ok(
    "Buffer put -> getBuffer round-trips",
    readBack.equals(payload),
    `got ${readBack.toString("utf8")!}`
  )
  ok(
    "put created nested parent dirs",
    fs.existsSync(path.join(ROOT, mediaKey))
  )

  // --- put with Uint8Array ---
  const u8Key = buildMediaKey("demo-workspace", `${randomUUID()}.bin`)
  const u8 = new Uint8Array([1, 2, 3, 4, 5])
  await storage.put(u8Key, u8)
  const u8Back = await storage.getBuffer(u8Key)
  ok(
    "Uint8Array put -> getBuffer round-trips",
    u8Back.length === 5 && u8Back[0] === 1 && u8Back[4] === 5
  )

  // --- put with a Node Readable stream ---
  const streamKey = buildTicketKey("ticket-1", `${randomUUID()}.txt`)
  const streamPayload = "streamed content ".repeat(1000)
  await storage.put(streamKey, Readable.from([streamPayload]))
  const streamBack = await storage.getBuffer(streamKey)
  ok(
    "Node Readable put -> getBuffer round-trips",
    streamBack.toString("utf8") === streamPayload
  )

  // --- getStream returns readable content ---
  const gs = await storage.getStream(mediaKey)
  const chunks: Buffer[] = []
  for await (const c of gs as Readable) chunks.push(Buffer.from(c))
  ok(
    "getStream streams the stored bytes",
    Buffer.concat(chunks).equals(payload)
  )

  // --- stat ---
  console.log("\nstat:")
  const st = await storage.stat(mediaKey)
  ok(
    "stat returns size matching payload",
    st !== null && st.size === payload.length
  )
  ok("stat returns an mtime Date", st !== null && st.mtime instanceof Date)
  const missingStat = await storage.stat(
    buildMediaKey("demo-workspace", "does-not-exist.txt")
  )
  ok("stat returns null for missing key", missingStat === null)

  // --- delete removes; missing delete is a no-op ---
  console.log("\ndelete:")
  await storage.delete(mediaKey)
  ok(
    "delete removes the file",
    !fs.existsSync(path.join(ROOT, mediaKey))
  )
  await rejects("getBuffer rejects after delete", () =>
    storage.getBuffer(mediaKey)
  )
  let noThrow = true
  try {
    await storage.delete(mediaKey) // already gone
  } catch {
    noThrow = false
  }
  ok("delete on a missing key is a no-op", noThrow)

  // --- getStream / getBuffer reject on missing ---
  await rejects("getStream rejects for a missing key", () =>
    storage.getStream(buildMediaKey("demo-workspace", "nope.txt"))
  )

  // --- traversal keys throw at the driver boundary ---
  console.log("\ndriver refuses traversal / escaping keys:")
  await rejects("put with a traversal key throws", () =>
    storage.put("../escape.txt", Buffer.from("x"))
  )
  await rejects("put with an absolute key throws", () =>
    storage.put("/etc/evil", Buffer.from("x"))
  )
  await rejects("getBuffer with a traversal key throws", () =>
    storage.getBuffer("../../etc/passwd")
  )

  // --- defense-in-depth: resolveWithinRoot escape guard fires on its own ---
  // (feed it a raw `..` path that validateKey would normally reject upstream)
  throwsSync("resolveWithinRoot throws for an escaping path", () =>
    resolveWithinRoot(ROOT, "../../../etc/passwd")
  )
  ok(
    "resolveWithinRoot returns an in-root path for a valid key",
    resolveWithinRoot(ROOT, "media/ws/f.txt") ===
      path.join(path.resolve(ROOT), "media/ws/f.txt")
  )
  // A sibling directory sharing the root's name prefix must NOT be treated as
  // inside the root (the `path.sep` boundary check).
  throwsSync("resolveWithinRoot rejects a prefix-sibling escape", () => {
    const sibling = path.basename(ROOT) + "-evil"
    resolveWithinRoot(ROOT, path.join("..", sibling, "x"))
  })

  console.log(`\n${passed} passed, ${failed} failed\n`)
}

main()
  .catch((err) => {
    console.error("FATAL:", err)
    failed++
  })
  .finally(() => {
    // Clean up the throwaway root.
    try {
      fs.rmSync(ROOT, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    process.exit(failed === 0 ? 0 : 1)
  })
