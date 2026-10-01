import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./evaluate.mjs";

const sub95Metrics = {
  truePositive: 30,
  falsePositive: 10,
  falseNegative: 10,
  precision: 0.75,
  recall: 0.75,
  precisionWilson95: [0.598057409330299, 0.8581303210445048],
  recallWilson95: [0.598057409330299, 0.8581303210445048],
};

// Synthetic contract inputs exercise human-evidence branches; they are not human quality proof.
function completeEvidence() {
  const words = [
    { text: "um", start: 1, end: 1.2, filler: true },
    { text: "return", start: 2, end: 2.4, required: true },
    { text: "return", start: 3, end: 3.4, required: true },
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
  return { clips, runs };
}
async function cliEvaluate(clips, runs) {
  const { mkdir, mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  await mkdir(".build", { recursive: true });
  const directory = await mkdtemp(join(process.cwd(), ".build/speech-eval-"));
  try {
    const dataset = join(directory, "dataset.json"),
      results = join(directory, "runs.json");
    await writeFile(dataset, JSON.stringify({ clips, fillerTerms: ["um", "uh"] }));
    await writeFile(results, JSON.stringify(runs));
    const script = new URL("../../../scripts/speech-eval.mjs", import.meta.url);
    const result = spawnSync(process.execPath, [script.pathname, "evaluate", dataset, results], {
      encoding: "utf8",
    });
    assert.equal(result.signal, null, result.stderr);
    return { exitCode: result.status, report: JSON.parse(result.stdout) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function optionalFillerMisses(runs) {
  return runs.map((run) =>
    run.clipId === "canonical"
      ? { ...run, words: run.words.filter((word) => !word.filler) }
      : run.clipId.startsWith("held-")
        ? {
            ...run,
            words: [
              ...run.words.slice(0, 15),
              ...Array.from({ length: 5 }, (_, index) => ({
                text: "uh",
                start: 100 + index * 2,
                end: 100.2 + index * 2,
              })),
            ],
          }
        : run,
  );
}

test("CLI accepts complete evidence with optional filler misses while retaining required repetitions and sub95 metrics", async () => {
  const { clips, runs } = completeEvidence();
  const result = await cliEvaluate(clips, optionalFillerMisses(runs));
  console.log(JSON.stringify({ contract: "synthetic optional-filler cohort", ...result }));
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "pass");
  assert.deepEqual(result.report.failures, []);
  assert.deepEqual(result.report.pending, []);
  assert.deepEqual(result.report.heldOut, sub95Metrics);
  assert.deepEqual(result.report.boundaries, { samples: 70, median: 0, p95: 0 });
  assert.deepEqual(result.report.clips, [
    {
      id: "canonical",
      origin: "human",
      matchedWords: 2,
      referenceWords: 3,
      missedRequired: [],
      missedFillers: [0],
      boundaryMedian: 0,
      boundaryP95: 0,
    },
    ...["held-a", "held-b"].map((id) => ({
      id,
      origin: "human",
      matchedWords: 15,
      referenceWords: 20,
      missedRequired: [],
      missedFillers: [15, 16, 17, 18, 19],
      boundaryMedian: 0,
      boundaryP95: 0,
    })),
    {
      id: "walk",
      origin: "human",
      matchedWords: 3,
      referenceWords: 3,
      missedRequired: [],
      missedFillers: [],
      boundaryMedian: 0,
      boundaryP95: 0,
    },
  ]);
});

test("CLI retains sparse filler metrics but incomplete evidence stays pending", async () => {
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
  const reply = await cliEvaluate([clip], [run]);
  const result = reply.report;
  assert.equal(result.heldOut.truePositive, 1);
  assert.equal(result.heldOut.falsePositive, 1);
  assert.equal(result.heldOut.falseNegative, 1);
  assert.equal(result.heldOut.precision, 0.5);
  assert.equal(result.heldOut.recall, 0.5);
  assert.equal(reply.exitCode, 2);
  assert.equal(result.status, "pending");
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.pending, [
    "Inference provenance pending: held",
    "Audition pending: held",
    ...["repetition", "false-start", "silence", "technical-names"].map(
      (item) => `Human coverage pending: ${item}`,
    ),
    "Real canonical fixture pending",
    "At least 40 labeled fillers across held-out human clips required",
    "Five-minute human walkthrough pending",
  ]);
  assert.deepEqual(result.clips[0].missedRequired, []);
  assert.deepEqual(result.clips[0].missedFillers, [0]);
});

test("results from different model configurations cannot produce one passing score", () => {
  assert.throws(
    () =>
      evaluate({ clips: [], fillerTerms: [] }, [
        { clipId: "one", engine: "parakeet", modelRevision: "a" },
        { clipId: "two", engine: "parakeet", modelRevision: "b" },
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
  const result = await cliEvaluate([], []);
  assert.equal(result.exitCode, 2);
  assert.equal(result.report.status, "pending");
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

for (const [name, missingIndex] of [
  ["required filler", 0],
  ["required repeated word", 1],
]) {
  test(`CLI still fails a canonical ${name} omission and preserves both diagnostic roles`, async () => {
    const { clips, runs } = completeEvidence();
    const canonical = clips.find((clip) => clip.kind === "canonical");
    canonical.words = canonical.words.map((word, index) =>
      index === missingIndex ? { ...word, required: true } : word,
    );
    const incomplete = optionalFillerMisses(runs).map((run) =>
      run.clipId === "canonical" && missingIndex === 1
        ? { ...run, words: run.words.filter((word) => word.start !== 2) }
        : run,
    );
    const { exitCode, report } = await cliEvaluate(clips, incomplete);
    assert.equal(exitCode, 1);
    assert.equal(report.status, "fail");
    assert.deepEqual(report.failures, ["Canonical omissions: canonical"]);
    assert.deepEqual(report.pending, []);
    assert.deepEqual(report.clips[0], {
      id: "canonical",
      origin: "human",
      matchedWords: missingIndex === 0 ? 2 : 1,
      referenceWords: 3,
      missedRequired: [missingIndex],
      missedFillers: [0],
      boundaryMedian: 0,
      boundaryP95: 0,
    });
    assert.deepEqual(report.heldOut, sub95Metrics);
    assert.deepEqual(report.boundaries, {
      samples: missingIndex === 0 ? 70 : 68,
      median: 0,
      p95: 0,
    });
  });
}

test("CLI still fails independent timing when optional filler metrics are sub95", async () => {
  const { clips, runs } = completeEvidence();
  const shifted = optionalFillerMisses(runs).map((run) => ({
    ...run,
    words: run.words.map((word) => ({ ...word, start: word.start + 0.3, end: word.end + 0.3 })),
  }));
  const { exitCode, report } = await cliEvaluate(clips, shifted);
  assert.equal(exitCode, 1);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.failures, [
    "Median boundary error exceeds 100 ms",
    "P95 boundary error exceeds 250 ms",
  ]);
  assert.deepEqual(report.pending, []);
  assert.equal(report.heldOut.precision, 0.75);
  assert.equal(report.heldOut.recall, 0.75);
  assert.equal(report.boundaries.samples, 70);
  assert.ok(Math.abs(report.boundaries.median - 0.3) < 1e-12);
  assert.ok(Math.abs(report.boundaries.p95 - 0.3) < 1e-12);
});

for (const kind of ["held-out", "walkthrough"]) {
  test(`required omissions remain diagnostic in ${kind} clips without broadening canonical enforcement`, async () => {
    const { clips, runs } = completeEvidence();
    const clip = clips.find((value) => value.kind === kind);
    const index = kind === "held-out" ? 15 : 1;
    clip.words = clip.words.map((word, position) =>
      position === index ? { ...word, required: true } : word,
    );
    const changed = optionalFillerMisses(runs).map((run) =>
      run.clipId === clip.id && kind === "walkthrough"
        ? { ...run, words: run.words.filter((word) => word.start !== 2) }
        : run,
    );
    const { exitCode, report } = await cliEvaluate(clips, changed);
    assert.equal(exitCode, 0);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.failures, []);
    assert.deepEqual(report.pending, []);
    const diagnostic = report.clips.find((value) => value.id === clip.id);
    assert.deepEqual(diagnostic.missedRequired, [index]);
    assert.deepEqual(diagnostic.missedFillers, kind === "held-out" ? [15, 16, 17, 18, 19] : []);
  });
}
