import assert from "node:assert/strict";
import { test } from "node:test";
import { RESPONSE_FRAME_BYTES } from "@screenrec/protocol";
import { JourneyService, hash } from "./source-evidence-fixture.mjs";

test("MCP complete results preserve values, reject corrupt delivery and close without replay", async () => {
  const failure = { code: "NOT_READY", message: "Retained failure", retryable: false, details: {} };
  for (const mode of [
    "success",
    "failure",
    "length",
    "hash",
    "progress",
    "offset",
    "eof",
    "id",
    "ok",
    "limit",
    "read",
    "read-and-close",
    "close",
  ]) {
    const complete =
      mode === "failure"
        ? { id: "original", ok: false, error: failure }
        : {
            id: mode === "id" ? "different" : "original",
            ok: true,
            data: {
              rows: [{ clipId: "left", atUs: 123, label: "café 🦊" }],
              delivery: { token: "nested-media" },
            },
          };
    const bytes = Buffer.from(JSON.stringify(complete));
    const descriptor = {
      id: "original",
      ok: mode === "ok" ? false : complete.ok,
      resultDelivery: {
        token: "lease",
        bytes: mode === "limit" ? RESPONSE_FRAME_BYTES : bytes.length + (mode === "length" ? 1 : 0),
        sha256: mode === "hash" ? "0".repeat(64) : hash(bytes),
        expiresAt: Date.now() + 30000,
        mediaType: "application/json",
      },
    };
    const report = { trace: [], exchanges: [] };
    const service = new JourneyService("/unused", report);
    const calls = [];
    const readFailure = new Error("Read failed"),
      closeFailure = new Error("Close failed");
    service.mcp = {
      async callTool(request) {
        calls.push(structuredClone(request));
        assert.ok(calls.length <= bytes.length + 2, `${mode}: no-progress loop`);
        if (request.name === "timeline.events") return { structuredContent: descriptor };
        assert.equal(request.arguments.token, "lease");
        if (request.name === "artifact.close") {
          if (["close", "read-and-close"].includes(mode)) throw closeFailure;
          return { structuredContent: { id: "close", ok: true, data: { closed: true } } };
        }
        assert.equal(request.name, "artifact.read");
        if (["read", "read-and-close"].includes(mode)) throw readFailure;
        const offset = request.arguments.offset;
        const part = bytes.subarray(offset, offset + 17);
        return {
          structuredContent: {
            id: "chunk",
            ok: true,
            data: {
              data: part.toString("base64"),
              offset: mode === "offset" ? offset + 1 : offset,
              nextOffset: mode === "progress" ? offset : offset + part.length,
              eof: mode === "eof" ? true : offset + part.length === bytes.length,
            },
          },
        };
      },
    };
    const result = service.call(
      "timeline.events",
      { projectId: "project", limit: 250 },
      { transport: "mcp", error: mode === "failure" },
    );
    if (["success", "failure"].includes(mode)) {
      assert.deepEqual(await result, mode === "failure" ? failure : complete.data, mode);
      assert.deepEqual(report.exchanges[0].completeResponse, complete);
      assert.equal(report.exchanges[0].completeText, bytes.toString());
    } else {
      await assert.rejects(
        result,
        (error) => {
          if (mode === "read") assert.equal(error, readFailure);
          if (mode === "read-and-close")
            assert.deepEqual(error.errors, [readFailure, closeFailure]);
          if (mode === "close") assert.equal(error, closeFailure);
          if (["length", "progress", "offset", "eof"].includes(mode))
            assert.match(error.message, /chunk must advance/);
          if (mode === "hash") assert.match(error.message, /digest mismatch/);
          if (["id", "ok"].includes(mode)) assert.match(error.message, /must match its descriptor/);
          if (mode === "limit") assert.equal(error.name, "ZodError");
          return true;
        },
        mode,
      );
    }
    assert.deepEqual(report.exchanges[0].response, { structuredContent: descriptor });
    if (["hash", "id", "ok"].includes(mode))
      assert.equal(report.exchanges[0].completeText, bytes.toString());
    if (["id", "ok"].includes(mode))
      assert.deepEqual(report.exchanges[0].completeResponse, complete);
    assert.deepEqual(calls[0], {
      name: "timeline.events",
      arguments: { projectId: "project", limit: 250 },
    });
    assert.equal(calls.filter((call) => call.name === "timeline.events").length, 1, mode);
    assert.equal(calls.filter((call) => call.name === "artifact.close").length, 1, mode);
    assert.equal(calls.at(-1).name, "artifact.close", mode);
  }
  for (const complete of [
    { id: "inline", ok: true, data: { revision: "r1" } },
    { id: "inline", ok: false, error: failure },
  ]) {
    const service = new JourneyService("/unused", { trace: [] });
    service.mcp = { callTool: async () => ({ structuredContent: complete }) };
    assert.deepEqual(
      await service.call("edit.apply", {}, { transport: "mcp", error: !complete.ok }),
      complete.ok ? complete.data : failure,
    );
  }
});
