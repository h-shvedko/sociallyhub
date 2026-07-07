/**
 * Unit tests for the ADR-0007 Phase 1 storage service
 * (src/lib/storage/{index,local,keys}): the traversal guard (validateKey),
 * key builders, the local-disk driver round-trips, and the defense-in-depth
 * root-escape guard (resolveWithinRoot).
 *
 * NOTE (ADR-0021): the jest infrastructure is currently broken — jest.config.js
 * uses the invalid option name `moduleNameMapping` (should be `moduleNameMapper`),
 * so the `@/` alias never resolves and this suite cannot run until ADR-0021
 * repairs the config. It is written jest-style for that future suite. Until then,
 * the RUNNABLE proof of the same cases lives in scripts/test-storage.ts (tsx,
 * pure filesystem) — verified 35/35 passing.
 *
 * No mocks: the local driver is exercised against a real throwaway temp root
 * created in beforeAll and removed in afterAll.
 */

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
} from "@/lib/storage"

let ROOT: string
let storage: LocalStorageDriver

beforeAll(() => {
  ROOT = path.join(os.tmpdir(), `adr7-storage-jest-${randomUUID()}`)
  fs.mkdirSync(ROOT, { recursive: true })
  storage = new LocalStorageDriver(ROOT)
})

afterAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true })
})

describe("validateKey (traversal guard)", () => {
  it.each([
    ["../etc/passwd", "leading traversal"],
    ["/abs", "leading slash"],
    ["/etc/passwd", "absolute path"],
    ["a/../../b", "mid-path traversal"],
    ["a\\b", "backslash"],
    ["a/\0/b", "NUL byte"],
    ["", "empty string"],
    ["a//b", "empty segment"],
    ["media/x/", "trailing slash"],
  ])("rejects %p (%s)", (key) => {
    expect(() => validateKey(key)).toThrow()
  })

  it.each(["media/ws/uuid.png", "help/articles/id/file.jpg", "tickets/t1/a.pdf"])(
    "accepts %p unchanged",
    (key) => {
      expect(validateKey(key)).toBe(key)
    }
  )
})

describe("key builders", () => {
  it("buildMediaKey composes media/{workspaceId}/{filename}", () => {
    expect(buildMediaKey("demo-workspace", "abc.png")).toBe(
      "media/demo-workspace/abc.png"
    )
  })

  it("buildTicketKey composes tickets/{ticketId}/{filename}", () => {
    expect(buildTicketKey("t1", "doc.pdf")).toBe("tickets/t1/doc.pdf")
  })

  it("buildHelpKey composes help/{kind}/{...parts}", () => {
    expect(buildHelpKey("videos", "intro.mp4")).toBe("help/videos/intro.mp4")
    expect(buildHelpKey("articles", "id", "hero.jpg")).toBe(
      "help/articles/id/hero.jpg"
    )
  })

  it("rejects traversal / separators in builder arguments", () => {
    expect(() => buildMediaKey("ws", "../evil")).toThrow()
    expect(() => buildTicketKey("a/b", "doc.pdf")).toThrow()
    // @ts-expect-error deliberately invalid help kind
    expect(() => buildHelpKey("secrets", "x")).toThrow()
  })
})

describe("LocalStorageDriver round-trips", () => {
  it("put(Buffer) -> getBuffer round-trips and creates parent dirs", async () => {
    const key = buildMediaKey("demo-workspace", `${randomUUID()}.txt`)
    const payload = Buffer.from("hello storage service", "utf8")
    await storage.put(key, payload, { contentType: "text/plain" })
    expect(fs.existsSync(path.join(ROOT, key))).toBe(true)
    expect((await storage.getBuffer(key)).equals(payload)).toBe(true)
  })

  it("put(Uint8Array) -> getBuffer round-trips", async () => {
    const key = buildMediaKey("demo-workspace", `${randomUUID()}.bin`)
    await storage.put(key, new Uint8Array([1, 2, 3, 4, 5]))
    const back = await storage.getBuffer(key)
    expect(back.length).toBe(5)
    expect(back[0]).toBe(1)
    expect(back[4]).toBe(5)
  })

  it("put(Readable) -> getBuffer round-trips", async () => {
    const key = buildTicketKey("ticket-1", `${randomUUID()}.txt`)
    const payload = "streamed content ".repeat(1000)
    await storage.put(key, Readable.from([payload]))
    expect((await storage.getBuffer(key)).toString("utf8")).toBe(payload)
  })

  it("getStream yields the stored bytes", async () => {
    const key = buildMediaKey("demo-workspace", `${randomUUID()}.txt`)
    const payload = Buffer.from("stream me")
    await storage.put(key, payload)
    const stream = (await storage.getStream(key)) as Readable
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    expect(Buffer.concat(chunks).equals(payload)).toBe(true)
  })

  it("stat returns size + mtime, or null for a missing key", async () => {
    const key = buildMediaKey("demo-workspace", `${randomUUID()}.txt`)
    const payload = Buffer.from("sized")
    await storage.put(key, payload)
    const st = await storage.stat(key)
    expect(st).not.toBeNull()
    expect(st!.size).toBe(payload.length)
    // Cross-realm safe Date check: fs.Stats dates come from the host realm,
    // whose Date constructor !== the jest vm context's Date.
    expect(Object.prototype.toString.call(st!.mtime)).toBe("[object Date]")
    expect(Number.isFinite(st!.mtime.getTime())).toBe(true)
    expect(await storage.stat(buildMediaKey("demo-workspace", "missing"))).toBeNull()
  })

  it("delete removes the file and is a no-op when already gone", async () => {
    const key = buildMediaKey("demo-workspace", `${randomUUID()}.txt`)
    await storage.put(key, Buffer.from("bye"))
    await storage.delete(key)
    expect(fs.existsSync(path.join(ROOT, key))).toBe(false)
    await expect(storage.getBuffer(key)).rejects.toThrow()
    await expect(storage.delete(key)).resolves.toBeUndefined()
  })

  it("getStream rejects for a missing key", async () => {
    await expect(
      storage.getStream(buildMediaKey("demo-workspace", "nope.txt"))
    ).rejects.toThrow()
  })
})

describe("driver refuses traversal / escaping keys", () => {
  it("put/getBuffer with unsafe keys throw", async () => {
    await expect(storage.put("../escape.txt", Buffer.from("x"))).rejects.toThrow()
    await expect(storage.put("/etc/evil", Buffer.from("x"))).rejects.toThrow()
    await expect(storage.getBuffer("../../etc/passwd")).rejects.toThrow()
  })
})

describe("resolveWithinRoot (defense-in-depth escape guard)", () => {
  it("throws for a path that escapes the root", () => {
    expect(() => resolveWithinRoot(ROOT, "../../../etc/passwd")).toThrow()
  })

  it("returns an in-root absolute path for a valid key", () => {
    expect(resolveWithinRoot(ROOT, "media/ws/f.txt")).toBe(
      path.join(path.resolve(ROOT), "media/ws/f.txt")
    )
  })

  it("rejects a prefix-sibling escape (path.sep boundary)", () => {
    const sibling = path.basename(ROOT) + "-evil"
    expect(() => resolveWithinRoot(ROOT, path.join("..", sibling, "x"))).toThrow()
  })
})
