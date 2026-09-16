import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { listenLocal } from "@screenrec/service";
import type { OperationResponse } from "@screenrec/protocol";
import { mediaBytes } from "./media.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture(
  bytes: Buffer,
  malformed = false,
  mediaType: "image/png" | "audio/wav" = "image/png",
) {
  const runtimeDirectory = await mkdtemp("/tmp/scr-delivery-client-");
  let closes = 0;
  let reads = 0;
  const listener = await listenLocal({
    runtimeDirectory,
    handler: async (request) => {
      if (request.operation === "artifact.close") {
        closes++;
        return { ok: true, data: { closed: true } };
      }
      reads++;
      const { offset, maxBytes } = request.params as { offset: number; maxBytes: number };
      const part = bytes.subarray(offset, offset + maxBytes);
      return {
        ok: true,
        data: {
          offset,
          nextOffset: malformed ? offset : offset + part.length,
          eof: offset + part.length === bytes.length,
          data: part.toString("base64"),
        },
      };
    },
  });
  cleanups.push(async () => {
    await listener.close();
    await rm(runtimeDirectory, { recursive: true, force: true });
  });
  const result: OperationResponse = {
    id: "frame",
    ok: true,
    data: {
      state: "ready",
      delivery: { token: "lease", bytes: bytes.length, expiresAt: Date.now() + 30000 },
      published: mediaType === "image/png" ? { frame: { mediaType } } : { audio: { mediaType } },
    },
  };
  return {
    result,
    selection: { socketPath: listener.socketPath },
    reads: () => reads,
    closes: () => closes,
  };
}

test("the image transport assembles bytes larger than one metadata response and releases its delivery", async () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024 + 17);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const f = await fixture(bytes);
  expect((await mediaBytes(f.selection, f.result))?.bytes.equals(bytes)).toBe(true);
  expect(f.reads()).toBeGreaterThan(1);
  expect(f.closes()).toBe(1);
});

test("a nonadvancing chunk fails immediately and still releases the delivery", async () => {
  const f = await fixture(Buffer.from("evidence"), true);
  await expect(mediaBytes(f.selection, f.result)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
  expect(f.reads()).toBe(1);
  expect(f.closes()).toBe(1);
});

test("audio payloads can exceed the image limit while preserving type and bytes", async () => {
  const bytes = Buffer.alloc(33 * 1024 * 1024 + 3, 0x71);
  const f = await fixture(bytes, false, "audio/wav");
  const media = await mediaBytes(f.selection, f.result);
  expect(media?.mediaType).toBe("audio/wav");
  expect(media?.bytes.equals(bytes)).toBe(true);
  expect(f.closes()).toBe(1);
});

test("an oversized image is refused before reading and its lease is released", async () => {
  const f = await fixture(Buffer.alloc(33 * 1024 * 1024));
  await expect(mediaBytes(f.selection, f.result)).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  expect(f.reads()).toBe(0);
  expect(f.closes()).toBe(1);
});
