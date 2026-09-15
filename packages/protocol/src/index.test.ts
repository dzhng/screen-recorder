import { describe, expect, it } from "vitest";
import {
  captureSelectionSchema,
  nativeStartSchema,
  operationSchema,
  parseRequest,
} from "./index.js";

describe("native operation envelope", () => {
  it("rejects an unknown top-level field instead of silently accepting a misspelled request", () => {
    expect(() =>
      parseRequest({ id: "request-1", operation: "system.ping", params: {}, param: {} }),
    ).toThrow();
  });
});

describe("capture selection", () => {
  const source = { kind: "window", windowId: 7 } as const;
  it("records the narrator by default and the machine's own audio only when asked", () => {
    const capture = operationSchema.parse({
      operation: "capture.start",
      params: { requestId: "r", source },
    });
    expect(capture.params).toMatchObject({ microphone: true, systemAudio: false });
    // A caller's explicit refusal is never overridden by the default.
    expect(
      captureSelectionSchema.parse({ source, microphone: false, systemAudio: false }),
    ).toMatchObject({ microphone: false, systemAudio: false });
    // Native is told both, on every start, so no peer restates a default of its own.
    expect(
      nativeStartSchema.parse({ source, recordingId: "r", sourceId: "s", outputDirectory: "/tmp" }),
    ).toMatchObject({ microphone: true, systemAudio: false });
  });
});
