import { describe, expect, it } from "vitest";
import {
  ARTIFACT_CHUNK_BYTES,
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

it("artifact reads ask for one bounded chunk at a whole offset", () => {
  const read = (params: Record<string, unknown>) =>
    operationSchema.safeParse({ operation: "artifact.read", params: { token: "t", ...params } });
  expect(read({ offset: 0 })).toMatchObject({
    success: true,
    data: { params: { maxBytes: ARTIFACT_CHUNK_BYTES } },
  });
  for (const [offset, maxBytes] of [
    [-1, 1],
    [0.5, 1],
    [0, 0],
    [0, ARTIFACT_CHUNK_BYTES + 1],
    [0, Number.NaN],
  ])
    expect(read({ offset, maxBytes }).success).toBe(false);
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
  for (const operation of ["index.retry", "recording.delete"])
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

it("audio inspection selects exactly one library or package target", () => {
  for (const operation of ["audio.get", "audio.retry"]) {
    const params = { packageHandle: "handle", range: { startUs: 0, endUs: 1000 }, track: "system" };
    expect(operationSchema.parse({ operation, params })).toBeTruthy();
    expect(() =>
      operationSchema.parse({ operation, params: { ...params, recordingId: "library" } }),
    ).toThrow();
  }
});

it("raw cursor target and continuation namespaces are exclusive", () => {
  const fields = { sourceRange: { startUs: 0, endUs: 1000 }, limit: 1 };
  const position = {
    sourceId: "source",
    generation: "generation",
    sourceRange: fields.sourceRange,
    afterSequence: 1,
  };
  for (const target of [{ recordingId: "library" }, { packageHandle: "package" }]) {
    expect(
      operationSchema.safeParse({
        operation: "cursor.raw",
        params: { ...target, ...fields, cursor: { ...target, ...position } },
      }).success,
    ).toBe(true);
  }
  for (const params of [
    fields,
    { ...fields, recordingId: "library", packageHandle: "package" },
    { ...fields, packageHandle: "package", latest: true },
    { ...fields, packageHandle: "package", revisionId: "r1" },
    { ...fields, packageHandle: "package", cursor: { recordingId: "library", ...position } },
    { ...fields, recordingId: "library", cursor: { packageHandle: "package", ...position } },
  ])
    expect(operationSchema.safeParse({ operation: "cursor.raw", params }).success).toBe(false);
});

it("transcript pages and searches are bounded and their cursors name the pinned generation", () => {
  const parse = (operation: string, params: Record<string, unknown>) =>
    operationSchema.safeParse({ operation, params: { recordingId: "take", ...params } });
  expect(parse("transcript.get", {})).toMatchObject({ data: { params: { limit: 250 } } });
  expect(parse("transcript.search", { text: "hello" })).toMatchObject({
    data: { params: { limit: 100 } },
  });
  const position = { recordingId: "take", revisionId: "r0", generation: "attempt" };
  const accepted: [string, Record<string, unknown>][] = [
    ["transcript.get", { limit: 1000 }],
    [
      "transcript.get",
      { cursor: { ...position, afterSourceUs: 0, afterOrdinal: null, range: null } },
    ],
    ["transcript.search", { text: "x".repeat(200), limit: 500 }],
    [
      "transcript.search",
      { text: "hello", cursor: { ...position, afterSourceUs: 0, afterOrdinal: 3, text: "hello" } },
    ],
  ];
  for (const [operation, params] of accepted)
    expect(parse(operation, params).success, JSON.stringify(params)).toBe(true);
  const refused: [string, Record<string, unknown>][] = [
    ["transcript.get", { limit: 1001 }],
    ["transcript.get", { cursor: { ...position, afterSourceUs: 0, afterOrdinal: null } }],
    ["transcript.search", { text: "" }],
    ["transcript.search", { text: "x".repeat(201) }],
    ["transcript.search", { text: "hello", limit: 501 }],
    ["transcript.search", { text: "hello", cursor: { ...position, afterSourceUs: 0 } }],
  ];
  for (const [operation, params] of refused)
    expect(parse(operation, params).success, JSON.stringify(params)).toBe(false);
});
