import { expect, test } from "vitest";
import { applyBatch, createCompiler, validateComposition } from "./index.js";
import { sampleScalarSamples } from "./scalar-program.js";

const empty = {
  canvas: { width: 64, height: 48, fps: { numerator: 8, denominator: 1 }, background: "#000000ff" },
  tracks: [],
  groups: [],
  clips: [],
  syncGroups: [],
  processing: [],
};
const context = { assets: [], namespace: "macro" };

test("fade appends an inspectable gain transition and preserves the existing stack", () => {
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        clip: {
          trackId: { label: "audio" },
          source: { kind: "silence" },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
        label: "clip",
      },
      {
        operation: "processing.set",
        target: { kind: "clip", id: { label: "clip" } },
        steps: [{ label: "prior", processor: { type: "gain", gain: 0.5 } }],
      },
      {
        operation: "fade",
        target: { kind: "clip", id: { label: "clip" } },
        mediaKind: "audio",
        from: 0,
        to: 1,
        window: {
          kind: "clip",
          clipId: { label: "clip" },
          start: { numerator: 1, denominator: 4 },
          end: { numerator: 3, denominator: 4 },
        },
        label: "fade",
      },
    ],
    context,
  );
  const steps = result.document.processing[0]!.steps;
  expect(steps[0]).toEqual({
    id: result.labels.prior,
    enabled: true,
    processor: { type: "gain", gain: 0.5 },
  });
  expect(steps[1]).toEqual({
    id: result.labels.fade,
    enabled: true,
    window: {
      kind: "clip",
      clipId: result.labels.clip,
      start: { numerator: 1, denominator: 4 },
      end: { numerator: 3, denominator: 4 },
    },
    processor: {
      type: "gain",
      gain: {
        keys: [
          { at: { numerator: 1, denominator: 4 }, value: 0, interpolation: "linear" },
          { at: { numerator: 3, denominator: 4 }, value: 1, interpolation: "hold" },
        ],
      },
    },
  });
  expect(result.normalized[3]!.changes).toEqual([
    { kind: "processing", target: { kind: "clip", id: result.labels.clip }, steps },
  ]);
  const compiler = createCompiler(validateComposition(result.document, []), "r");
  const gain = compiler
    .window({
      range: { startUs: 0, endUs: 1000000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    })
    .processing()[0]!.steps[1]!.processor;
  if (gain.type !== "gain" || typeof gain.gain === "number") throw Error("Expected gain program");
  expect(gain.active).toEqual([{ start: 12000, end: 36000 }]);
  expect(sampleScalarSamples(gain.gain, 24000)).toBe(0.5);
});

test("zoom retains explicit geometry and expands to the same ordinary picture trajectory", () => {
  const assets = [{ id: "image", streams: [{ id: "s", kind: "image", width: 80, height: 60 }] }];
  const ctx = { assets, namespace: "zoom" };
  const first = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "place",
        clip: {
          assetId: "image",
          streamId: "s",
          trackId: { label: "video" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
        label: "image",
      },
    ],
    ctx,
  );
  const target = { kind: "clip", id: first.labels.image };
  const window = {
    kind: "content",
    clipId: first.labels.image,
    sourceRange: { startUs: 0, endUs: 1000000 },
  };
  expect(() =>
    applyBatch(first.document, [{ operation: "zoom", target, from: 1, to: 2, window }], ctx),
  ).toThrow();
  const anchor = {
    kind: "clip",
    clipId: first.labels.image,
    start: { numerator: 0, denominator: 1 },
    end: { numerator: 1, denominator: 1 },
  };
  const geometry = {
    crop: { x: 10, y: 5, width: 50, height: 40 },
    rect: { x: 3, y: 4, width: 48, height: 32 },
    pivot: { x: 0, y: 1 },
    rotationDeg: 15,
    fit: "cover",
  };
  const macro = applyBatch(
    first.document,
    [{ operation: "zoom", target, from: 0.5, to: 1.5, window: anchor, geometry }],
    ctx,
  ).document;
  for (let i = 0; i < 8; i++) {
    const scale = 0.5 + i / 8;
    const direct = applyBatch(
      first.document,
      [
        {
          operation: "processing.set",
          target,
          steps: [{ processor: { type: "geometry", ...geometry, scale: { x: scale, y: scale } } }],
        },
      ],
      ctx,
    ).document;
    const pictures = (doc: unknown) =>
      [
        ...createCompiler(validateComposition(doc, assets), "r").frames({
          startUs: i * 125000,
          endUs: i * 125000 + 1,
        }),
      ].map((frame) => frame.visual.flatMap((node) => node.operations));
    expect(pictures(macro)).toEqual(pictures(direct));
  }
});

test("invalid conveniences fail the entire batch without replacing earlier steps", () => {
  const first = applyBatch(
    empty,
    [{ operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" }],
    context,
  );
  const target = { kind: "track", id: first.labels.audio };
  const window = { kind: "project", range: { startUs: 0, endUs: 1000000 } };
  const valid = { operation: "fade", target, mediaKind: "audio", from: 0, to: 1, window };
  for (const invalid of [
    { ...valid, mediaKind: "video" },
    { ...valid, from: -1 },
    { ...valid, interpolation: { cubic: [0.3, -8, 0.7, 8] } },
    { ...valid, window: { kind: "project", range: { startUs: 1, endUs: 1 } } },
    {
      ...valid,
      window: {
        kind: "project",
        range: { startUs: { numerator: 1, denominator: 3 }, endUs: 1000000 },
      },
    },
    { operation: "zoom", target, from: 1, to: 2, window },
  ]) {
    expect(() => applyBatch(first.document, [valid, invalid], context)).toThrow();
    expect(first.document.processing).toEqual([]);
  }
});

test("content fade keys stay in source time and output fades explicitly select their medium", () => {
  const assets = [
    {
      id: "source",
      streams: [
        {
          id: "a",
          kind: "audio",
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
  ];
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "audio" },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "audio" },
          assetId: "source",
          streamId: "a",
          source: { kind: "range", range: { startUs: 1000000, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "fade",
        target: { kind: "clip", id: { label: "clip" } },
        mediaKind: "audio",
        from: 1,
        to: 0,
        window: {
          kind: "content",
          clipId: { label: "clip" },
          sourceRange: { startUs: 1000000, endUs: 2000000 },
        },
      },
      {
        operation: "fade",
        target: { kind: "output" },
        mediaKind: "video",
        from: 0,
        to: 1,
        window: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
      },
    ],
    { assets, namespace: "content" },
  );
  const clip = result.document.processing.find((s) => s.target.kind === "clip")!;
  expect(clip.steps[0]!.processor).toEqual({
    type: "gain",
    gain: {
      keys: [
        { at: 1000000, value: 1, interpolation: "linear" },
        { at: 2000000, value: 0, interpolation: "hold" },
      ],
    },
  });
  const output = result.document.processing.find((s) => s.target.kind === "output")!;
  expect(output.steps[0]!.processor.type).toBe("opacity");
});

test("crossfade lowers to opposing opacity ramps on two explicit overlapping targets", () => {
  const assets = [
    { id: "a", streams: [{ id: "v", kind: "image", width: 64, height: 48 }] },
    { id: "b", streams: [{ id: "v", kind: "image", width: 64, height: 48 }] },
  ];
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "first" },
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "second" },
      {
        operation: "place",
        label: "a",
        clip: {
          assetId: "a",
          streamId: "v",
          trackId: { label: "first" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "place",
        label: "b",
        clip: {
          assetId: "b",
          streamId: "v",
          trackId: { label: "second" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
      {
        operation: "transition",
        kind: "crossfade",
        targets: [
          { kind: "clip", id: { label: "a" } },
          { kind: "clip", id: { label: "b" } },
        ],
        mediaKind: "video",
        window: {
          kind: "project",
          range: { startUs: 250000, endUs: 750000 },
        },
      },
    ],
    { assets, namespace: "crossfade" },
  );
  const stacks = result.document.processing.filter((stack) => stack.target.kind === "clip");
  expect(stacks).toHaveLength(2);
  expect(stacks.map((stack) => stack.steps[0]!.processor)).toEqual([
    {
      type: "opacity",
      opacity: {
        keys: [
          { at: 250000, value: 1, interpolation: "linear" },
          { at: 750000, value: 0, interpolation: "hold" },
        ],
      },
    },
    {
      type: "opacity",
      opacity: {
        keys: [
          { at: 250000, value: 0, interpolation: "linear" },
          { at: 750000, value: 1, interpolation: "hold" },
        ],
      },
    },
  ]);
});

test("dip and flash use a bounded three-point alpha pulse and refuse an unrepresentable midpoint", () => {
  const assets = [{ id: "a", streams: [{ id: "v", kind: "image", width: 64, height: 48 }] }];
  const setup = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "place",
        label: "clip",
        clip: {
          assetId: "a",
          streamId: "v",
          trackId: { label: "video" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
    { assets, namespace: "pulse-setup" },
  );
  const target = { kind: "clip", id: setup.labels.clip };
  for (const kind of ["dip", "flash"] as const) {
    const result = applyBatch(
      setup.document,
      [
        {
          operation: "transition",
          kind,
          targets: [target],
          mediaKind: "video",
          window: { kind: "project", range: { startUs: 200000, endUs: 800000 } },
        },
      ],
      { assets, namespace: `pulse-${kind}` },
    );
    expect(result.document.processing[0]!.steps[0]!.processor).toEqual({
      type: "opacity",
      opacity: {
        keys: [
          { at: 200000, value: 1, interpolation: "linear" },
          { at: 500000, value: 0, interpolation: "linear" },
          { at: 800000, value: 1, interpolation: "hold" },
        ],
      },
    });
  }
  expect(() =>
    applyBatch(
      setup.document,
      [
        {
          operation: "transition",
          kind: "dip",
          targets: [target],
          mediaKind: "video",
          window: { kind: "project", range: { startUs: 200001, endUs: 800000 } },
        },
      ],
      { assets, namespace: "pulse-odd" },
    ),
  ).toThrow(/midpoint/);
});

test("zoom transition lowers to a bounded geometry trajectory and whip refuses uncovered travel", () => {
  const assets = [{ id: "image", streams: [{ id: "s", kind: "image", width: 80, height: 60 }] }];
  const setup = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "video" },
      {
        operation: "place",
        label: "image",
        clip: {
          assetId: "image",
          streamId: "s",
          trackId: { label: "video" },
          source: { kind: "hold", atUs: 0 },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
    { assets, namespace: "trajectory" },
  );
  const target = { kind: "clip", id: setup.labels.image };
  const window = {
    kind: "clip",
    clipId: setup.labels.image,
    start: { numerator: 0, denominator: 1 },
    end: { numerator: 1, denominator: 1 },
  };
  const zoom = applyBatch(
    setup.document,
    [
      {
        operation: "transition",
        kind: "zoom",
        targets: [target],
        mediaKind: "video",
        from: 1,
        to: 2,
        window,
      },
    ],
    { assets, namespace: "zoom-transition" },
  );
  const zoomStep = zoom.document.processing[0]!.steps[0]!.processor;
  expect(zoomStep).toMatchObject({
    type: "geometry",
    scale: { x: { keys: [{ value: 1 }, { value: 2 }] }, y: { keys: [{ value: 1 }, { value: 2 }] } },
  });
  expect(() =>
    applyBatch(
      setup.document,
      [
        {
          operation: "transition",
          kind: "whip",
          targets: [target],
          mediaKind: "video",
          direction: "left",
          distance: 80,
          overscan: 1,
          window,
        },
      ],
      { assets, namespace: "whip-invalid" },
    ),
  ).toThrow(/coverage|overscan|distance/i);
  const whip = applyBatch(
    setup.document,
    [
      {
        operation: "transition",
        kind: "whip",
        targets: [target],
        mediaKind: "video",
        direction: "left",
        distance: 8,
        overscan: 1.5,
        window,
      },
    ],
    { assets, namespace: "whip" },
  );
  const whipStep = whip.document.processing[0]!.steps[0]!.processor;
  expect(whipStep).toMatchObject({
    type: "geometry",
    scale: { x: 1.5, y: 1.5 },
    rect: { x: { keys: [{ value: 8 }, { value: 0 }] } },
  });
  const right = applyBatch(
    setup.document,
    [
      {
        operation: "transition",
        kind: "whip",
        targets: [target],
        mediaKind: "video",
        direction: "right",
        distance: 8,
        overscan: 1.5,
        window,
      },
    ],
    { assets, namespace: "whip-right" },
  );
  expect(right.document.processing[0]!.steps[0]!.processor).toMatchObject({
    rect: { x: { keys: [{ value: -8 }, { value: 0 }] } },
  });
});

test("angle declaration retains explicit session members, source identity, offsets and validity", () => {
  const assets = [
    {
      id: "camera-a",
      streams: [
        {
          id: "video",
          kind: "video",
          width: 64,
          height: 48,
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
    {
      id: "camera-b",
      streams: [
        {
          id: "video",
          kind: "video",
          width: 64,
          height: 48,
          bounds: { startUs: 0, endUs: 2000000 },
          available: [{ startUs: 0, endUs: 2000000 }],
        },
      ],
    },
  ];
  const result = applyBatch(
    empty,
    [
      { operation: "track.add", track: { kind: "video", order: 0 }, label: "a-track" },
      { operation: "track.add", track: { kind: "video", order: 1 }, label: "b-track" },
      {
        operation: "place",
        label: "a",
        clip: {
          assetId: "camera-a",
          streamId: "video",
          trackId: { label: "a-track" },
          source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
        },
      },
      {
        operation: "place",
        label: "b",
        clip: {
          assetId: "camera-b",
          streamId: "video",
          trackId: { label: "b-track" },
          source: { kind: "range", range: { startUs: 0, endUs: 2000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 2000000 } },
        },
      },
      {
        operation: "angle.declare",
        label: "angles",
        sessionId: "session-1",
        originClipId: { label: "a" },
        evidence: {
          id: "sync-evidence", generation: "g1", status: "accepted", method: "mixed-reference",
          fingerprint: "sha256:angle-evidence", sources: [
            { assetId: "camera-a", streamId: "video" }, { assetId: "camera-b", streamId: "video" },
          ],
        },
        members: [
          {
            clipId: { label: "a" },
            offsetUs: 0,
            validRange: { startUs: 0, endUs: 2000000 },
          },
          {
            clipId: { label: "b" },
            offsetUs: { numerator: 1, denominator: 2 },
            validRange: { startUs: 0, endUs: 2000000 },
          },
        ],
      },
    ],
    { assets, namespace: "angles" },
  );
  expect(result.labels.angles).toMatch(/^angleGroup:angles:/);
  expect(result.document.angleGroups).toEqual([
    {
      id: result.labels.angles,
      sessionId: "session-1",
      originClipId: result.labels.a,
      evidence: {
        id: "sync-evidence", generation: "g1", status: "accepted", method: "mixed-reference",
        fingerprint: "sha256:angle-evidence", sources: [
          { assetId: "camera-a", streamId: "video" }, { assetId: "camera-b", streamId: "video" },
        ],
      },
      members: [
        {
          clipId: result.labels.a,
          assetId: "camera-a",
          streamId: "video",
          offsetUs: 0,
          validRange: { startUs: 0, endUs: 2000000 },
        },
        {
          clipId: result.labels.b,
          assetId: "camera-b",
          streamId: "video",
          offsetUs: { numerator: 1, denominator: 2 },
          validRange: { startUs: 0, endUs: 2000000 },
        },
      ],
    },
  ]);
  expect(() =>
    validateComposition(
      {
        ...result.document,
        angleGroups: result.document.angleGroups!.map((group) => ({
          ...group,
          members: group.members.map((member, index) =>
            index === 0 ? { ...member, assetId: "foreign" } : member,
          ),
        })),
      },
      assets,
    ),
  ).toThrow(/source does not match/);
  const removed = applyBatch(
    result.document,
    [{ operation: "angle.remove", angleGroupId: result.labels.angles }],
    { assets, namespace: "angles-remove" },
  );
  expect(removed.document.angleGroups).toEqual([]);
});

test("angle declaration refuses synchronization evidence without an accepted source-bound verdict", () => {
  const assets = [
    {
      id: "camera-a",
      streams: [{ id: "video", kind: "video", width: 64, height: 48,
        bounds: { startUs: 0, endUs: 1000000 }, available: [{ startUs: 0, endUs: 1000000 }] }],
    },
    {
      id: "camera-b",
      streams: [{ id: "video", kind: "video", width: 64, height: 48,
        bounds: { startUs: 0, endUs: 1000000 }, available: [{ startUs: 0, endUs: 1000000 }] }],
    },
  ];
  const setup = applyBatch(empty, [
    { operation: "track.add", track: { kind: "video", order: 0 }, label: "a-track" },
    { operation: "track.add", track: { kind: "video", order: 1 }, label: "b-track" },
    { operation: "place", label: "a", clip: {
      assetId: "camera-a", streamId: "video", trackId: { label: "a-track" },
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    } },
    { operation: "place", label: "b", clip: {
      assetId: "camera-b", streamId: "video", trackId: { label: "b-track" },
      source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
      placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
    } },
  ], { assets, namespace: "angle-evidence-setup" });
  expect(() => applyBatch(setup.document, [{
    operation: "angle.declare", sessionId: "session-1", originClipId: setup.labels.a!,
    evidence: {
      id: "sync-evidence", generation: "g1", status: "refused", method: "waveform",
      fingerprint: "sha256:refused", sources: [
        { assetId: "camera-a", streamId: "video" }, { assetId: "camera-b", streamId: "video" },
      ],
    },
    members: [
      { clipId: setup.labels.a!, offsetUs: 0, validRange: { startUs: 0, endUs: 1000000 } },
      { clipId: setup.labels.b!, offsetUs: 0, validRange: { startUs: 0, endUs: 1000000 } },
    ],
  }], { assets, namespace: "angle-evidence-refused" }),
  ).toThrow(/accepted synchronization evidence/);
});
