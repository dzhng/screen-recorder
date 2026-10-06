import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

it("reads authored project revisions while recording identities retain only source lifetime", () => {
  const request = (operation: string, params: Record<string, unknown>) => {
    const wire = parseRequest({ id: "caller", operation, params });
    return operationSchema.safeParse({ operation: wire.operation, params: wire.params });
  };
  expect(request("revision.get", { recordingId: "take", revisionId: "revision" }).success).toBe(
    false,
  );
  expect(request("revision.get", { projectId: "project", revisionId: "revision" })).toMatchObject({
    success: true,
    data: { operation: "revision.get", params: { projectId: "project", revisionId: "revision" } },
  });
  expect(request("recording.delete", { recordingId: "take" })).toMatchObject({
    success: true,
    data: { operation: "recording.delete", params: { recordingId: "take" } },
  });
});

describe("capture selection", () => {
  const source = { kind: "window", windowId: 7 } as const;
  it("admits an explicitly selected camera as primary video with the shared audio defaults", () => {
    expect(
      operationSchema.parse({
        operation: "capture.start",
        params: { requestId: "camera-take", source: { kind: "camera", deviceId: "camera-2" } },
      }),
    ).toMatchObject({
      operation: "capture.start",
      params: {
        requestId: "camera-take",
        source: { kind: "camera", deviceId: "camera-2" },
        microphone: true,
        systemAudio: false,
      },
    });
  });
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
  it("refuses companion camera authority on a primary camera and malformed device identities", () => {
    for (const params of [
      { source: { kind: "camera", deviceId: "primary" }, cameraDeviceId: "companion" },
      { source: { kind: "camera" } },
      { source: { kind: "camera", deviceId: "" } },
      { source: { kind: "camera", deviceId: "c".repeat(257) } },
      { source: { kind: "camera", deviceId: "primary", displayId: 7 } },
    ]) {
      expect(
        operationSchema.safeParse({
          operation: "capture.start",
          params: { requestId: "r", ...params },
        }).success,
      ).toBe(false);
    }
    expect(
      nativeStartSchema.safeParse({
        recordingId: "r",
        sourceId: "s",
        outputDirectory: "/tmp/source",
        source: { kind: "camera", deviceId: "primary" },
        cameraDeviceId: "companion",
        cameraSourceId: "c",
        cameraDirectory: "/tmp/camera",
      }).success,
    ).toBe(false);
  });
  it("refuses allocated companion authority even without a companion device", () => {
    for (const companion of [{ cameraSourceId: "ghost" }, { cameraDirectory: "/tmp/ghost" }]) {
      expect(
        nativeStartSchema.safeParse({
          recordingId: "r",
          sourceId: "s",
          outputDirectory: "/tmp/source",
          source: { kind: "camera", deviceId: "primary" },
          ...companion,
        }).success,
      ).toBe(false);
    }
  });
  it("shares camera selection fixtures with the native app boundary", () => {
    const fixture = JSON.parse(
      readFileSync(new URL("../fixtures/capture-primary-camera.json", import.meta.url), "utf8"),
    );
    expect(captureSelectionSchema.parse(fixture.selection)).toEqual(fixture.selection);
    for (const selection of fixture.invalidSelections)
      expect(captureSelectionSchema.safeParse(selection).success).toBe(false);
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

it("project indexes use picture taps and retained references across paging and delivery", () => {
  const reference = {
    projectId: "project",
    revisionId: "revision",
    generation: "index",
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
    maxLongEdge: 640,
  };
  const requests = [
    { operation: "index.get", params: { projectId: "project" } },
    {
      operation: "index.get",
      params: { projectId: "project", cursor: { ...reference, afterOrdinal: 0 } },
    },
    { operation: "index.retry", params: { projectId: "project", tap: reference.tap } },
    {
      operation: "index.coverage",
      params: { ...reference, cursor: { ...reference, afterSequence: 0, candidateOrdinal: null } },
    },
    { operation: "index.frame", params: { ...reference, ordinal: 0 } },
    { operation: "index.frames", params: { ...reference, ordinals: [1, 0, 1] } },
  ];
  for (const request of requests)
    expect(operationSchema.safeParse(request).success, request.operation).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.get",
      params: { projectId: "project", range: { startUs: 0, endUs: 1000 } },
    }).success,
  ).toBe(false);
  const incomplete = { ...reference, tap: undefined };
  expect(
    operationSchema.safeParse({ operation: "index.frame", params: { ...incomplete, ordinal: 0 } })
      .success,
  ).toBe(false);
});

it("retained index requests bound paging, references and media batches", () => {
  const source = { assetId: "asset", streamId: "video" };
  const reference = { ...source, generation: "attempt" };
  expect(operationSchema.safeParse({ operation: "index.get", params: source }).success).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.get",
      params: { ...source, limit: 201 },
    }).success,
  ).toBe(false);
  expect(
    operationSchema.safeParse({ operation: "index.frame", params: { ...reference, ordinal: 0 } })
      .success,
  ).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "index.frame",
      params: { ...source, ordinal: 0 },
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

it("package handles do not authorize managed media inspection", () => {
  for (const operation of ["revision.get", "revision.history", "index.get"]) {
    expect(
      operationSchema.safeParse({ operation, params: { packageHandle: "open-1" } }).success,
    ).toBe(false);
    expect(operationSchema.safeParse({ operation, params: { projectId: "project" } }).success).toBe(
      true,
    );
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

it("arbitrary frame operations require a project or selected asset", () => {
  for (const operation of ["frame.get", "frame.retry", "frame.batch"]) {
    const atUs = operation === "frame.batch" ? [0, 1] : 0;
    expect(
      operationSchema.safeParse({
        operation,
        params: { assetId: "asset", streamId: "video", atUs },
      }).success,
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

it("audio inspection selects exactly one project or asset stream", () => {
  for (const operation of ["audio.get", "audio.retry"]) {
    const params = { assetId: "asset", streamId: "audio", range: { startUs: 0, endUs: 1000 } };
    expect(operationSchema.parse({ operation, params })).toBeTruthy();
    expect(() =>
      operationSchema.parse({ operation, params: { ...params, recordingId: "library" } }),
    ).toThrow();
  }
});

it("raw cursor target and continuation namespaces are exclusive", () => {
  const fields = { sourceRange: { startUs: 0, endUs: 1000 }, limit: 1 };
  const position = {
    cursor: { after: null, done: false },
    pause: { after: null, done: false },
    geometry: { after: null, done: false },
    interruption: { after: null, done: false },
  };
  const source = { assetId: "asset", streamId: "video", acquisitionId: "capture" };
  expect(
    operationSchema.safeParse({
      operation: "cursor.raw",
      params: { ...source, ...fields, cursor: { reference: "pinned", position } },
    }).success,
  ).toBe(true);
  for (const params of [
    fields,
    { ...fields, recordingId: "library", packageHandle: "package" },
    { ...fields, packageHandle: "package", latest: true },
    { ...fields, packageHandle: "package", revisionId: "r1" },
    { ...fields, packageHandle: "package", cursor: { recordingId: "library", ...position } },
    { ...fields, recordingId: "library", cursor: { packageHandle: "package", ...position } },
    ...["recordingId", "packageHandle"].flatMap((field) => [
      { ...source, ...fields, [field]: "foreign-owner" },
      {
        ...source,
        ...fields,
        cursor: { reference: "pinned", position, [field]: "foreign-owner" },
      },
    ]),
  ])
    expect(operationSchema.safeParse({ operation: "cursor.raw", params }).success).toBe(false);
});

it("transcript pages and searches are bounded and their cursors name the pinned generation", () => {
  const parse = (operation: string, params: Record<string, unknown>) =>
    operationSchema.safeParse({
      operation,
      params: { assetId: "asset", streamId: "audio", ...params },
    });
  expect(parse("transcript.get", {})).toMatchObject({ data: { params: { limit: 250 } } });
  expect(parse("transcript.search", { text: "hello" })).toMatchObject({
    data: { params: { limit: 100 } },
  });
  const position = {
    assetId: "asset",
    streamId: "audio",
    acquisitionId: null,
    generation: "attempt",
    supportDigest: "digest",
  };
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

it("project exports preserve their target and refuse ambiguous owners", () => {
  const destination = {
    exportId: "67a0c032-a3ee-44b9-81f8-7269f0f3195e",
    directory: "/tmp/exports",
    leaf: "tutorial.mp4",
    kind: "video",
  };
  const params = { ...destination, projectId: "project", revisionId: "revision" };
  expect(operationSchema.parse({ operation: "export.create", params }).params).toEqual(params);
  const portable = { ...params, kind: "processed-package", leaf: "tutorial.zip" };
  expect(operationSchema.parse({ operation: "export.create", params: portable }).params).toEqual(
    portable,
  );
  for (const invalid of [
    { ...params, recordingId: "recording" },
    { ...params, range: { startUs: 0, endUs: 1 } },
    destination,
  ])
    expect(operationSchema.safeParse({ operation: "export.create", params: invalid }).success).toBe(
      false,
    );
});

it("source capture continuations retain every reader head through both public operations", () => {
  const position = {
    cursor: { after: null, done: true },
    pause: { after: [999, 1], done: false },
    geometry: { after: null, done: true },
    interruption: { after: null, done: false },
  };
  for (const operation of ["cursor.raw", "timeline.events"]) {
    const params = {
      assetId: "asset",
      streamId: "track:1",
      acquisitionId: "capture",
      sourceRange: { startUs: 0, endUs: 1000 },
      limit: 1,
      cursor: {
        reference: "pinned",
        position:
          operation === "timeline.events"
            ? {
                capture: position,
                scene: { after: { actualSourceUs: 999, ordinal: 0 }, done: false },
              }
            : position,
      },
    };
    expect(operationSchema.parse({ operation, params })).toEqual({ operation, params });
    expect(
      operationSchema.safeParse({ operation, params: { ...params, revisionId: "fake" } }).success,
    ).toBe(false);
  }
});

it("caption sidecar export requires pinned revision and explicit unique placements without media settings", () => {
  const params = {
    kind: "srt",
    projectId: "p",
    revisionId: "r",
    placementIds: ["caption"],
    exportId: "11111111-1111-4111-8111-111111111111",
    directory: "/tmp",
    leaf: "selected.srt",
  };
  expect(operationSchema.safeParse({ operation: "export.create", params }).success).toBe(true);
  expect(
    operationSchema.safeParse({ operation: "export.create", params: { ...params, kind: "vtt" } })
      .success,
  ).toBe(true);
  for (const invalid of [
    { ...params, revisionId: undefined },
    { ...params, placementIds: [] },
    { ...params, placementIds: ["caption", "caption"] },
    { ...params, settings: {} },
  ]) {
    expect(operationSchema.safeParse({ operation: "export.create", params: invalid }).success).toBe(
      false,
    );
  }
});

it("loudness admission keeps source/project selectors exclusive and channel interpretation explicit", () => {
  const source = {
    assetId: "a",
    streamId: "mono",
    acquisitionId: "capture",
    channelInterpretation: "dual-mono",
    truePeak: false,
  };
  expect(operationSchema.safeParse({ operation: "audio.measure", params: source }).success).toBe(
    true,
  );
  expect(
    operationSchema.safeParse({
      operation: "audio.measure",
      params: {
        projectId: "p",
        revisionId: "r",
        preparedResourceId: "exact",
        tap: { target: { kind: "output" }, point: { kind: "processed" } },
      },
    }).success,
  ).toBe(true);
  for (const extra of [
    { projectId: "p" },
    { channelInterpretation: "stereo" },
    { targetLufs: -14 },
  ])
    expect(
      operationSchema.safeParse({ operation: "audio.measure", params: { ...source, ...extra } })
        .success,
    ).toBe(false);
});

it("admits project alignment reads only with an explicit prepared tap identity", () => {
  const request = {
    operation: "alignment.get",
    params: {
      projectId: "project",
      revisionId: "revision",
      preparedResourceId: "prepared",
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
      assetId: "a".repeat(64),
      generation: "generation",
      view: "words",
    },
  };
  expect(operationSchema.safeParse(request).success).toBe(true);
  expect(
    operationSchema.safeParse({
      operation: "alignment.get",
      params: { ...request.params, projectId: undefined },
    }).success,
  ).toBe(false);
});
