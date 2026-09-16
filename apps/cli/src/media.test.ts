import { afterEach, expect, test } from "vitest";
import { mkdtemp, rm, writeFile, access } from "node:fs/promises";
import { listenLocal } from "@screenrec/service";
import type { OperationResponse } from "@screenrec/protocol";
import { mediaBytes, consumeBatch } from "./media.js";

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

test("selected-image batches preserve ordinal order, duplicates and generation while draining failed output leases", async () => {
  const bytes = Buffer.from("selected evidence");
  const f = await fixture(bytes);
  const response: OperationResponse = {
    id: "selected",
    ok: true,
    data: {
      recordingId: "recording",
      revisionId: "r3",
      generation: "retained-1",
      items: [
        { ordinal: 7, ok: true, data: f.result.ok ? f.result.data : null },
        {
          ordinal: 2,
          ok: false,
          error: { code: "NOT_FOUND", message: "missing", retryable: false, details: {} },
        },
        { ordinal: 7, ok: true, data: f.result.ok ? f.result.data : null },
      ],
    },
  };
  const consumed: Buffer[] = [];
  const result = await consumeBatch(
    f.selection,
    response,
    "ordinal",
    async (media, index) => {
      consumed.push(media.bytes);
      if (index === 0) throw new Error("output refused");
      return { contentIndex: 1 };
    },
    (error) => ({
      code: "OUTPUT_FAILED",
      message: (error as Error).message,
      retryable: false,
      details: {},
    }),
  );
  expect(result).toMatchObject({
    ok: true,
    data: {
      recordingId: "recording",
      revisionId: "r3",
      generation: "retained-1",
      items: [
        { ordinal: 7, ok: false, error: { code: "OUTPUT_FAILED", message: "output refused" } },
        { ordinal: 2, ok: false, error: { code: "NOT_FOUND" } },
        { ordinal: 7, ok: true, data: { contentIndex: 1 } },
      ],
    },
  });
  expect(
    (result.ok ? (result.data as { items: Record<string, unknown>[] }).items : []).map(
      (item) => item.atUs,
    ),
  ).toEqual([undefined, undefined, undefined]);
  expect(consumed).toEqual([bytes, bytes]);
  expect(f.closes()).toBe(2);
});

test("metadata-only selected batches never read bytes or create an output file", async () => {
  const f = await fixture(Buffer.from("unused"));
  const output = f.selection.socketPath + ".png";
  const data = {
    recordingId: "recording",
    revisionId: "r3",
    generation: "pending",
    items: [{ ordinal: 0, ok: true, data: { state: "processing", published: null } }],
  };
  const result = await consumeBatch(
    f.selection,
    { id: "pending", ok: true, data },
    "ordinal",
    async (media) => {
      await writeFile(output, media.bytes);
      return { output };
    },
    () => ({ code: "UNEXPECTED", message: "unexpected", retryable: false, details: {} }),
  );
  expect(result).toEqual({ id: "pending", ok: true, data });
  expect(f.reads()).toBe(0);
  expect(f.closes()).toBe(0);
  await expect(access(output)).rejects.toMatchObject({ code: "ENOENT" });
});

test("timestamp batches preserve timestamp identity on failed media reads", async () => {
  const f = await fixture(Buffer.from("evidence"), true);
  const result = await consumeBatch(
    f.selection,
    {
      id: "time",
      ok: true,
      data: {
        recordingId: "recording",
        revisionId: "r2",
        items: [{ atUs: 42, ok: true, data: f.result.ok ? f.result.data : null }],
      },
    },
    "atUs",
    async () => ({}),
    (error) => ({
      code: (error as { code: string }).code,
      message: (error as Error).message,
      retryable: false,
      details: {},
    }),
  );
  expect(result).toEqual({
    id: "time",
    ok: true,
    data: {
      recordingId: "recording",
      revisionId: "r2",
      items: [
        {
          atUs: 42,
          ok: false,
          error: {
            code: "INVALID_RESPONSE",
            message: "Media chunk does not advance within the delivery",
            retryable: false,
            details: {},
          },
        },
      ],
    },
  });
  expect(f.closes()).toBe(1);
});

test("selected batch metadata cannot masquerade as timestamp batch metadata", async () => {
  const f = await fixture(Buffer.from("unused"));
  await expect(
    consumeBatch(
      f.selection,
      {
        id: "wrong",
        ok: true,
        data: {
          recordingId: "recording",
          revisionId: "r1",
          generation: "index",
          items: [{ atUs: 0, ok: true, data: { state: "processing" } }],
        },
      },
      "ordinal",
      async () => ({}),
      () => ({ code: "UNEXPECTED", message: "unexpected", retryable: false, details: {} }),
    ),
  ).rejects.toThrow();
  expect(f.reads()).toBe(0);
});
