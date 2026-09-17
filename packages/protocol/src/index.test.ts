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

it("retained index requests bound paging, references and media batches", () => {
  const reference = { recordingId: "take", revisionId: "r0", generation: "attempt" };
  expect(
    operationSchema.safeParse({ operation: "index.get", params: { recordingId: "take" } }).success,
  ).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.get",
      params: { recordingId: "take", limit: 201 },
    }).success,
  ).toBe(false);
  expect(
    operationSchema.safeParse({ operation: "index.frame", params: { ...reference, ordinal: 0 } })
      .success,
  ).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.frame",
      params: { recordingId: "take", ordinal: 0 },
    }).success,
  ).toBe(false);
  expect(
    operationSchema.safeParse({
      operation: "index.frames",
      params: { ...reference, ordinals: [1, 0, 1] },
    }).success,
  ).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.frames",
      params: { ...reference, ordinals: Array(9).fill(0) },
    }).success,
  ).toBe(false);
  expect(
    operationSchema.safeParse({
      operation: "index.coverage",
      params: { ...reference, cursor: { ...reference, afterSequence: 0, candidateOrdinal: null } },
    }).success,
  ).toBe(true);
});

it("package inspection requires one explicit target without silently accepting latest or mixed selectors", () => {
  for (const operation of ["revision.get", "revision.history", "index.get"]) {
    expect(
      operationSchema.safeParse({ operation, params: { packageHandle: "open-1" } }).success,
    ).toBe(true);
    for (const params of [
      {},
      { packageHandle: "open-1", recordingId: "take" },
      { packageHandle: "open-1", latest: true },
    ])
      expect(operationSchema.safeParse({ operation, params }).success).toBe(false);
  }
  for (const operation of ["audio.get", "index.retry", "recording.delete"])
    expect(
      operationSchema.safeParse({ operation, params: { packageHandle: "open-1", atUs: 0 } })
        .success,
    ).toBe(false);
});

it("arbitrary frame operations select either a package or a library recording", () => {
  for (const operation of ["frame.get", "frame.retry", "frame.batch"]) {
    const atUs = operation === "frame.batch" ? [0, 1] : 0;
    expect(
      operationSchema.safeParse({ operation, params: { packageHandle: "p", atUs } }).success,
    ).toBe(true);
    expect(
      operationSchema.safeParse({
        operation,
        params: { recordingId: "r", packageHandle: "p", atUs },
      }).success,
    ).toBe(false);
    expect(operationSchema.safeParse({ operation, params: { atUs } }).success).toBe(false);
  }
});
