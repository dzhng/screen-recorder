import { expect, test } from "vitest";
import { applyBatch, createCompiler, validateComposition } from "./index.js";

const document = {
  canvas: {
    width: 64,
    height: 64,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [{ id: "audio", kind: "audio", order: 0 }],
  groups: [],
  syncGroups: [],
  clips: [
    {
      id: "clip",
      trackId: "audio",
      source: { kind: "silence" },
      placement: { kind: "project", range: { startUs: 0, endUs: 4000000 } },
    },
  ],
  processing: [
    {
      target: { kind: "clip", id: "clip" },
      steps: [{ id: "noise", enabled: true, processor: { type: "rnnoise" } }],
    },
  ],
};
const edit = (doc: unknown, operations: unknown[], namespace = "state") =>
  applyBatch(doc, operations, { assets: [], namespace });
const domains = (
  doc: unknown,
  range = { startUs: 0, endUs: 4000000 },
  point: unknown = { kind: "processed" },
  target: unknown = { kind: "output" },
) =>
  createCompiler(validateComposition(doc, []), "revision").audioWindow({
    range,
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target, point },
  }).manifest.state?.domains ?? [];

test("pure splits share current state domains while matching independent clips do not", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const steps = split.document.processing.flatMap((s) => s.steps);
  expect(new Set(steps.map((s) => s.id)).size).toBe(2);
  expect(steps[0]!.stateKey).toBe(steps[1]!.stateKey);
  expect(domains(split.document)).toMatchObject([
    {
      sampleRange: { start: 0, end: 192000 },
      members: [{ clipId: "clip" }, { clipId: split.clipLineage[0]!.clipIds[1] }],
    },
  ]);
  const independent = {
    ...split.document,
    processing: split.document.processing.map((s) => ({
      ...s,
      steps: s.steps.map(({ stateKey: _key, ...step }) => step),
    })),
  };
  expect(domains(independent).map((d) => d.sampleRange)).toEqual([
    { start: 0, end: 96000 },
    { start: 96000, end: 192000 },
  ]);
});

test("current prefixes survive omitted membership metadata; dry taps add no state dependency", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const rightStep = split.document.processing.find(
    (s) => s.target.kind === "clip" && s.target.id === right,
  )!.steps[0]!;
  const changed = edit(
    split.document,
    [
      {
        operation: "processing.set",
        target: { kind: "clip", id: right },
        steps: [
          { processor: { type: "gain", gain: 2 } },
          { id: rightStep.id, processor: { type: "rnnoise" } },
        ],
      },
    ],
    "prefix",
  );
  const full = domains(changed.document);
  expect(full).toHaveLength(1);
  expect(
    createCompiler(validateComposition(changed.document, []), "revision")
      .audioWindow({
        range: { startUs: 0, endUs: 4000000 },
        rendition: { sampleRate: 48000, channels: 2 },
        tap: { target: { kind: "output" }, point: { kind: "processed" } },
      })
      .manifest.state!.inputs.find((i) => i.clip.id === right)!.steps[0],
  ).toMatchObject({ processor: { type: "gain", gain: 2 } });
  expect(
    domains(
      changed.document,
      { startUs: 3000000, endUs: 4000000 },
      { kind: "processed" },
      { kind: "clip", id: right },
    ),
  ).toEqual(full);
  expect(
    domains(
      changed.document,
      { startUs: 3000000, endUs: 4000000 },
      { kind: "dry" },
      { kind: "clip", id: right },
    ),
  ).toEqual([]);
});

test("moving the shared-token owner detaches it; resplitting cannot reconnect former siblings", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const withTrack = {
    ...split.document,
    tracks: [...split.document.tracks, { id: "other", kind: "audio", order: 1 }],
  };
  const moved = edit(
    withTrack,
    [
      {
        operation: "move",
        clipIds: [right],
        atUs: 0,
        scope: "selected",
        ripple: "none",
        tracks: [{ clipId: right, trackId: "other" }],
      },
    ],
    "move",
  );
  const rightStep = moved.document.processing.find(
    (s) => s.target.kind === "clip" && s.target.id === right,
  )!.steps[0]!;
  expect(rightStep.stateKey).toBeUndefined();
  expect(moved.normalized[0]!.changes).toContainEqual(
    expect.objectContaining({ kind: "processing", target: { kind: "clip", id: right } }),
  );
  const again = edit(
    moved.document,
    [{ operation: "split", clipIds: [right], atUs: 1000000, scope: "selected" }],
    "resplit",
  );
  expect(domains(again.document)).toHaveLength(2);
  const state = domains(again.document).find((d) => d.members.some((m) => m.clipId === right))!;
  expect(state.identity.id).not.toBe(rightStep.id);
  expect(state.members).toHaveLength(2);
});

test("trim derives current spans; one duplicate operation preserves copied membership independently", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const trimmed = edit(
    split.document,
    [
      {
        operation: "trim",
        clipId: "clip",
        range: { startUs: 1000000, endUs: 2000000 },
        scope: "selected",
        ripple: "none",
      },
    ],
    "trim",
  );
  expect(domains(trimmed.document)[0]!.sampleRange).toEqual({ start: 48000, end: 192000 });
  const copied = edit(
    split.document,
    [
      {
        operation: "duplicate",
        clipIds: ["clip", right],
        atUs: 4000000,
        scope: "selected",
        tracks: [],
      },
    ],
    "copy",
  );
  const copies = domains(copied.document, { startUs: 0, endUs: 8000000 });
  expect(copies.map((d) => d.sampleRange)).toEqual([
    { start: 0, end: 192000 },
    { start: 192000, end: 384000 },
  ]);
  expect(copies[1]!.identity).not.toEqual(copies[0]!.identity);
  const one = edit(
    split.document,
    [{ operation: "duplicate", clipIds: [right], atUs: 4000000, scope: "selected", tracks: [] }],
    "one-copy",
  );
  expect(domains(one.document, { startUs: 0, endUs: 6000000 })[1]!.identity.kind).toBe("instance");
});

test("whole shared groups move intact; root deletion needs no ancestor lookup", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const withTrack = {
    ...split.document,
    tracks: [...split.document.tracks, { id: "other", kind: "audio", order: 1 }],
  };
  const moved = edit(
    withTrack,
    [
      {
        operation: "move",
        clipIds: ["clip", right],
        atUs: 1000000,
        scope: "selected",
        ripple: "none",
        tracks: [
          { clipId: "clip", trackId: "other" },
          { clipId: right, trackId: "other" },
        ],
      },
    ],
    "all-move",
  );
  expect(domains(moved.document, { startUs: 0, endUs: 5000000 })).toHaveLength(1);
  expect(domains(moved.document, { startUs: 0, endUs: 5000000 })[0]!.identity).toEqual(
    domains(split.document)[0]!.identity,
  );
  const removed = edit(
    split.document,
    [{ operation: "remove", clipIds: [right], scope: "selected", ripple: "none" }],
    "remove-owner",
  );
  expect(domains(removed.document, { startUs: 0, endUs: 2000000 })[0]!.identity).toEqual(
    domains(split.document)[0]!.identity,
  );
  expect(domains(removed.document, { startUs: 0, endUs: 2000000 })[0]!.members).toHaveLength(1);
});

test("replacement silence is a current input member, not an asset lookup or state reset", () => {
  const assets = [
    {
      id: "short",
      streams: [
        {
          id: "sound",
          kind: "audio",
          bounds: { startUs: 0, endUs: 1000000 },
          available: [{ startUs: 0, endUs: 1000000 }],
        },
      ],
    },
  ];
  const replaced = applyBatch(
    document,
    [
      {
        operation: "replace",
        clipId: "clip",
        kind: "audio",
        media: {
          assetId: "short",
          streamId: "sound",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
        },
        fit: "silence",
      },
    ],
    { assets, namespace: "padding" },
  );
  const compiler = createCompiler(validateComposition(replaced.document, assets), "padding");
  const state = compiler.audioWindow({
    range: { startUs: 0, endUs: 4000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.domains).toHaveLength(1);
  expect(state.domains[0]!.sampleRange).toEqual({ start: 0, end: 192000 });
  expect(state.inputs.map((i) => i.clip.source.kind)).toEqual(["range", "silence"]);
});

test("shared-state order is a real dependency graph; edits repair cycles without detaching ordinary insertions", () => {
  const pair = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          { id: "a", enabled: true, processor: { type: "rnnoise" } },
          { id: "b", enabled: true, processor: { type: "rnnoise" } },
        ],
      },
    ],
  };
  const split = edit(pair, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const steps = split.document.processing.find(
    (s) => s.target.kind === "clip" && s.target.id === right,
  )!.steps;
  const set = (doc: unknown, next: unknown[], namespace: string) =>
    edit(
      doc,
      [{ operation: "processing.set", target: { kind: "clip", id: right }, steps: next }],
      namespace,
    );
  const inserted = set(
    split.document,
    [steps[0], { processor: { type: "rnnoise" } }, steps[1]],
    "insert-state",
  );
  expect(domains(inserted.document).filter((d) => d.members.length === 2)).toHaveLength(2);
  const removed = set(inserted.document, [steps[1]], "remove-state");
  expect(
    domains(removed.document).find((d) => d.identity.id === steps[1]!.stateKey)!.members,
  ).toHaveLength(2);
  const added = set(removed.document, [{ processor: { type: "rnnoise" } }, steps[1]], "add-state");
  expect(
    domains(added.document).find((d) => d.identity.id === steps[1]!.stateKey)!.members,
  ).toHaveLength(2);
  const cyclic = {
    ...split.document,
    processing: split.document.processing.map((s) =>
      s.target.kind === "clip" && s.target.id === right
        ? { ...s, steps: [steps[1]!, steps[0]!] }
        : s,
    ),
  };
  expect(() => validateComposition(cyclic, [])).toThrow("State domain dependency cycle");
  const reordered = set(split.document, [steps[1], steps[0]], "reorder-state");
  expect(
    reordered.document.processing
      .find((s) => s.target.kind === "clip" && s.target.id === right)!
      .steps.every((s) => s.stateKey === undefined),
  ).toBe(true);
  expect(domains(reordered.document)).toHaveLength(4);
  const bypassed = set(split.document, [steps[1], { ...steps[0], enabled: false }], "bypass-state");
  expect(domains(bypassed.document)).toHaveLength(2);
  const reenabled = set(bypassed.document, [steps[1], steps[0]], "reenable-state");
  expect(domains(reenabled.document)).toHaveLength(4);
});

test("membership is preserve-only metadata and live tokens reserve removed step identities", () => {
  expect(() =>
    edit(document, [
      {
        operation: "processing.set",
        target: { kind: "clip", id: "clip" },
        steps: [{ processor: { type: "rnnoise" }, stateKey: "invented" }],
      },
    ]),
  ).toThrow("continuity metadata");
  const retained = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          {
            id: "noise",
            enabled: true,
            stateKey: "processingStep:collision:0",
            processor: { type: "rnnoise" },
          },
        ],
      },
    ],
  };
  expect(() =>
    edit(
      retained,
      [
        {
          operation: "processing.set",
          target: { kind: "clip", id: "clip" },
          steps: [{ processor: { type: "rnnoise" } }],
        },
      ],
      "collision",
    ),
  ).toThrow("Identity namespace collides");
  const converted = edit(
    retained,
    [
      {
        operation: "processing.set",
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "noise", processor: { type: "gain", gain: 1 } }],
      },
    ],
    "convert",
  );
  expect(converted.document.processing[0]!.steps[0]!.stateKey).toBeUndefined();
  expect(domains(converted.document)).toEqual([]);
});

test("fractional splits, zero-sample spans and unavailable support retain exact current input metadata", () => {
  const fractional = {
    ...document,
    clips: [
      {
        ...document.clips[0]!,
        placement: {
          kind: "project",
          range: {
            startUs: { numerator: 1, denominator: 3 },
            endUs: { numerator: 12000001, denominator: 3 },
          },
        },
      },
    ],
  };
  const split = edit(
    fractional,
    [{ operation: "split", clipIds: ["clip"], atUs: 1, scope: "selected" }],
    "fractional",
  );
  expect(domains(split.document)[0]!.members).toHaveLength(2);
  expect(domains(split.document)[0]!.sampleRange).toEqual({ start: 0, end: 192000 });
  const source = {
    ...document,
    clips: [
      {
        id: "clip",
        trackId: "audio",
        assetId: "recording",
        streamId: "sound",
        source: { kind: "range", range: { startUs: 0, endUs: 4000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 4000000 } },
      },
    ],
  };
  const assets = [
    {
      id: "recording",
      streams: [
        {
          id: "sound",
          kind: "audio",
          bounds: { startUs: 0, endUs: 4000000 },
          available: [
            { startUs: 0, endUs: 1000000 },
            { startUs: 2000000, endUs: 4000000 },
          ],
        },
      ],
    },
  ];
  const window = createCompiler(validateComposition(source, assets), "holes").audioWindow({
    range: { startUs: 3000000, endUs: 4000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  expect(window.manifest.state!.inputs[0]!.available).toEqual(assets[0]!.streams[0]!.available);
  expect(window.manifest.state!.domains[0]!.range).toEqual({ startUs: 0, endUs: 4000000 });
});

test("dependencies distinguish disconnected domains of the same shared key", () => {
  const clips = [0, 1, 2].map((i) => ({
    id: `c${i}`,
    trackId: "audio",
    source: { kind: "silence" },
    placement: { kind: "project", range: { startUs: i * 1000000, endUs: (i + 1) * 1000000 } },
  }));
  const a = (i: number) => ({
    id: `a${i}`,
    stateKey: "A",
    enabled: i !== 1,
    processor: { type: "rnnoise" },
  });
  const b = (i: number) => ({
    id: `b${i}`,
    stateKey: "B",
    enabled: true,
    processor: { type: "rnnoise" },
  });
  const input = {
    ...document,
    clips,
    processing: clips.map((clip, i) => ({
      target: { kind: "clip", id: clip.id },
      steps: i === 2 ? [b(i), a(i)] : [a(i), b(i)],
    })),
  };
  const plan = domains(input, { startUs: 0, endUs: 3000000 });
  expect(plan).toHaveLength(3);
  expect(
    plan.find((d) => d.identity.id === "B")!.dependencies.map((i) => plan[i]!.sampleRange),
  ).toEqual([{ start: 0, end: 48000 }]);
  expect(
    plan
      .find((d) => d.identity.id === "A" && d.sampleRange.start === 96000)!
      .dependencies.map((i) => plan[i]!.identity.id),
  ).toEqual(["B"]);
  const activated = edit(
    input,
    [
      {
        operation: "processing.set",
        target: { kind: "clip", id: "c1" },
        steps: [{ ...a(1), enabled: true }, b(1)],
      },
    ],
    "join-domain",
  );
  expect(
    activated.document.processing
      .find((s) => s.target.kind === "clip" && s.target.id === "c1")!
      .steps.every((s) => s.stateKey === undefined),
  ).toBe(true);
  expect(domains(activated.document, { startUs: 0, endUs: 3000000 })).toHaveLength(6);
});

test("state plans omit downstream changes and stateless manifests retain their original shape", () => {
  const window = (doc: unknown) =>
    createCompiler(validateComposition(doc, []), "revision").audioWindow({
      range: { startUs: 0, endUs: 4000000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    }).manifest;
  const changed = edit(
    document,
    [
      {
        operation: "processing.set",
        target: { kind: "clip", id: "clip" },
        steps: [
          { id: "noise", processor: { type: "rnnoise" } },
          { processor: { type: "gain", gain: 0.25 } },
        ],
      },
    ],
    "suffix",
  );
  expect(window(changed.document).state).toEqual(window(document).state);
  expect(window({ ...document, processing: [] })).not.toHaveProperty("state");
});

test("one multi-target move repairs both membership conflicts and newly connected dependency cycles", () => {
  const clip = (id: string, trackId: string, startUs: number, endUs: number) => ({
    id,
    trackId,
    source: { kind: "silence" },
    placement: { kind: "project", range: { startUs, endUs } },
  });
  const step = (id: string, stateKey: string) => ({
    id,
    stateKey,
    enabled: true,
    processor: { type: "rnnoise" },
  });
  const input = {
    ...document,
    tracks: ["audio", "x", "destination"].map((id, order) => ({ id, kind: "audio", order })),
    clips: [
      clip("c0", "audio", 0, 1000000),
      clip("c2", "audio", 2000000, 3000000),
      clip("d0", "x", 0, 1000000),
      clip("d2", "x", 2000000, 3000000),
    ],
    processing: [
      { target: { kind: "clip", id: "c0" }, steps: [step("a0", "A"), step("b0", "B")] },
      { target: { kind: "clip", id: "c2" }, steps: [step("b2", "B"), step("a2", "A")] },
      { target: { kind: "clip", id: "d0" }, steps: [step("x0", "X")] },
      { target: { kind: "clip", id: "d2" }, steps: [step("x2", "X")] },
    ],
  };
  const moved = edit(
    input,
    [
      {
        operation: "move",
        clipIds: ["c2", "d2"],
        atUs: 1000000,
        scope: "selected",
        ripple: "none",
        tracks: [{ clipId: "d2", trackId: "destination" }],
      },
    ],
    "combined",
  );
  for (const id of ["c2", "d2"])
    expect(
      moved.document.processing
        .find((s) => s.target.kind === "clip" && s.target.id === id)!
        .steps.every((s) => s.stateKey === undefined),
    ).toBe(true);
  for (const id of ["c0", "d0"])
    expect(
      moved.document.processing.find((s) => s.target.kind === "clip" && s.target.id === id),
    ).toEqual(input.processing.find((s) => s.target.id === id));
  expect(
    moved.normalized[0]!.changes.filter((c) => c.kind === "processing").map((c) => c.target),
  ).toEqual([
    { kind: "clip", id: "c2" },
    { kind: "clip", id: "d2" },
  ]);
});
