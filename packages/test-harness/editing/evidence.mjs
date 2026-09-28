import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { copyModels, hash, JourneyService, poll, root, run } from "./source-evidence-fixture.mjs";

const { values } = parseArgs({
  options: { fixture: { type: "string", default: "repeated-speech" }, out: { type: "string" } },
});
assert.equal(values.fixture, "repeated-speech");
assert.ok(process.env.SCREENREC_NATIVE, "Set an isolated frozen native worker");
const out = values.out ? resolve(values.out) : await mkdtemp(join(tmpdir(), "project-evidence-"));
await mkdir(out, { recursive: true });
const home = await mkdtemp(join(tmpdir(), "sr-evidence-"));
const frozen = join(root, "specs/agent-editing/assets/10b-native-selection/selected");
const report = {
  passed: false,
  boundary:
    "Actual CLI/MCP/service/media admission and transcript ingestion; native ASR output is frozen, not newly inferred",
  trace: [],
  checks: {},
  pending: ["phrase search", "capture events/cursor", "generation invalidation owner gate"],
};
const configFile = join(out, "frozen-config.json");
const service = new JourneyService(
  home,
  report,
  configFile,
  new URL("./evidence-service.mjs", import.meta.url),
);
const call = service.call.bind(service);
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
try {
  await run(
    "swiftc",
    [
      "-parse-as-library",
      join(root, "packages/test-harness/editing/selected-audio-fixture.swift"),
      "-o",
      join(out, "fixture"),
    ],
    { timeout: 120000 },
  );
  const narration = join(root, "fixtures/narrated-workbench/narration.mov");
  report.originalNarrationSha256 = hash(await readFile(narration));
  await run(
    "ffmpeg",
    [
      "-v",
      "error",
      "-nostdin",
      "-i",
      narration,
      "-map",
      "0:a:0",
      "-c:a",
      "pcm_f32le",
      join(out, "narration.wav"),
    ],
    { timeout: 30000 },
  );
  await run(join(out, "fixture"), [join(out, "narration.wav"), out], { timeout: 30000 });
  const sources = await Promise.all(
    ["first", "second"].map(async (name) => {
      const rawFile = join(frozen, `${name}-physical-selected.jsonl`);
      return {
        name,
        sha256: hash(await readFile(join(out, `${name}.mov`))),
        streamId: "track:1",
        sourceOffsetUs: -250000,
        available: [
          { startUs: 0, endUs: 6000000 },
          { startUs: 6500000, endUs: 12500000 },
        ],
        rawFile,
        rawSha256: hash(await readFile(rawFile)),
        receiptFile: join(frozen, `${name}-physical-selected-response.json`),
      };
    }),
  );
  await save("frozen-config.json", { sources, observationsFile: join(out, "frozen-calls.json") });
  await service.start();
  const {
    params: { models },
  } = JSON.parse(await readFile(join(frozen, "first-physical-selected-request.json"), "utf8"));
  report.models = await copyModels(home, models);
  for (const name of ["first", "second", "multi"]) {
    const imported = await call("asset.import", {
      requestId: `import-${name}`,
      path: join(out, `${name}.mov`),
    });
    await poll(
      () => call("job.get", { jobId: imported.jobId }),
      (value) => value.state === "ready",
      `import ${name}`,
    );
  }
  const project = await call("project.create", {
    requestId: "repeated-speech",
    title: "Frozen transcript occurrence journey",
    canvas: {
      width: 32,
      height: 32,
      fps: { numerator: 1, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = project.project.projectId;
  const place = (
    label,
    sourceIndex,
    track,
    startUs,
    endUs,
    atUs,
    durationUs = endUs - startUs,
  ) => ({
    operation: "place",
    label,
    clip: {
      trackId: { label: track },
      assetId: sources[sourceIndex].sha256,
      streamId: "track:1",
      source: { kind: "range", range: { startUs, endUs } },
      placement: { kind: "project", range: { startUs: atUs, endUs: atUs + durationUs } },
    },
  });
  const edited = await call(
    "edit.apply",
    {
      projectId,
      requestId: "place-repeated-speech",
      expectedRevisionId: project.revision.id,
      operations: [
        { operation: "track.add", label: "a", track: { kind: "audio", order: 0 } },
        { operation: "track.add", label: "b", track: { kind: "audio", order: 1 } },
        place("okay", 0, "a", 1120000, 1440000, 0),
        place("so", 0, "a", 1600000, 1920000, 320000),
        place("repeat", 0, "a", 1120000, 1440000, 640000),
        place("is", 0, "a", 2240000, 2560000, 960000),
        place("this", 0, "a", 1920000, 2240000, 1280000),
        place("retimed", 0, "a", 0, 6000000, 3000000, 2000000),
        place("simultaneous", 1, "b", 560000, 1200000, 0),
      ],
    },
    { transport: "mcp" },
  );
  const revisionId = edited.revision.id;
  const full = await poll(
    () => call("transcript.get", { projectId, revisionId, limit: 1000 }),
    (value) => value.state === "ready",
    "project transcript",
  );
  assert.deepEqual(
    full,
    await call("transcript.get", { projectId, revisionId, limit: 1000 }, { transport: "mcp" }),
  );
  const fraction = (numerator, denominator) => {
    let a = BigInt(numerator),
      b = BigInt(denominator);
    let x = a,
      y = b;
    while (y) [x, y] = [y, x % y];
    a /= x;
    b /= x;
    return b === 1n ? Number(a) : { numerator: Number(a), denominator: Number(b) };
  };
  const sourceWords = await Promise.all(
    sources.map(async (source) =>
      (await readFile(source.rawFile, "utf8"))
        .trim()
        .split("\n")
        .map(JSON.parse)
        .flatMap((line) => line.words),
    ),
  );
  const sourcePages = await Promise.all(
    sources.map((source) =>
      call("transcript.get", { assetId: source.sha256, streamId: source.streamId, limit: 1000 }),
    ),
  );
  const expectedWord = (label, sourceIndex, ordinal, startUs, endUs) => {
    const word = sourceWords[sourceIndex][ordinal];
    return {
      type: "word",
      id: `w${ordinal}`,
      ordinal,
      text: word.text,
      kind: "speech",
      confidence: word.confidence,
      segment: 0,
      sourceRange: word.source,
      partial: false,
      clipId: edited.edit.labels[label],
      assetId: sources[sourceIndex].sha256,
      streamId: "track:1",
      trackId: edited.edit.labels[sourceIndex === 0 ? "a" : "b"],
      trackRank: sourceIndex,
      generation: sourcePages[sourceIndex].generation,
      fragments: [{ source: word.source, project: { startUs, endUs } }],
    };
  };
  const expectedRows = [
    expectedWord("okay", 0, 0, 0, 320000),
    expectedWord("simultaneous", 1, 0, 0, 240000),
    expectedWord("so", 0, 1, 320000, 640000),
    expectedWord("simultaneous", 1, 1, 320000, 640000),
    expectedWord("repeat", 0, 0, 640000, 960000),
    expectedWord("is", 0, 3, 960000, 1280000),
    expectedWord("this", 0, 2, 1280000, 1600000),
    ...sourceWords[0]
      .slice(0, 7)
      .map((word, ordinal) =>
        expectedWord(
          "retimed",
          0,
          ordinal,
          fraction(9000000 + word.source.startUs, 3),
          fraction(9000000 + word.source.endUs, 3),
        ),
      ),
  ];
  assert.deepEqual(
    full.page.rows,
    expectedRows,
    "Every occurrence must match the independent frozen-word and authored-placement oracle",
  );
  const filtered = await poll(
    () =>
      call("transcript.get", {
        projectId,
        revisionId,
        trackIds: [edited.edit.labels.b],
        limit: 1000,
      }),
    (value) => value.state === "ready",
    "track-filtered rows",
  );
  assert.deepEqual(
    filtered.page.rows,
    expectedRows.filter((row) => row.trackId === edited.edit.labels.b),
  );
  const clipped = await poll(
    () =>
      call("transcript.get", {
        projectId,
        revisionId,
        range: { startUs: 3400000, endUs: 3450000 },
        limit: 2,
      }),
    (value) => value.state === "ready",
    "narrow project window",
  );
  assert.deepEqual(
    clipped.page.rows,
    [expectedRows[7]],
    "A query selects matching word rows and preserves their full editorial fragments",
  );
  for (const limit of [1, 2]) {
    const rows = [],
      cursors = new Set();
    let cursor;
    for (let pageNumber = 0; ; pageNumber++) {
      assert.ok(pageNumber < 200, "Bounded project pagination must terminate");
      const page = await call(
        "transcript.get",
        { projectId, revisionId, limit, ...(cursor ? { cursor } : {}) },
        { transport: pageNumber % 2 ? "mcp" : "cli" },
      );
      assert.equal(page.state, "ready");
      assert.ok(page.page.rows.length <= limit);
      rows.push(...page.page.rows);
      cursor = page.page.nextCursor;
      if (!cursor) break;
      const key = JSON.stringify(cursor);
      assert.ok(!cursors.has(key), "Checkpoint must make progress");
      cursors.add(key);
    }
    assert.deepEqual(rows, full.page.rows);
  }
  const firstPage = await call("transcript.get", { projectId, revisionId, limit: 1 });
  const savedCursor = firstPage.page.nextCursor;
  assert.ok(savedCursor);
  const advanced = await call("edit.apply", {
    projectId,
    requestId: "partial-and-gap",
    expectedRevisionId: revisionId,
    operations: [
      { operation: "track.add", label: "more", track: { kind: "audio", order: 2 } },
      place("partial", 0, "more", 1120000, 1300000, 6000000),
      place("physical-gap", 0, "more", 5360000, 7380000, 7000000),
    ],
  });
  assert.notEqual(advanced.revision.id, revisionId);
  const partial = await poll(
    () =>
      call("transcript.get", {
        projectId,
        revisionId: advanced.revision.id,
        range: { startUs: 6000000, endUs: 6180000 },
      }),
    (value) => value.state === "ready",
    "partial word",
  );
  assert.equal(partial.page.rows.length, 1);
  assert.equal(partial.page.rows[0].text, "Okay,");
  assert.equal(partial.page.rows[0].partial, true);
  assert.deepEqual(partial.page.rows[0].sourceRange, { startUs: 1120000, endUs: 1440000 });
  assert.deepEqual(partial.page.rows[0].fragments, [
    { source: { startUs: 1120000, endUs: 1300000 }, project: { startUs: 6000000, endUs: 6180000 } },
  ]);
  const gap = await poll(
    () =>
      call("transcript.get", {
        projectId,
        revisionId: advanced.revision.id,
        range: { startUs: 7700000, endUs: 8000000 },
      }),
    (value) => value.state === "ready",
    "gap-only window",
  );
  assert.equal(gap.page.rows.length, 1);
  assert.equal(gap.page.rows[0].type, "gap");
  assert.equal(gap.page.rows[0].reason, "not_acquired");
  assert.deepEqual(gap.page.rows[0].fragments, [
    { source: { startUs: 6060000, endUs: 6360000 }, project: { startUs: 7700000, endUs: 8000000 } },
  ]);
  const changed = await call(
    "transcript.get",
    { projectId, cursor: savedCursor, range: { startUs: 1, endUs: 5000000 } },
    { error: true },
  );
  assert.equal(changed.code, "ARTIFACT_CHANGED");
  await service.stop();
  await service.start();
  assert.equal((await call("project.get", { projectId })).currentRevisionId, advanced.revision.id);
  const continued = await call(
    "transcript.get",
    { projectId, cursor: savedCursor, limit: 1000 },
    { transport: "mcp" },
  );
  assert.equal(continued.revisionId, revisionId);
  assert.deepEqual(continued.page.rows, full.page.rows.slice(1));
  const oldRevision = await call("revision.get", { projectId, revisionId });
  assert.equal(oldRevision.revision.id, revisionId);
  assert.deepEqual(oldRevision.revision.document, edited.revision.document);
  await service.stop();
  const checkpointPath = join(home, "library/cache/derived", `${savedCursor.checkpointId}.cache`);
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  assert.equal(checkpoint.manifestId, savedCursor.manifestId);
  await rm(checkpointPath);
  await service.start();
  const lost = await call("transcript.get", { projectId, cursor: savedCursor }, { error: true });
  assert.equal(lost.code, "ARTIFACT_CHANGED");
  const fresh = await poll(
    () => call("transcript.get", { projectId, revisionId, limit: 1000 }),
    (value) => value.state === "ready",
    "fresh query after checkpoint loss",
  );
  assert.deepEqual(fresh.page.rows, full.page.rows);
  report.checks.historyAndFaults = {
    headAdvanced: true,
    originalDocumentAndRows: true,
    checkpointFileLossNotLRUEviction: true,
    freshQueryAfterLoss: true,
  };
  await save("project.json", {
    projectId,
    revisionId,
    edit: edited,
    transcript: full,
    advanced,
    clipped,
    partial,
    gap,
    continued,
  });
  report.checks.paging = {
    publicBothTransports: true,
    repeatsAndReorders: true,
    simultaneousTrackOrder: true,
    limits: [1, 2, 1000],
  };
  const frozenCalls = JSON.parse(await readFile(join(out, "frozen-calls.json"), "utf8"));
  assert.deepEqual(
    frozenCalls.calls.map((call) => call.sourceSha256).sort(),
    sources.map((source) => source.sha256).sort(),
  );
  report.checks.onlySelectedSourcesPrepared = true;
  assert.equal(hash(await readFile(narration)), report.originalNarrationSha256);
  report.runtime = Object.fromEntries(
    await Promise.all(
      [
        "packages/core/package.json",
        "apps/service/dist/project-service.js",
        "apps/service/dist/worker.js",
        "apps/cli/dist/main.js",
        "packages/protocol/dist/operations.js",
        "packages/core/dist/project-evidence.js",
        "packages/core/dist/transcript-processing.js",
        "packages/core/dist/transcript-read.js",
        "packages/core/dist/transcript.js",
        "packages/core/dist/cache.js",
        "packages/composition/dist/source-projection.js",
        "packages/test-harness/editing/evidence.mjs",
        "packages/test-harness/editing/evidence-service.mjs",
        "packages/test-harness/editing/source-evidence-fixture.mjs",
      ].map(async (path) => [path, hash(await readFile(join(root, path)))]),
    ),
  );
  report.nativeSha256 = hash(await readFile(process.env.SCREENREC_NATIVE));
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await service.stop().catch((error) => {
    report.shutdownError = error.message;
    report.passed = false;
    process.exitCode = 1;
  });
  await save("report.json", report);
  await writeFile(join(out, "service.log"), service.logs.join(""));
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ out, passed: report.passed, error: report.error?.message }));
