import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { cpus, platform, release, arch } from "node:os";
import { callLocal } from "@screenrec/client";
import { RevisionStore } from "@screenrec/core/library";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";
import { width, height, page, raster, journalRows } from "./fixtures/generated-capture.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
const ffmpeg = (args) => run("ffmpeg", ["-v", "error", "-y", ...args]);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ppm = (rgb, w = width, h = height) =>
  Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), rgb]);
const seconds = (time) => (time / 1_000_000).toFixed(6);
const point = (sourceUs, x, y, buttons = 0, eligibility = "inside") => ({
  sourceUs,
  x,
  y,
  globalX: x,
  globalY: y,
  buttons,
  eligibility,
  geometryEpoch: 1,
});
const fixtures = [
  {
    name: "static-pointing",
    durationUs: 12_000_000,
    screen: () => false,
    truth: [
      {
        kind: "circle",
        range: [500_000, 1_800_000],
        target: "FREE PLAN",
        description: "One full circle on an unchanged screen",
      },
      {
        kind: "wave",
        range: [3_000_000, 4_500_000],
        target: "UPGRADE",
        description: "Two horizontal waves on an unchanged screen",
      },
      {
        kind: "still",
        range: [4_500_000, 12_000_000],
        description: "Observed stationary pointer after the wave",
      },
    ],
    cursor(t) {
      if (t < 500_000) return point(t, 610, 360);
      if (t <= 1_800_000) {
        const angle = ((t - 500_000) / 1_300_000) * Math.PI * 2;
        return point(t, 490 + 120 * Math.cos(angle), 360 + 120 * Math.sin(angle));
      }
      if (t < 3_000_000) return point(t, 610, 360);
      if (t <= 4_500_000) {
        const progress = (t - 3_000_000) / 1_500_000;
        return point(t, 750 + 300 * progress, 472 + 35 * Math.sin(progress * Math.PI * 4));
      }
      return point(t, 1050, 472);
    },
  },
  {
    name: "stillness",
    durationUs: 16_000_000,
    screen: () => false,
    truth: [
      {
        kind: "still",
        range: [0, 16_000_000],
        description: "Identical clean page and known outside pointer throughout",
      },
    ],
    cursor: (t) => point(t, null, null, 0, "outside"),
  },
  {
    name: "navigation",
    durationUs: 10_000_000,
    screen: (t) => t >= 3_000_000 && t < 6_000_000,
    truth: [
      { kind: "scene", atSourceUs: 3_000_000, description: "Screen A changes to Screen B" },
      { kind: "scene", atSourceUs: 6_000_000, description: "Screen B changes back to Screen A" },
    ],
    cursor: (t) => point(t, 880, 472),
  },
  {
    name: "rapid-clicks",
    durationUs: 6_000_000,
    screen: () => false,
    truth: [1_000_000, 1_200_000, 1_400_000].map((atSourceUs) => ({
      kind: "button-down",
      atSourceUs,
      description: "Press on UPGRADE; releases 75 ms later",
    })),
    cursor: (t) =>
      point(
        t,
        880,
        472,
        [1_000_000, 1_200_000, 1_400_000].some((start) => t >= start && t < start + 75_000) ? 1 : 0,
      ),
  },
  {
    name: "edited-join",
    durationUs: 12_000_000,
    screen: (t) => t >= 6_000_000,
    cut: [{ startUs: 3_000_000, endUs: 7_000_000 }],
    retained: [
      { source: { startUs: 0, endUs: 3_000_000 }, playback: { startUs: 0, endUs: 3_000_000 } },
      {
        source: { startUs: 7_000_000, endUs: 12_000_000 },
        playback: { startUs: 3_000_000, endUs: 8_000_000 },
      },
    ],
    truth: [
      {
        kind: "cut",
        removed: [3_000_000, 7_000_000],
        description: "Join source 3 seconds directly to source 7 seconds",
      },
      {
        kind: "wave",
        range: [7_300_000, 8_500_000],
        target: "UPGRADE",
        description: "Retained pointing after the edited join",
      },
    ],
    cursor(t) {
      const progress = Math.max(0, Math.min(1, (t - 7_300_000) / 1_200_000));
      return point(t, 760 + progress * 280, 472 + 30 * Math.sin(progress * Math.PI * 4));
    },
  },
  {
    name: "rapid-scene-stress",
    durationUs: 4_000_000,
    screen: (t) => Math.floor(t / 250_000) % 2 === 1,
    truth: [
      {
        kind: "rapid-scene-stress",
        range: [0, 4_000_000],
        intervalUs: 250_000,
        description:
          "Every encoded frame alternates the full page; deliberately exposes mandatory boundary density",
      },
    ],
    cursor: (t) => point(t, null, null, 0, "outside"),
  },
  {
    name: "continuous-motion",
    durationUs: 10_000_000,
    truth: [
      {
        kind: "continuous-motion",
        range: [0, 10_000_000],
        region: { x: 270, y: 650, width: 920, height: 90 },
        description:
          "A coral marker follows a smooth five-second horizontal sine path inside the lower panel; the rest of Screen A remains unchanged",
      },
    ],
    cursor: (t) => point(t, null, null, 0, "outside"),
    render(t) {
      const canvas = raster(width, height);
      page(false).copy(canvas.rgb);
      const x = Math.round(700 + 340 * Math.sin((t / 5_000_000) * Math.PI * 2));
      canvas.rect(x - 30, 665, 60, 60, [225, 91, 59]);
      canvas.rect(x - 21, 674, 42, 42, [255, 220, 173]);
      return canvas.rgb;
    },
  },
];

async function fixture(home, spec) {
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "synthetic index lab",
    newId: randomUUID,
  });
  const take = store.allocate().recording;
  store.ingestLifecycle(take.recordingId, {
    sourceId: take.sourceId,
    sequence: 1,
    state: "interrupted",
    reason: "generated screenshot index fixture",
    sourceDurationUs: spec.durationUs,
  });
  store.close();
  const source = join(home, "recordings", take.recordingId, "source");
  await mkdir(source, { recursive: true });
  for (const [name, changed] of [
    ["a", false],
    ["b", true],
  ])
    await writeFile(join(home, `${name}.ppm`), ppm(page(changed)));
  const count = spec.durationUs / 250_000;
  const paths = [];
  for (let i = 0; i < count; i++) {
    const path = join(
      home,
      spec.render ? `motion-${i}.ppm` : spec.screen(i * 250_000) ? "b.ppm" : "a.ppm",
    );
    if (spec.render) await writeFile(path, ppm(spec.render(i * 250_000)));
    paths.push(path);
  }
  const concat = [...paths, paths.at(-1)].map((path) => `file '${path}'\nduration 0.25`).join("\n");
  await writeFile(join(home, "frames.txt"), concat + "\n");
  const video = join(source, "video.mov");
  ffmpeg([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    join(home, "frames.txt"),
    "-r",
    "4",
    "-fps_mode",
    "cfr",
    "-frames:v",
    String(count),
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "2",
    "-preset",
    "ultrafast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-bf",
    "0",
    video,
  ]);
  const probe = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "json",
      video,
    ]),
  );
  assert.deepEqual(
    probe.frames.map((f) => Math.round(Number(f.pts_time) * 1_000_000)),
    Array.from({ length: count }, (_, i) => i * 250_000),
  );
  const samples = Array.from({ length: spec.durationUs / 25_000 }, (_, i) =>
    spec.cursor(i * 25_000),
  );
  // Global coordinates remain finite even when the pointer is known to be outside.
  for (const sample of samples) {
    sample.globalX ??= -10;
    sample.globalY ??= -10;
  }
  const journal = join(source, "capture.journal.jsonl");
  await writeFile(
    journal,
    journalRows({ sourceId: take.sourceId, width, height, samples })
      .map((row, i) => JSON.stringify({ sequence: i + 1, ...row }))
      .join("\n") + "\n",
  );
  return {
    take,
    video,
    journal,
    hashes: { video: hash(await readFile(video)), journal: hash(await readFile(journal)) },
  };
}

async function saveFrame(call, reference, output) {
  const result = await call("index.frame", reference);
  const chunks = [];
  let offset = 0;
  try {
    for (;;) {
      const chunk = await call("artifact.read", {
        token: result.delivery.token,
        offset,
        maxBytes: 524288,
      });
      const bytes = Buffer.from(chunk.data, "base64");
      chunks.push(bytes);
      offset += bytes.length;
      assert.ok(offset <= 32 * 1024 * 1024, "Selected PNG exceeds delivery bound");
      if (chunk.eof) break;
      assert.ok(bytes.length > 0, "Image delivery must progress");
    }
  } finally {
    await call("artifact.close", { token: result.delivery.token });
  }
  const bytes = Buffer.concat(chunks);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await writeFile(output, bytes);
  return { bytes: bytes.length, sha256: hash(bytes), frame: result.published.frame };
}

async function sheets(directory, entries) {
  const files = [];
  for (let start = 0; start < entries.length; start += 6) {
    const batch = entries.slice(start, start + 6),
      rows = Math.ceil(batch.length / 2);
    const canvas = raster(1280, rows * 450);
    canvas.rect(0, 0, 1280, rows * 450, [239, 243, 248]);
    for (const [i, entry] of batch.entries()) {
      const rgb = ffmpeg([
        "-i",
        join(directory, entry.image),
        "-vf",
        "scale=640:400",
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ]);
      assert.equal(rgb.length, 640 * 400 * 3);
      const left = (i % 2) * 640,
        top = Math.floor(i / 2) * 450;
      for (let row = 0; row < 400; row++)
        rgb.copy(canvas.rgb, ((top + row) * 1280 + left) * 3, row * 640 * 3, (row + 1) * 640 * 3);
      canvas.text(
        `${entry.candidate.ordinal} SRC ${seconds(entry.candidate.requestedSourceUs)} ACT ${seconds(entry.frame.actualSourceUs)}`,
        left + 12,
        top + 409,
        2,
        [21, 34, 53],
      );
      const reasons = [...new Set(entry.candidate.reasons.map((r) => r.kind))]
        .join(" ")
        .toUpperCase();
      canvas.text(
        `EDIT ${seconds(entry.candidate.requestedPlaybackUs)} COV ${entry.coverageCount} ${reasons}`.slice(
          0,
          49,
        ),
        left + 12,
        top + 432,
        2,
        [46, 72, 100],
      );
    }
    const name = `contact-${String(files.length + 1).padStart(2, "0")}.png`;
    const input = join(directory, "contact.ppm");
    await writeFile(input, ppm(canvas.rgb, 1280, rows * 450));
    ffmpeg(["-i", input, "-frames:v", "1", join(directory, name)]);
    await rm(input);
    files.push(name);
  }
  return files;
}

async function focusCrops(directory, spec, entries) {
  if (spec.name !== "static-pointing") return [];
  const crops = [];
  for (const [kind, region] of [
    ["circle", { x: 320, y: 220, width: 400, height: 320 }],
    ["wave", { x: 580, y: 320, width: 550, height: 230 }],
  ]) {
    const truth = spec.truth.find((item) => item.kind === kind);
    const selected = entries.findLast(
      (entry) =>
        entry.candidate.requestedSourceUs >= truth.range[0] &&
        entry.candidate.requestedSourceUs <= truth.range[1] + 100_000 &&
        entry.candidate.reasons.some((reason) => reason.kind === "cursor-motion"),
    );
    if (!selected) continue;
    const image = `focus-${kind}.png`;
    ffmpeg([
      "-i",
      join(directory, selected.image),
      "-vf",
      `crop=${region.width}:${region.height}:${region.x}:${region.y}`,
      "-frames:v",
      "1",
      join(directory, image),
    ]);
    crops.push({ kind, image, region, ordinal: selected.candidate.ordinal });
  }
  return crops;
}

function checks(spec, entries, coverage) {
  const reasons = entries.flatMap((e) => e.candidate.reasons);
  const retained = spec.retained ?? [
    {
      source: { startUs: 0, endUs: spec.durationUs },
      playback: { startUs: 0, endUs: spec.durationUs },
    },
  ];
  const result = {
    retainedFramesValid:
      entries.length > 0 &&
      entries.every((entry) => {
        const time = entry.candidate.requestedSourceUs;
        const span = retained.find(
          (span) => time >= span.source.startUs && time < span.source.endUs,
        );
        return (
          span &&
          entry.candidate.requestedPlaybackUs ===
            span.playback.startUs + time - span.source.startUs &&
          entry.frame.actualSourceUs >= span.source.startUs &&
          entry.frame.actualSourceUs < span.source.endUs &&
          entry.frame.actualPlaybackUs ===
            span.playback.startUs + entry.frame.actualSourceUs - span.source.startUs
        );
      }),
    retainedCoverageValid:
      coverage.length > 0 &&
      coverage.every((row) =>
        retained.some(
          (span) =>
            row.source.startUs >= span.source.startUs &&
            row.source.endUs <= span.source.endUs &&
            row.source.endUs > row.source.startUs &&
            row.playback.startUs ===
              span.playback.startUs + row.source.startUs - span.source.startUs &&
            row.playback.endUs === span.playback.startUs + row.source.endUs - span.source.startUs,
        ),
      ),
    firstLast: reasons.some((r) => r.kind === "first") && reasons.some((r) => r.kind === "last"),
    coverageContiguous:
      coverage.length > 0 &&
      coverage.every((row, i) =>
        i === 0
          ? row.playback.startUs === 0
          : row.playback.startUs === coverage[i - 1].playback.endUs,
      ),
    coverageEndUs: coverage.at(-1)?.playback.endUs,
    uniqueActualSourceTimes: new Set(entries.map((entry) => entry.frame.actualSourceUs)).size,
    uniqueRenderedImages: new Set(entries.map((entry) => entry.sha256)).size,
    expectedPlaybackDurationUs:
      spec.durationUs -
      (spec.cut ?? []).reduce((sum, range) => sum + range.endUs - range.startUs, 0),
    coverageComplete:
      coverage.at(-1)?.playback.endUs ===
      spec.durationUs -
        (spec.cut ?? []).reduce((sum, range) => sum + range.endUs - range.startUs, 0),
  };
  const sceneTimes =
    spec.name === "rapid-scene-stress"
      ? Array.from({ length: 15 }, (_, i) => (i + 1) * 250_000)
      : spec.truth.filter((item) => item.kind === "scene").map((item) => item.atSourceUs);
  result.transitions = sceneTimes.map((atSourceUs, i) => {
    const selected = (side) =>
      entries.find((entry) =>
        entry.candidate.reasons.some(
          (reason) =>
            reason.kind === "scene" && reason.eventSourceUs === atSourceUs && reason.side === side,
        ),
      );
    const before = selected("before"),
      after = selected("after");
    return {
      atSourceUs,
      before: !!before,
      after: !!after,
      beforeActualSourceUs: before?.frame.actualSourceUs ?? null,
      afterActualSourceUs: after?.frame.actualSourceUs ?? null,
      beforeFrameMatches:
        !!before &&
        before.frame.actualSourceUs < atSourceUs &&
        before.frame.actualSourceUs >= (sceneTimes[i - 1] ?? 0),
      afterFrameMatches:
        !!after &&
        after.frame.actualSourceUs >= atSourceUs &&
        after.frame.actualSourceUs < (sceneTimes[i + 1] ?? spec.durationUs),
    };
  });
  if (spec.name === "stillness") result.onlyMandatoryEndpoints = entries.length === 2;
  if (spec.name === "static-pointing")
    result.gestures = spec.truth
      .filter((t) => ["circle", "wave"].includes(t.kind))
      .map((t) => ({
        kind: t.kind,
        selected: entries.some(
          (e) =>
            e.candidate.requestedSourceUs >= t.range[0] &&
            e.candidate.requestedSourceUs <= t.range[1] + 100_000 &&
            e.candidate.reasons.some((r) => r.kind === "cursor-motion"),
        ),
      }));
  if (spec.name === "rapid-clicks")
    result.clicks = spec.truth.map((t) => ({
      atSourceUs: t.atSourceUs,
      selected: reasons.some((r) => r.kind === "button-down" && r.eventSourceUs === t.atSourceUs),
    }));
  if (["rapid-scene-stress", "continuous-motion"].includes(spec.name))
    result.density = {
      candidatesPerSecond: entries.length / (spec.durationUs / 1_000_000),
      sceneReasonCount: reasons.filter((r) => r.kind === "scene").length,
      note: "Mandatory transitions are retained without contact-sheet thinning",
    };
  return result;
}

test("generated index contact sheets and independent event ledger", async () => {
  const output = process.env.SCREENREC_INDEX_EVIDENCE
    ? resolve(process.env.SCREENREC_INDEX_EVIDENCE)
    : await mkdtemp("/tmp/screenrec-index-evidence-");
  await mkdir(output, { recursive: true });
  assert.equal(
    (await readdir(output)).length,
    0,
    "Use an empty evidence directory to preserve earlier runs",
  );
  const results = [];
  const provenance = {
    synthetic: true,
    hardware: { cpu: cpus()[0]?.model, platform: platform(), release: release(), arch: arch() },
    bundledServiceSha256: hash(
      await readFile(
        new URL(
          "../../../dist/ScreenRecorder.app/Contents/Resources/service/main.mjs",
          import.meta.url,
        ),
      ),
    ),
    node: process.version,
    revision: run("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    ffmpeg: run("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0],
    width,
    height,
    encodedFrameStepUs: 250_000,
    cursorStepUs: 25_000,
  };
  await writeFile(
    join(output, "truth.json"),
    JSON.stringify(
      {
        ...provenance,
        fixtures: fixtures.map(({ name, durationUs, truth, cut, retained }) => ({
          name,
          durationUs,
          truth,
          cut: cut ?? [],
          retained: retained ?? null,
        })),
      },
      null,
      2,
    ) + "\n",
  );
  for (const spec of fixtures) {
    const directory = join(output, spec.name);
    await mkdir(directory, { recursive: true });
    const home = temporary(`/tmp/scr-index-${spec.name}-`),
      source = await fixture(home, spec);
    const { instance } = await launchReady(home);
    const call = async (operation, params) => {
      const response = await callLocal(socketPath(home), { id: randomUUID(), operation, params });
      assert.equal(response.ok, true, JSON.stringify(response));
      return response.data;
    };
    try {
      let revisionId = "r0";
      if (spec.cut) {
        const edited = await call("edit.cut", {
          recordingId: source.take.recordingId,
          expectedRevisionId: "r0",
          requestId: randomUUID(),
          ranges: spec.cut,
        });
        revisionId = edited.revision.id;
      }
      const started = performance.now();
      let response = await waitFor(async () => {
        const status = await call("index.get", {
          recordingId: source.take.recordingId,
          revisionId,
          limit: 3,
        });
        if (["failed", "unavailable"].includes(status.state))
          throw new Error(JSON.stringify(status));
        return status.state === "ready" && status;
      }, 120_000);
      const reference = {
        recordingId: response.recordingId,
        revisionId: response.revisionId,
        generation: response.generation,
      };
      const entries = [],
        coverage = [];
      const metadata = response.page.metadata;
      let previousOrdinal = -1,
        entryPages = 0;
      for (;;) {
        assert.ok(++entryPages <= 500, "Candidate page budget exceeded");
        assert.ok(response.page.entries.length <= 3);
        for (const entry of response.page.entries) {
          assert.equal(
            entry.candidate.ordinal,
            entries.length,
            "Candidate pages preserve every ordinal",
          );
          assert.ok(
            entries.length < 500,
            "Fixture exceeds the explicit image budget; inspect density instead of truncating",
          );
          const image = `selected-${String(entry.candidate.ordinal).padStart(3, "0")}.png`;
          const delivered = await saveFrame(call, entry.reference, join(directory, image));
          assert.deepEqual([delivered.frame.width, delivered.frame.height], [width, height]);
          entries.push({ ...entry, ...delivered, image });
        }
        if (!response.page.nextCursor) break;
        assert.ok(
          response.page.entries.length > 0 &&
            response.page.nextCursor.afterOrdinal > previousOrdinal,
          "Candidate continuation must progress",
        );
        previousOrdinal = response.page.nextCursor.afterOrdinal;
        response = await call("index.get", {
          recordingId: source.take.recordingId,
          cursor: response.page.nextCursor,
          limit: 3,
        });
      }
      let cursor,
        coveragePages = 0;
      do {
        assert.ok(++coveragePages <= 500, "Coverage page budget exceeded");
        const page = await call("index.coverage", {
          ...reference,
          limit: 2,
          ...(cursor ? { cursor } : {}),
        });
        assert.ok(page.coverage.length <= 2);
        coverage.push(...page.coverage);
        if (page.nextCursor)
          assert.ok(
            page.coverage.length > 0 &&
              page.nextCursor.afterSequence > (cursor?.afterSequence ?? -1),
            "Coverage continuation must progress",
          );
        cursor = page.nextCursor;
      } while (cursor);
      assert.equal(entries.length, metadata.candidateCount, "Candidate paging is complete");
      assert.equal(coverage.length, metadata.coverageCount, "Coverage paging is complete");
      const elapsedMs = performance.now() - started;
      const sourceHashes = {
        video: hash(await readFile(source.video)),
        journal: hash(await readFile(source.journal)),
      };
      assert.deepEqual(sourceHashes, source.hashes);
      const verdict = checks(spec, entries, coverage);
      const contactSheets = await sheets(directory, entries);
      const crops = await focusCrops(directory, spec, entries);
      const record = {
        name: spec.name,
        ...reference,
        durationUs: spec.durationUs,
        metadata,
        sourceHashes,
        elapsedMs,
        selectedCount: entries.length,
        retainedBytes: entries.reduce((n, e) => n + e.bytes, 0),
        checks: verdict,
        contactSheets,
        crops,
        entries,
        coverage,
      };
      await writeFile(join(directory, "ledger.json"), JSON.stringify(record, null, 2) + "\n");
      results.push({
        name: spec.name,
        selectedCount: entries.length,
        elapsedMs,
        retainedBytes: record.retainedBytes,
        checks: verdict,
        contactSheets,
        crops,
      });
      console.log(
        JSON.stringify({ fixture: spec.name, selected: entries.length, checks: verdict }),
      );
    } catch (error) {
      const failure = {
        name: spec.name,
        error: error instanceof Error ? error.message : String(error),
        selectedCount: null,
        contactSheets: [],
      };
      await writeFile(join(directory, "failure.json"), JSON.stringify(failure, null, 2) + "\n");
      results.push(failure);
      console.error(JSON.stringify(failure));
    } finally {
      assert.deepEqual(await instance.reap(), []);
    }
  }
  await writeFile(
    join(output, "summary.json"),
    JSON.stringify({ ...provenance, results }, null, 2) + "\n",
  );
  const pngFiles = [];
  for (const result of results)
    for (const file of await readdir(join(output, result.name)))
      if (file.endsWith(".png")) pngFiles.push(`${result.name}/${file}`);
  await writeFile(
    join(output, "png-manifest.json"),
    JSON.stringify({ count: pngFiles.length, files: pngFiles.sort() }, null, 2) + "\n",
  );
  const html = `<!doctype html><meta charset="utf-8"><title>Generated screenshot index evidence</title><style>body{font:16px system-ui;background:#eef2f7;color:#172338;margin:24px;max-width:1400px}img{max-width:100%;border:1px solid #c9d1dc}section{margin:48px 0}pre{white-space:pre-wrap}a{color:#185db8}</style><h1>Generated screenshot index evidence</h1><p>Synthetic media and synthetic cursor journal. No physical capture or semantic gesture claim. Selection density and coverage are the review variables.</p><p>Caption legend: SRC = requested source time; ACT = decoded image source time; EDIT = requested playback time after cuts; COV = coverage windows referring to that image. Times are seconds with microsecond precision.</p><p><a href="truth.json">Independent fixture truth</a> · <a href="summary.json">Measurements</a></p>${results.map((r) => `<section><h2>${r.name} — ${r.selectedCount} images</h2><a href="${r.name}/ledger.json">Full reason and coverage ledger</a><pre>${JSON.stringify(r.error ?? r.checks, null, 2)}</pre>${r.contactSheets.map((file) => `<p><a href="${r.name}/${file}"><img src="${r.name}/${file}" alt="${r.name} contact sheet"></a></p>`).join("")}</section>`).join("")}`;
  await writeFile(join(output, "index.html"), html);
  console.log(`Index evidence: ${output}`);
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };
  for (const result of results) {
    if (result.error) {
      failures.push(`${result.name}: ${result.error}`);
      continue;
    }
    for (const key of [
      "firstLast",
      "coverageContiguous",
      "coverageComplete",
      "retainedFramesValid",
      "retainedCoverageValid",
    ])
      check(result.checks[key], `${result.name}: ${key}`);
    if (result.checks.onlyMandatoryEndpoints !== undefined)
      check(
        result.checks.onlyMandatoryEndpoints,
        "stillness: identical page should collapse to mandatory endpoints",
      );
    for (const transition of result.checks.transitions) {
      check(
        transition.before && transition.beforeFrameMatches,
        `${result.name}: before scene ${transition.atSourceUs} decoded ${transition.beforeActualSourceUs}`,
      );
      check(
        transition.after && transition.afterFrameMatches,
        `${result.name}: after scene ${transition.atSourceUs} decoded ${transition.afterActualSourceUs}`,
      );
    }
    for (const item of [...(result.checks.gestures ?? []), ...(result.checks.clicks ?? [])])
      check(item.selected, `${result.name}: ${JSON.stringify(item)}`);
  }
  assert.deepEqual(failures, [], "Generated index quality gates must pass");
});
