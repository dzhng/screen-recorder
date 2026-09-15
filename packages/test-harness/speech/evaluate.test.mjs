import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./evaluate.mjs";

test("omitted filler and invented filler both reduce held-out fidelity", () => {
  const clip = {
    id: "held",
    kind: "held-out",
    origin: "human",
    duration: 4,
    words: [
      { text: "um", start: 0, end: 0.2, filler: true },
      { text: "open", start: 1, end: 1.3 },
      { text: "uh", start: 2, end: 2.2, filler: true },
    ],
  };
  const run = {
    clipId: "held",
    words: [
      { text: "open", start: 1, end: 1.3 },
      { text: "uh", start: 2, end: 2.2 },
      { text: "um", start: 3, end: 3.2 },
    ],
  };
  const result = evaluate({ fillerTerms: ["um", "uh"], clips: [clip] }, [run]);
  assert.equal(result.heldOut.truePositive, 1);
  assert.equal(result.heldOut.falsePositive, 1);
  assert.equal(result.heldOut.falseNegative, 1);
  assert.equal(result.heldOut.precision, 0.5);
  assert.equal(result.heldOut.recall, 0.5);
  assert.equal(result.status, "fail");
});

test("results from different model configurations cannot produce one passing score", () => {
  assert.throws(
    () =>
      evaluate({ clips: [], fillerTerms: [] }, [
        { clipId: "one", engine: "parakeet", modelRevision: "a" },
        { clipId: "two", engine: "whisperkit", modelRevision: "b" },
      ]),
    /Mixed model/,
  );
});

test("a transcript of different audio is rejected before scoring its words", () => {
  const clip = {
    id: "x",
    kind: "held-out",
    origin: "human",
    duration: 1,
    audioSha256: "a".repeat(64),
    words: [{ text: "um", start: 0, end: 0.1, filler: true }],
  };
  assert.throws(
    () =>
      evaluate({ clips: [clip], fillerTerms: ["um"] }, [
        {
          clipId: "x",
          audioSha256: "b".repeat(64),
          words: clip.words,
        },
      ]),
    /Audio hash mismatch/,
  );
});

test("the CLI reports empty evidence as pending with a non-success exit code", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "speech-eval-test-"));
  try {
    const dataset = join(directory, "dataset.json"),
      runs = join(directory, "runs.json");
    await writeFile(dataset, JSON.stringify({ clips: [], fillerTerms: ["um"] }));
    await writeFile(runs, "[]");
    const script = new URL("../../../scripts/speech-eval.mjs", import.meta.url);
    const result = spawnSync(process.execPath, [script.pathname, "evaluate", dataset, runs], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "pending");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("perfect synthetic words cannot increase human fidelity denominators", () => {
  const words = [{ text: "um", start: 0, end: 0.2, filler: true }];
  const report = evaluate(
    {
      fillerTerms: ["um"],
      clips: [
        {
          id: "tts",
          kind: "held-out",
          origin: "synthetic",
          duration: 1,
          words,
        },
      ],
    },
    [{ clipId: "tts", words }],
  );
  assert.equal(report.status, "pending");
  assert.equal(report.heldOut.truePositive, 0);
  assert.equal(report.heldOut.recall, null);
  assert.equal(report.boundaries.samples, 0);
});

test("complete evidence passes, but a 300 ms boundary shift fails the timing gate", () => {
  const words = [
    { text: "um", start: 1, end: 1.2, filler: true },
    { text: "open", start: 2, end: 2.4, required: true },
  ];
  const clips = [
    { id: "canonical", kind: "canonical", words },
    ...["held-a", "held-b"].map((id) => ({
      id,
      kind: "held-out",
      words: Array.from({ length: 20 }, (_, i) => ({
        text: "um",
        start: i * 2,
        end: i * 2 + 0.2,
        filler: true,
      })),
    })),
    { id: "walk", kind: "walkthrough", words },
  ].map((clip) => ({
    ...clip,
    origin: "human",
    duration: 300,
    audioSha256: "a".repeat(64),
    covers: ["repetition", "false-start", "silence", "technical-names"],
  }));
  const runs = clips.map((clip) => ({
    clipId: clip.id,
    words: clip.words,
    audioSha256: clip.audioSha256,
    engine: "unit-test",
    runtimeRevision: "runtime",
    modelRevision: "model",
    binarySha256: "binary",
    network: "sandbox-deny-network",
    audition: { reviewer: "unit-test", neighboringSpeechIntact: true },
    warm: true,
    elapsedSeconds: 1,
    peakRssBytes: 1024,
  }));
  assert.equal(evaluate({ clips, fillerTerms: ["um"] }, runs).status, "pass");
  const shifted = runs.map((run) => ({
    ...run,
    words: run.words.map((w) => ({ ...w, start: w.start + 0.3, end: w.end + 0.3 })),
  }));
  const failed = evaluate({ clips, fillerTerms: ["um"] }, shifted);
  assert.equal(failed.status, "fail");
  assert.ok(failed.failures.includes("Median boundary error exceeds 100 ms"));
  assert.ok(failed.failures.includes("P95 boundary error exceeds 250 ms"));
});

test("median boundary error averages the middle pair for an even sample count", () => {
  const clip = {
    id: "median",
    kind: "held-out",
    origin: "human",
    duration: 2,
    words: [{ text: "um", start: 0, end: 1, filler: true }],
  };
  const report = evaluate({ clips: [clip], fillerTerms: ["um"] }, [
    {
      clipId: "median",
      words: [{ text: "um", start: 0, end: 1.3 }],
    },
  ]);
  assert.ok(Math.abs(report.boundaries.median - 0.15) < 1e-12);
  assert.ok(report.failures.includes("Median boundary error exceeds 100 ms"));
});

test("repeated words match the observed occurrence when edit costs tie", () => {
  const clip = {
    id: "repeated-like",
    kind: "held-out",
    origin: "human",
    duration: 12,
    words: [
      { text: "like", start: 1, end: 1.3, filler: true },
      { text: "like", start: 10, end: 10.3 },
    ],
  };
  const result = evaluate({ clips: [clip], fillerTerms: ["like"] }, [
    { clipId: clip.id, words: [{ text: "like", start: 1, end: 1.3 }] },
  ]);
  assert.equal(result.heldOut.truePositive, 1);
  assert.equal(result.heldOut.falseNegative, 0);
  assert.equal(result.boundaries.p95, 0);
});
