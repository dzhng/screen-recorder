import { sampleScalarSamples } from "./scalar-program.js";
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
      members: [
        { target: { kind: "clip", id: "clip" } },
        { target: { kind: "clip", id: split.clipLineage[0]!.clipIds[1] } },
      ],
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
      .manifest.state!.nodes.find((i) => i.target.kind === "clip" && i.target.id === right)!
      .steps[0],
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
  const state = domains(again.document).find((d) =>
    d.members.some((m) => m.target.kind === "clip" && m.target.id === right),
  )!;
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
  const windowed = {
    ...source,
    processing: [
      {
        ...source.processing[0],
        steps: [
          {
            ...source.processing[0]!.steps[0],
            window: {
              kind: "content",
              clipId: "clip",
              sourceRange: { startUs: 500000, endUs: 3500000 },
            },
          },
        ],
      },
    ],
  };
  const selected = createCompiler(
    validateComposition(windowed, assets),
    "window-holes",
  ).audioWindow({
    range: { startUs: 1500000, endUs: 1800000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(selected.domains.map((d) => d.range)).toEqual([{ startUs: 500000, endUs: 3500000 }]);
  expect(selected.inputs[0]!.available).toEqual(assets[0]!.streams[0]!.available);
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

test("parent state includes internal audio gaps and stateless prefixes, excluding video extent", () => {
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "video", kind: "video", order: 1 }],
    clips: [
      {
        ...document.clips[0],
        id: "a",
        placement: { kind: "project", range: { startUs: 1000000, endUs: 2000000 } },
      },
      {
        ...document.clips[0],
        id: "b",
        placement: { kind: "project", range: { startUs: 3000000, endUs: 4000000 } },
      },
      {
        id: "picture",
        trackId: "video",
        assetId: "image",
        streamId: "still",
        source: { kind: "hold", atUs: 0 },
        placement: { kind: "project", range: { startUs: 0, endUs: 9000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "a" },
        steps: [{ id: "gain", enabled: true, processor: { type: "gain", gain: 0.25 } }],
      },
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "parent", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  const state = createCompiler(
    validateComposition(doc, [
      { id: "image", streams: [{ id: "still", kind: "image", width: 64, height: 64 }] },
    ]),
    "revision",
  ).audioWindow({
    range: { startUs: 2000000, endUs: 3000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.domains).toMatchObject([
    {
      range: { startUs: 1000000, endUs: 4000000 },
      members: [{ target: { kind: "track", id: "audio" } }],
    },
  ]);
  expect(state.inputs.map((i) => i.clip.id)).toEqual(["a", "b"]);
});

test("windows select authored components and close prerequisites at their own prefixes", () => {
  const doc = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          { id: "upstream", enabled: true, processor: { type: "rnnoise" } },
          {
            id: "downstream",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
          },
          { id: "suffix", enabled: true, processor: { type: "gain", gain: 3 } },
        ],
      },
    ],
  };
  const plan = domains(doc, { startUs: 2500000, endUs: 2600000 });
  expect(plan.map((d) => [d.identity.id, d.range, d.dependencies])).toEqual([
    ["upstream", { startUs: 0, endUs: 4000000 }, []],
    ["downstream", { startUs: 2000000, endUs: 3000000 }, [0]],
  ]);
  expect(domains(doc, { startUs: 3000000, endUs: 4000000 }).map((d) => d.identity.id)).toEqual([
    "upstream",
  ]);
  expect(
    domains(
      doc,
      { startUs: 2500000, endUs: 2600000 },
      { kind: "after-step", stepId: "upstream" },
      { kind: "clip", id: "clip" },
    ).map((d) => d.identity.id),
  ).toEqual(["upstream"]);
  const onlyWindow = {
    ...doc,
    processing: [{ ...doc.processing[0], steps: doc.processing[0]!.steps.slice(1, 2) }],
  };
  expect(domains(onlyWindow, { startUs: 3000000, endUs: 4000000 })).toEqual([]);
});

test("normalized windows retain their authored clock across split, trim and inactive members", () => {
  const doc = {
    ...document,
    processing: [
      {
        ...document.processing[0],
        steps: [
          {
            ...document.processing[0]!.steps[0],
            window: {
              kind: "clip",
              clipId: "clip",
              start: { numerator: 1, denominator: 4 },
              end: { numerator: 3, denominator: 4 },
            },
          },
        ],
      },
    ],
  };
  const split = edit(doc, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  expect(domains(split.document).map((d) => d.range)).toEqual([
    { startUs: 1000000, endUs: 3000000 },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const cut = edit(
    split.document,
    [{ operation: "split", clipIds: [right], atUs: 3000000, scope: "selected" }],
    "window-cut",
  );
  expect(domains(cut.document).map((d) => d.range)).toEqual([{ startUs: 1000000, endUs: 3000000 }]);
  expect(domains(cut.document, { startUs: 3000000, endUs: 4000000 })).toEqual([]);
  const trimmed = edit(
    doc,
    [
      {
        operation: "trim",
        clipId: "clip",
        range: { startUs: 1500000, endUs: 4000000 },
        scope: "selected",
        ripple: "none",
      },
    ],
    "window-trim",
  );
  expect(domains(trimmed.document).map((d) => d.range)).toEqual([
    { startUs: 1500000, endUs: 3000000 },
  ]);
});

test("nested parent windows select interval-relevant child domains and retain stateless child output", () => {
  const doc = {
    ...document,
    tracks: [{ ...document.tracks[0], parentId: "group" }],
    groups: [{ id: "group", kind: "audio", order: 0 }],
    clips: [
      {
        ...document.clips[0],
        id: "a",
        placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
      {
        ...document.clips[0],
        id: "b",
        placement: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "a" },
        steps: [{ id: "early", enabled: true, processor: { type: "rnnoise" } }],
      },
      {
        target: { kind: "clip", id: "b" },
        steps: [
          { id: "late", enabled: true, processor: { type: "rnnoise" } },
          { id: "gain", enabled: true, processor: { type: "gain", gain: 2 } },
        ],
      },
      {
        target: { kind: "group", id: "group" },
        steps: [
          {
            id: "parent",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
          },
        ],
      },
      {
        target: { kind: "output" },
        steps: [
          {
            id: "master",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 2500000, endUs: 3000000 } },
          },
        ],
      },
    ],
  };
  const state = createCompiler(validateComposition(doc, []), "nested").audioWindow({
    range: { startUs: 2700000, endUs: 2800000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.domains.map((d) => d.identity.id)).toEqual(["late", "parent", "master"]);
  expect(
    state.domains
      .find((d) => d.identity.id === "parent")!
      .dependencies.map((i) => state.domains[i]!.identity.id),
  ).toEqual(["late"]);
  expect(state.inputs.map((i) => i.clip.id)).toEqual(["b"]);
  expect(
    state.nodes
      .find((n) => n.target.kind === "clip" && n.target.id === "b")!
      .steps.map((s) => s.id),
  ).toEqual(["late", "gain"]);
  expect(
    domains(doc, { startUs: 2700000, endUs: 2800000 }, { kind: "dry" }, { kind: "output" }).map(
      (d) => d.identity.id,
    ),
  ).toEqual(["late", "parent"]);
  expect(() =>
    validateComposition(
      {
        ...doc,
        processing: [
          {
            target: { kind: "output" },
            steps: [
              { id: "invalid", enabled: false, stateKey: "shared", processor: { type: "rnnoise" } },
            ],
          },
        ],
      },
      [],
    ),
  ).toThrow(/clip/);
});

test("empty parents have no state and positive zero-sample spans still select structural state", () => {
  const parent = {
    ...document,
    processing: [
      {
        target: { kind: "output" },
        steps: [{ id: "parent", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  expect(domains({ ...parent, clips: [] })).toEqual([]);
  const short = {
    ...parent,
    clips: [
      { ...document.clips[0], placement: { kind: "project", range: { startUs: 0, endUs: 1 } } },
    ],
  };
  expect(domains(short, { startUs: 0, endUs: 1 })).toMatchObject([
    { range: { startUs: 0, endUs: 1 }, sampleRange: { start: 0, end: 0 } },
  ]);
});

test("returned state metadata cannot mutate the compiler's immutable-revision plan", () => {
  const compiler = createCompiler(validateComposition(document, []), "revision");
  const request = {
    range: { startUs: 0, endUs: 1000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  };
  const first = compiler.audioWindow(request),
    expected = structuredClone(first.manifest.state);
  first.manifest.state!.domains[0]!.members.length = 0;
  expect(compiler.audioWindow(request).manifest.state).toEqual(expected);
});

test("out-of-range state input prefixes retain enabled stateless execution requirements", () => {
  const split = edit(document, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const prior = split.document.processing.find(
    (s) => s.target.kind === "clip" && s.target.id === right,
  )!.steps;
  const changed = edit(
    split.document,
    [
      {
        operation: "processing.set",
        target: { kind: "clip", id: right },
        steps: [{ processor: { type: "gain", gain: 2 } }, ...prior],
      },
    ],
    "requirements",
  );
  const manifest = createCompiler(
    validateComposition(changed.document, []),
    "revision",
  ).audioWindow({
    range: { startUs: 0, endUs: 1000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "clip", id: "clip" }, point: { kind: "processed" } },
  }).manifest;
  expect(manifest.requirements).toContainEqual(
    expect.objectContaining({
      kind: "processor",
      target: { kind: "clip", id: right },
      processor: { type: "gain", gain: 2 },
      implementationId: null,
    }),
  );
});

test("selected state inputs retain exact consumed spans and distinguish unavailable support", () => {
  const source = {
    ...document,
    clips: [
      {
        id: "clip",
        trackId: "audio",
        assetId: "source",
        streamId: "sound",
        source: { kind: "range", range: { startUs: 0, endUs: 4000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 4000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          {
            id: "noise",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 1000000, endUs: 3000000 } },
          },
        ],
      },
    ],
  };
  const assets = [
    {
      id: "source",
      streams: [
        {
          id: "sound",
          kind: "audio",
          bounds: { startUs: 0, endUs: 4000000 },
          available: [
            { startUs: 0, endUs: 1500000 },
            { startUs: 2000000, endUs: 4000000 },
          ],
        },
      ],
    },
  ];
  const input = createCompiler(validateComposition(source, assets), "revision").audioWindow({
    range: { startUs: 2500000, endUs: 2800000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!.inputs[0]!;
  expect(input).toMatchObject({
    selected: [{ startUs: 1000000, endUs: 3000000 }],
    unavailable: [{ startUs: 1500000, endUs: 2000000 }],
  });
});

test("disconnected state windows do not consume the source hole between components", () => {
  const source = {
    ...document,
    clips: [
      {
        id: "clip",
        trackId: "audio",
        assetId: "asset",
        streamId: "sound",
        source: { kind: "range", range: { startUs: 0, endUs: 4000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 4000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          {
            id: "a",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 0, endUs: 500000 } },
          },
          {
            id: "b",
            enabled: true,
            processor: { type: "rnnoise" },
            window: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
          },
        ],
      },
    ],
  };
  const assets = [
    {
      id: "asset",
      streams: [
        {
          id: "sound",
          kind: "audio",
          channels: 1,
          sampleRate: 44100,
          bounds: { startUs: 0, endUs: 4000000 },
          available: [
            { startUs: 0, endUs: 500000 },
            { startUs: 2000000, endUs: 4000000 },
          ],
        },
      ],
    },
  ];
  const state = createCompiler(validateComposition(source, assets), "revision").audioWindow({
    range: { startUs: 0, endUs: 4000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.inputs[0]).toMatchObject({
    channels: 1,
    sampleRate: 44100,
    selected: [
      { startUs: 0, endUs: 500000 },
      { startUs: 2000000, endUs: 3000000 },
    ],
    unavailable: [],
  });
  expect(state.domains.map((d) => d.dependencies)).toEqual([[], []]);
});

test("out-of-range retimed state inputs keep their existing preparation requirement", () => {
  const source = {
    ...document,
    clips: [
      {
        id: "fast",
        trackId: "audio",
        assetId: "asset",
        streamId: "sound",
        source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
        placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
      {
        id: "plain",
        trackId: "audio",
        assetId: "asset",
        streamId: "sound",
        source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
        placement: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "parent", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  const assets = [
    {
      id: "asset",
      streams: [
        {
          id: "sound",
          kind: "audio",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
  ];
  const manifest = createCompiler(validateComposition(source, assets), "revision").audioWindow({
    range: { startUs: 2000000, endUs: 3000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest;
  expect(manifest.requirements).toContainEqual({
    kind: "retime",
    clipId: "fast",
    sampleCount: 48000,
    pitch: "preserve",
    implementationId: null,
  });
});

test("a gap-only state request retains downstream routing and gain after its active parent", () => {
  const doc = {
    ...document,
    tracks: [{ ...document.tracks[0], parentId: "bus" }],
    groups: [{ id: "bus", kind: "audio", order: 0 }],
    clips: [
      {
        ...document.clips[0],
        placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
      {
        ...document.clips[0],
        id: "late",
        placement: { kind: "project", range: { startUs: 2000000, endUs: 3000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "noise", enabled: true, processor: { type: "rnnoise" } }],
      },
      {
        target: { kind: "group", id: "bus" },
        steps: [{ id: "downstream", enabled: true, processor: { type: "gain", gain: 3 } }],
      },
    ],
  };
  const plan = createCompiler(validateComposition(doc, []), "gap").audioWindow({
    range: { startUs: 1000000, endUs: 2000000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  expect(plan.manifest.processing.map((n) => n.target)).toEqual([
    { kind: "track", id: "audio" },
    { kind: "group", id: "bus" },
    { kind: "output" },
  ]);
  expect(plan.manifest.processing[1]!.steps[0]).toMatchObject({
    id: "downstream",
    processor: { type: "gain", gain: 3 },
  });
});

test("mix clocks restrict through splits without fragmenting learned continuity", () => {
  const mix = {
    keys: [
      { at: { numerator: 0, denominator: 1 }, value: 0, interpolation: "hold" },
      { at: { numerator: 1, denominator: 2 }, value: 0, interpolation: "linear" },
      { at: { numerator: 1, denominator: 1 }, value: 1, interpolation: "hold" },
    ],
  };
  const authored = edit(document, [
    {
      operation: "processing.set",
      target: { kind: "clip", id: "clip" },
      steps: [{ id: "noise", processor: { type: "rnnoise", mix } }],
    },
  ]).document;
  const compile = (doc: unknown) =>
    createCompiler(validateComposition(doc, []), "revision").audioWindow({
      range: { startUs: 0, endUs: 4000000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
  const original = compile(authored);
  const split = edit(authored, [
    { operation: "split", clipIds: ["clip"], atUs: 1000000, scope: "selected" },
  ]).document;
  const sliced = compile(split);
  expect(sliced.manifest.state!.domains).toHaveLength(1);
  expect(sliced.manifest.state!.domains[0]!.sampleRange).toEqual({ start: 0, end: 192000 });
  const originalMix = original
    .processing()
    .flatMap((n) => n.steps)
    .find((s) => s.processor.type === "rnnoise")!.processor;
  expect(originalMix.type).toBe("rnnoise");
  if (originalMix.type !== "rnnoise" || typeof originalMix.mix !== "object")
    throw Error("Missing original program");
  for (const step of sliced.processing().flatMap((n) => n.steps)) {
    if (step.processor.type !== "rnnoise" || typeof step.processor.mix !== "object") continue;
    for (const range of step.processor.active) {
      for (const at of [range.start, Math.floor((range.start + range.end) / 2), range.end - 1])
        expect(sampleScalarSamples(step.processor.mix, at)).toBe(
          sampleScalarSamples(originalMix.mix, at),
        );
    }
  }
  const zero = edit(authored, [
    {
      operation: "processing.set",
      target: { kind: "clip", id: "clip" },
      steps: [{ id: "noise", processor: { type: "rnnoise", mix: 0 } }],
    },
  ]).document;
  expect(domains(zero)).toEqual(domains(authored));
  expect(compile(zero).manifest).not.toEqual(original.manifest);
});

test("mixed stateful audio stacks retain complete ordered domain recipes for an excerpt", () => {
  const limiter = {
    type: "limiter",
    ceilingDbfs: -3,
    lookaheadMs: 5,
    releaseMs: 50,
  };
  const doc = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "01-clean", enabled: true, processor: { type: "rnnoise" } }],
      },
      {
        target: { kind: "track", id: "audio" },
        steps: [
          { id: "gain", enabled: true, processor: { type: "gain", gain: 0.5 } },
          { id: "02-limit", enabled: true, processor: limiter },
        ],
      },
      {
        target: { kind: "output" },
        steps: [{ id: "03-clean", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  const state = createCompiler(validateComposition(doc, []), "mixed-revision").audioWindow({
    range: { startUs: 1000000, endUs: 1100000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.domains).toMatchObject([
    {
      recipe: { type: "rnnoise" },
      sampleRange: { start: 0, end: 192000 },
      dependencies: [],
      members: [{ stepId: "01-clean" }],
    },
    {
      recipe: limiter,
      sampleRange: { start: 0, end: 192000 },
      dependencies: [0],
      members: [{ stepId: "02-limit" }],
    },
    {
      recipe: { type: "rnnoise" },
      sampleRange: { start: 0, end: 192000 },
      dependencies: [0, 1],
      members: [{ stepId: "03-clean" }],
    },
  ]);
  expect(state.nodes.find((node) => node.target.kind === "track")!.steps).toMatchObject([
    { id: "gain", processor: { gain: 0.5 } },
    { id: "02-limit", processor: limiter },
  ]);
});

test("split limiter members preserve whole-domain preparation through a processing roundtrip", () => {
  const limiter = { type: "limiter", ceilingDbfs: -6, lookaheadMs: 3, releaseMs: 60 };
  const initial = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "limit", enabled: true, processor: limiter }],
      },
    ],
  };
  const split = edit(initial, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const stack = split.document.processing.find(
    (node) => node.target.kind === "clip" && node.target.id === right,
  )!;
  const roundtrip = edit(split.document, [
    { operation: "processing.set", target: stack.target, steps: stack.steps },
  ]);
  const current = domains(roundtrip.document, { startUs: 3000000, endUs: 3100000 });
  expect(current).toMatchObject([
    {
      recipe: limiter,
      sampleRange: { start: 0, end: 192000 },
      members: [{ target: { kind: "clip", id: "clip" } }, { target: { kind: "clip", id: right } }],
    },
  ]);
  expect(current).toHaveLength(1);
});

test("changing one split limiter recipe detaches its state instead of retaining another member's parameters", () => {
  const limiter = { type: "limiter", ceilingDbfs: -6, lookaheadMs: 3, releaseMs: 60 };
  const initial = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "limit", enabled: true, processor: limiter }],
      },
    ],
  };
  const split = edit(initial, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const stack = split.document.processing.find(
    (node) => node.target.kind === "clip" && node.target.id === right,
  )!;
  const changed = edit(split.document, [
    {
      operation: "processing.set",
      target: stack.target,
      steps: [{ ...stack.steps[0]!, processor: { ...limiter, releaseMs: 75 } }],
    },
  ]);
  expect(domains(changed.document)).toMatchObject([
    {
      recipe: limiter,
      sampleRange: { start: 0, end: 96000 },
      members: [{ target: { kind: "clip", id: "clip" } }],
    },
    {
      recipe: { ...limiter, releaseMs: 75 },
      sampleRange: { start: 96000, end: 192000 },
      members: [{ target: { kind: "clip", id: right } }],
    },
  ]);
  expect(domains(changed.document)).toHaveLength(2);
  expect(() =>
    validateComposition(
      {
        ...split.document,
        processing: changed.document.processing.map((node) => ({
          ...node,
          steps: node.steps.map((step) => ({ ...step, stateKey: "invalid-shared" })),
        })),
      },
      [],
    ),
  ).toThrow("Shared state requires one processor recipe");
});

test("a processed detector tap contributes its own upstream state and cycles refuse", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 6,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "track", id: "detector-track" }, point: { kind: "processed" } },
    },
  };
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "detector-track", kind: "audio", order: 1 }],
    clips: [
      ...document.clips,
      { ...document.clips[0]!, id: "detector-clip", trackId: "detector-track" },
    ],
    processing: [
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "02-compress", enabled: true, processor: compressor }],
      },
      {
        target: { kind: "track", id: "detector-track" },
        steps: [{ id: "01-detector", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  const state = createCompiler(validateComposition(doc, []), "sidechain").audioWindow({
    range: { startUs: 2000000, endUs: 2100000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "track", id: "audio" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(state.domains).toMatchObject([
    { recipe: { type: "rnnoise" }, dependencies: [], members: [{ stepId: "01-detector" }] },
    { recipe: compressor, dependencies: [0], members: [{ stepId: "02-compress" }] },
  ]);
  expect(state.inputs.map((input) => [input.clip.id, input.selected])).toEqual([
    ["clip", [{ startUs: 0, endUs: 4000000 }]],
    ["detector-clip", [{ startUs: 0, endUs: 4000000 }]],
  ]);
  const cyclic = {
    ...doc,
    processing: [
      doc.processing[0]!,
      {
        ...doc.processing[1]!,
        steps: [
          {
            id: "01-detector",
            enabled: true,
            processor: {
              ...compressor,
              detector: {
                ...compressor.detector,
                tap: { ...compressor.detector.tap, target: { kind: "track", id: "audio" } },
              },
            },
          },
        ],
      },
    ],
  };
  expect(() => validateComposition(cyclic, [])).toThrow("State domain dependency cycle");
});

test("dry self detector taps stop before the compressor and empty detector targets remain explicit", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "track", id: "audio" }, point: { kind: "dry" } },
    },
  };
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "empty", kind: "audio", order: 1 }],
    processing: [
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "compress", enabled: true, processor: compressor }],
      },
    ],
  };
  expect(domains(doc)).toMatchObject([{ recipe: compressor, dependencies: [] }]);
  const empty = {
    ...doc,
    processing: [
      {
        ...doc.processing[0]!,
        steps: [
          {
            ...doc.processing[0]!.steps[0]!,
            processor: {
              ...compressor,
              detector: {
                kind: "tap",
                tap: { target: { kind: "track", id: "empty" }, point: { kind: "processed" } },
              },
            },
          },
        ],
      },
    ],
  };
  const state = createCompiler(validateComposition(empty, []), "empty-detector").audioWindow({
    range: { startUs: 2000000, endUs: 2100000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "track", id: "audio" }, point: { kind: "processed" } },
  }).manifest.state!;
  expect(
    state.nodes.find((node) => node.target.kind === "track" && node.target.id === "empty"),
  ).toMatchObject({
    target: { kind: "track", id: "empty" },
    inputs: [],
    steps: [],
    range: { startUs: 0, endUs: 4000000 },
  });
  expect(state.inputs.map((input) => input.clip.id)).toEqual(["clip"]);
});

test("native lowering preserves static normalization recipes and absolute state spans", () => {
  const recipe = {
    type: "normalization",
    mode: "gain-only",
    targetIntegratedLufs: -20,
    truePeakCeilingDbtp: -2,
    maxLoudnessRangeLu: 7,
  };
  const doc = {
    ...document,
    processing: [
      {
        target: { kind: "output" },
        steps: [{ id: "normalize", enabled: true, processor: recipe }],
      },
    ],
  };
  const window = createCompiler(validateComposition(doc, []), "normalize").audioWindow({
    range: { startUs: 3000000, endUs: 3100000 },
    rendition: { sampleRate: 48000, channels: 2 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
  });
  expect(window.audioState()!.domains).toEqual([
    {
      recipe,
      sampleRange: { start: 0, end: 192000 },
      dependencies: [],
      members: [
        { target: { kind: "output" }, stepId: "normalize", sampleRange: { start: 0, end: 192000 } },
      ],
    },
  ]);
  expect(window.processing().at(-1)!.steps).toEqual([
    {
      id: "normalize",
      enabled: true,
      processor: { ...recipe, active: [{ start: 0, end: 192000 }] },
    },
  ]);
});

test("detector taps after output video steps retain preceding audio and refuse self cycles", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "output" }, point: { kind: "after-step", stepId: "visual" } },
    },
  };
  const cyclic = {
    ...document,
    processing: [
      {
        target: { kind: "output" },
        steps: [
          { id: "compress", enabled: true, processor: compressor },
          { id: "visual", enabled: true, processor: { type: "opacity", opacity: 0.5 } },
        ],
      },
    ],
  };
  expect(() => validateComposition(cyclic, [])).toThrow("State domain dependency cycle");
  const valid = {
    ...cyclic,
    processing: [
      {
        ...cyclic.processing[0]!,
        steps: [
          { id: "clean", enabled: true, processor: { type: "rnnoise" } },
          cyclic.processing[0]!.steps[1]!,
          cyclic.processing[0]!.steps[0]!,
        ],
      },
    ],
  };
  expect(domains(valid)).toMatchObject([
    { recipe: { type: "rnnoise" }, dependencies: [] },
    {
      recipe: compressor,
      dependencies: [0],
      members: [{ detector: { target: { kind: "output" }, beforeStepIndex: 1 } }],
    },
  ]);
});

test("bypassed and empty detector targets do not expand the program's state envelope", () => {
  const base = {
    ...document,
    tracks: [...document.tracks, { id: "empty", kind: "audio", order: 1 }],
    clips: [
      {
        ...document.clips[0]!,
        placement: { kind: "project", range: { startUs: 1000000, endUs: 4000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "output" },
        steps: [{ id: "clean", enabled: true, processor: { type: "rnnoise" } }],
      },
    ],
  };
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "track", id: "empty" }, point: { kind: "processed" } },
    },
  };
  const bypassed = {
    ...base,
    processing: [
      ...base.processing,
      {
        target: { kind: "track", id: "audio" },
        steps: [{ id: "compress", enabled: false, processor: compressor }],
      },
    ],
  };
  expect(domains(bypassed)).toEqual(domains(base));
  const active = {
    ...bypassed,
    processing: [
      bypassed.processing[0]!,
      {
        ...bypassed.processing[1]!,
        steps: [{ id: "compress", enabled: true, processor: compressor }],
      },
    ],
  };
  expect(domains(active).map((domain) => domain.sampleRange)).toEqual([
    { start: 48000, end: 192000 },
    { start: 48000, end: 192000 },
  ]);
});

test("disjoint clip detector taps refuse rather than compiling an unresolved endpoint", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "clip", id: "detector" }, point: { kind: "dry" } },
    },
  };
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "other", kind: "audio", order: 1 }],
    clips: [
      ...document.clips,
      {
        ...document.clips[0]!,
        id: "detector",
        trackId: "other",
        placement: { kind: "project", range: { startUs: 5000000, endUs: 6000000 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "compress", enabled: true, processor: compressor }],
      },
    ],
  };
  expect(() => validateComposition(doc, [])).toThrow(
    "Detector clip tap has no samples in the state domain",
  );
});

test("splitting a self-detector compressor preserves the detector schedule across both members", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "clip", id: "clip" }, point: { kind: "after-step", stepId: "gain" } },
    },
  };
  const doc = {
    ...document,
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [
          { id: "gain", enabled: true, processor: { type: "gain", gain: 2 } },
          { id: "compress", enabled: true, processor: compressor },
        ],
      },
    ],
  };
  const split = edit(doc, [
    { operation: "split", clipIds: ["clip"], atUs: 2000000, scope: "selected" },
  ]);
  const right = split.clipLineage[0]!.clipIds[1]!;
  const rightSteps = split.document.processing.find(
    (stack) => stack.target.kind === "clip" && stack.target.id === right,
  )!.steps;
  expect(rightSteps[1]!.processor).toMatchObject({
    detector: {
      kind: "tap",
      tap: {
        target: { kind: "clip", id: right },
        point: { kind: "after-step", stepId: rightSteps[0]!.id },
      },
    },
  });
  expect(domains(split.document)).toEqual([
    {
      identity: { kind: "shared", id: rightSteps[1]!.id },
      recipe: { ...compressor, detector: { kind: "member", beforeStepIndex: 1 } },
      range: { startUs: 0, endUs: 4000000 },
      sampleRange: { start: 0, end: 192000 },
      dependencies: [],
      members: [
        {
          target: { kind: "clip", id: "clip" },
          stepId: "compress",
          range: { startUs: 0, endUs: 2000000 },
          detector: { target: { kind: "clip", id: "clip" }, beforeStepIndex: 1 },
        },
        {
          target: { kind: "clip", id: right },
          stepId: rightSteps[1]!.id,
          range: { startUs: 2000000, endUs: 4000000 },
          detector: { target: { kind: "clip", id: right }, beforeStepIndex: 1 },
        },
      ],
    },
  ]);
});

test("externally referenced clip detectors refuse partition until the caller selects a stable track tap", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "clip", id: "detector" }, point: { kind: "dry" } },
    },
  };
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "detector-track", kind: "audio", order: 1 }],
    clips: [
      ...document.clips,
      { ...document.clips[0]!, id: "detector", trackId: "detector-track" },
    ],
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "compress", enabled: true, processor: compressor }],
      },
    ],
  };
  const before = domains(doc);
  expect(() =>
    edit(doc, [{ operation: "split", clipIds: ["detector"], atUs: 2000000, scope: "selected" }]),
  ).toThrow("Select a stable track or group detector tap before partitioning its clip");
  expect(domains(doc)).toEqual(before);
  const split = edit(doc, [
    {
      operation: "processing.set",
      target: { kind: "clip", id: "clip" },
      steps: [
        {
          id: "compress",
          processor: {
            ...compressor,
            detector: {
              kind: "tap",
              tap: { target: { kind: "track", id: "detector-track" }, point: { kind: "dry" } },
            },
          },
        },
      ],
    },
    { operation: "split", clipIds: ["detector"], atUs: 2000000, scope: "selected" },
  ]);
  expect(domains(split.document)).toMatchObject([
    {
      sampleRange: { start: 0, end: 192000 },
      dependencies: [],
      recipe: {
        ...compressor,
        detector: {
          kind: "tap",
          tap: { target: { kind: "track", id: "detector-track" }, point: { kind: "dry" } },
        },
      },
    },
  ]);
});

test("clip detectors with rational overlap but no 48 kHz samples use the same no-samples refusal", () => {
  const compressor = {
    type: "compressor",
    thresholdDbfs: -18,
    ratio: 3,
    kneeDb: 0,
    attackMs: 10,
    releaseMs: 100,
    detector: {
      kind: "tap",
      tap: { target: { kind: "clip", id: "detector" }, point: { kind: "dry" } },
    },
  };
  const doc = {
    ...document,
    tracks: [...document.tracks, { id: "other", kind: "audio", order: 1 }],
    clips: [
      ...document.clips,
      {
        ...document.clips[0]!,
        id: "detector",
        trackId: "other",
        placement: { kind: "project", range: { startUs: 1, endUs: 2 } },
      },
    ],
    processing: [
      {
        target: { kind: "clip", id: "clip" },
        steps: [{ id: "compress", enabled: true, processor: compressor }],
      },
    ],
  };
  expect(() => validateComposition(doc, [])).toThrow(
    "Detector clip tap has no samples in the state domain",
  );
});
