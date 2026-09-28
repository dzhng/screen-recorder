import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { hash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rename,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { RevisionStore } from "@screenrec/core/library";
import { JobQueue, recordingJobTargets } from "@screenrec/core/jobs";
import { SourceEvidenceStore, recordingEvidenceOwner } from "@screenrec/core/evidence";
import { SourceProcessing } from "@screenrec/core/processing";
import {
  SceneEvidenceStore,
  recordingSceneOwner,
  recordingSceneIdentity,
} from "@screenrec/core/scene-evidence";
import { SceneProcessing } from "@screenrec/core/scene-processing";
import { ScreenshotIndexStore, recordingIndexDomain } from "@screenrec/core/screenshot-index";
import { IndexProcessing } from "@screenrec/core/index-processing";
import { FileSourceEvidence, writeSourceEvidencePages } from "@screenrec/core/evidence-pages";
import { FileSceneEvidence, writeSceneEvidencePages } from "@screenrec/core/scene-pages";
import { FileScreenshotIndex, writeScreenshotIndexPages } from "@screenrec/core/index-pages";
import { materializeFrame } from "@screenrec/core/frame-materialization";
import { planAudioExcerpt } from "@screenrec/core/audio";
import { parseRevisionHistory, sourceToEdited } from "@screenrec/core/timeline";
import { mediaWorker } from "../../service/dist/worker.js";
import { page, width, height, journalRows } from "./fixtures/generated-capture.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const lifetime = new AbortController();
const signal = () => lifetime.signal;
function command(name, args, input) {
  const result = spawnSync(name, args, {
    cwd: repository,
    input,
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
function native(executable) {
  const worker = mediaWorker({ SCREENREC_NATIVE: executable });
  let calls = 0;
  const run = async (operation, params, signal) => {
    const result = await worker(operation, params, { signal });
    assert.equal(result.ok, true, JSON.stringify(result));
    calls++;
    return result.data;
  };
  return {
    run,
    decode: (params, signal) => run("media.frame", params, signal),
    sample: ({ source, kept, atSourceUs }, signal) =>
      run("media.visualSamples", { source, kept, atSourceUs }, signal),
    calls: () => calls,
  };
}
async function hashes(root) {
  const result = {};
  async function visit(relative) {
    for (const name of (await readdir(join(root, relative))).sort()) {
      const path = join(relative, name),
        info = await stat(join(root, path));
      if (info.isDirectory()) await visit(path);
      else result[path] = hash("sha256", await readFile(join(root, path)));
    }
  }
  await visit("");
  return result;
}
export async function inspect(context, root, readers, media, output) {
  await mkdir(output, { recursive: true });
  const history = parseRevisionHistory(context.history, 500),
    revision = history.find((row) => row.id === context.snapshot.revisionId);
  assert.ok(revision);
  const frames = [];
  for (const [i, request] of context.requests.entries()) {
    const selectedRevision = history.find((row) => row.id === (request.revisionId ?? revision.id));
    assert.ok(selectedRevision);
    const frame = await materializeFrame(
      {
        recordingId: context.snapshot.recordingId,
        sourceId: context.snapshot.sourceId,
        revision: selectedRevision,
        source: join(root, context.assets.video),
        output: join(output, `${i}.png`),
        atUs: request.atUs,
        clean: request.clean,
        maxLongEdge: 1600,
        crop: null,
        trailUs: 2_000_000,
        sourceEvidence: context.source,
      },
      { decode: media.decode, sample: media.sample, evidence: readers.source },
      signal(),
    );
    const { file, ...metadata } = frame;
    const imageBytes = media.readOutput ? await media.readOutput(file) : await readFile(file);
    const pixels = command(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "pipe:1",
      ],
      imageBytes,
    );
    frames.push({ metadata, png: hash("sha256", imageBytes), pixels: hash("sha256", pixels) });
  }
  const plan = planAudioExcerpt(
    {
      ...context.snapshot,
      revision,
      range: { startUs: 250_000, endUs: 2_750_000 },
      track: "mix",
      sourceEvidence: context.source,
    },
    readers.source,
    (role) => join(root, context.assets[role]),
  );
  const audio = await media.run(
    "media.audio",
    { tracks: plan.tracks, spans: plan.spans, output: join(output, "excerpt.wav") },
    signal(),
  );
  const { file, ...audioMetadata } = audio;
  const index = readers.index.page({ identity: context.index, limit: 200 }),
    images = [];
  assert.equal(index.nextOrdinal, null, "Small fixture must fit one retained image page");
  for (const entry of index.entries) {
    const read = readers.index.openRead(context.index, entry.candidate.ordinal);
    try {
      const buffer = Buffer.alloc(read.bytes);
      assert.equal(read.read(buffer, 0), read.bytes);
      images.push(hash("sha256", buffer));
    } finally {
      read.release();
    }
  }
  return {
    frames,
    audio: {
      metadata: audioMetadata,
      sha256: hash(
        "sha256",
        media.readOutput ? await media.readOutput(file) : await readFile(file),
      ),
      spans: plan.spans,
      missingRoles: plan.missingRoles,
    },
    index: {
      metadata: index.metadata,
      entries: index.entries.map((entry) => {
        const { file, ...frame } = entry.frame;
        assert.ok(file);
        return { ...entry, frame };
      }),
      images,
    },
    coverage: readers.index.coveragePage({ identity: context.index, limit: 200 }),
    scenes: readers.scenes.page({ identity: recordingSceneIdentity(context.scenes) }),
    history,
  };
}
export async function relocatedReader(root, output, executable) {
  const context = JSON.parse(await readFile(join(root, "context.json"), "utf8")),
    media = native(executable);
  const revision = parseRevisionHistory(context.history, 500).find(
    (row) => row.id === context.snapshot.revisionId,
  );
  const result = await inspect(
    context,
    root,
    {
      source: new FileSourceEvidence(join(root, "source-pages"), context.source),
      scenes: new FileSceneEvidence(
        join(root, "scene-pages"),
        recordingSceneIdentity(context.scenes),
      ),
      index: new FileScreenshotIndex(join(root, "index-pages"), context.index, revision),
    },
    media,
    output,
  );
  await writeFile(
    join(output, "result.json"),
    JSON.stringify({ result, nativeCalls: media.calls() }),
  );
}
async function childReader(root, output, executable) {
  signal().throwIfAborted();
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "--reader", root, output, executable],
    { stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let diagnostics = "";
  child.stdout.on("data", (bytes) => {
    diagnostics = (diagnostics + bytes).slice(-65536);
  });
  child.stderr.on("data", (bytes) => {
    diagnostics = (diagnostics + bytes).slice(-65536);
  });
  const stopOwnedGroup = () => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const timeout = globalThis.setTimeout(stopOwnedGroup, 60_000);
  signal().addEventListener("abort", stopOwnedGroup, { once: true });
  let terminal;
  try {
    terminal = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ pid: child.pid, code, signal }));
    });
  } finally {
    clearTimeout(timeout);
    signal().removeEventListener("abort", stopOwnedGroup);
  }
  const groupExists = () => {
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      throw error;
    }
  };
  const residualGroup = groupExists();
  if (residualGroup) {
    stopOwnedGroup();
    const deadline = Date.now() + 3000;
    while (groupExists() && Date.now() < deadline) await setTimeout(10);
    assert.equal(groupExists(), false, "Owned reader group failed to close");
  }
  assert.equal(residualGroup, false, "Reader left an owned process running");
  terminal.groupReaped = true;
  assert.equal(terminal.code, 0, diagnostics);
  return terminal;
}
export function registerRelocationTest({
  reader = childReader,
  beforeLibraryRemoval,
  afterLibraryClose,
  narration = true,
  executable: selectedExecutable,
  evidenceScope = "Generated internal directory relocation; no ZIP/public package or ASR readiness claim",
} = {}) {
  test(
    "generated package inspection survives relocation without its library",
    { timeout: 180_000 },
    async (t) => {
      t.signal.addEventListener("abort", () => lifetime.abort(t.signal.reason), { once: true });
      const bundle = process.env.SCREENREC_RELOCATION_BUNDLE;
      assert.ok(
        selectedExecutable || (bundle && isAbsolute(bundle)),
        "SCREENREC_RELOCATION_BUNDLE must name an isolated built app",
      );
      const executable = selectedExecutable ?? join(bundle, "Contents/MacOS/screenrec-native"),
        media = native(executable);
      const root = await mkdtemp(join(tmpdir(), "screenrec-relocation-")),
        original = join(root, "original"),
        portable = join(root, "portable"),
        baseline = join(root, "baseline"),
        moved = join(root, "moved"),
        output = join(root, "inspection");
      let store, jobs;
      try {
        await mkdir(original);
        await mkdir(portable);
        store = new RevisionStore(join(original, "library.sqlite"), {
          now: () => new Date().toISOString(),
          newId: randomUUID,
        });
        const take = store.allocate().recording;
        store.ingestLifecycle(take.recordingId, {
          sourceId: take.sourceId,
          sequence: 1,
          state: "interrupted",
          reason: "generated relocation fixture",
          sourceDurationUs: 4_000_000,
        });
        const source = join(original, "recordings", take.recordingId, "source");
        await mkdir(source, { recursive: true, mode: 0o700 });
        for (const [name, changed] of [
          ["a", false],
          ["b", true],
        ])
          await writeFile(
            join(root, `${name}.ppm`),
            Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), page(changed)]),
          );
        command("ffmpeg", [
          "-v",
          "error",
          "-loop",
          "1",
          "-framerate",
          "10",
          "-t",
          "2",
          "-i",
          join(root, "a.ppm"),
          "-loop",
          "1",
          "-framerate",
          "10",
          "-t",
          "2",
          "-i",
          join(root, "b.ppm"),
          "-filter_complex",
          "[0:v][1:v]concat=n=2:v=1:a=0,select='eq(n,0)+eq(n,1)+eq(n,2)+eq(n,10)+eq(n,20)+eq(n,21)+eq(n,22)+eq(n,26)+eq(n,30)+eq(n,39)'[v]",
          "-map",
          "[v]",
          "-fps_mode",
          "vfr",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-video_track_timescale",
          "1000000",
          join(source, "video.mov"),
        ]);
        for (const [role, frequency] of [
          ["narration", 1000],
          ["system", 400],
        ].filter(([role]) => narration || role !== "narration"))
          command("ffmpeg", [
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            `sine=frequency=${frequency}:sample_rate=48000:duration=4`,
            "-c:a",
            "pcm_f32le",
            join(source, `${role}.mov`),
          ]);
        const samples = Array.from({ length: 81 }, (_, i) => ({
          sourceUs: i * 50_000,
          x: 700 + Math.cos(i / 5) * 60,
          y: 400 + Math.sin(i / 5) * 60,
          globalX: 700 + Math.cos(i / 5) * 60,
          globalY: 400 + Math.sin(i / 5) * 60,
          buttons: 0,
          eligibility: "inside",
          geometryEpoch: i * 50_000 < 2_600_000 ? 1 : 2,
        }));
        const rows = journalRows({
          sourceId: take.sourceId,
          width,
          height,
          samples,
          pauses: [{ atSourceUs: 3_000_000, elapsedPauseUs: 400_000 }],
        });
        rows[0].data.microphone = narration;
        rows[0].data.systemAudio = true;
        rows.splice(3, 0, {
          event: "geometry",
          data: { ...rows[2].data, epoch: 2, sourceUs: 2_600_000, hostUs: 3_600_000 },
        });
        rows.splice(
          rows.length - 1,
          0,
          ...(narration
            ? [
                { role: "narration", startUs: 0, endUs: 2_500_000 },
                { role: "narration", startUs: 3_000_000, endUs: 4_000_000 },
                { role: "system", startUs: 0, endUs: 4_000_000 },
              ]
            : [
                { role: "system", startUs: 0, endUs: 2_500_000 },
                { role: "system", startUs: 3_000_000, endUs: 4_000_000 },
              ]
          ).map((data) => ({ event: "audioSamples", data })),
        );
        await writeFile(
          join(source, "capture.journal.jsonl"),
          rows.map((row, i) => JSON.stringify({ sequence: i + 1, ...row }) + "\n").join(""),
        );
        const sourceHashes = await hashes(source);
        const revision = store.edit(take.recordingId, {
          requestId: randomUUID(),
          expectedRevisionId: "r0",
          operation: "cut",
          ranges: [{ startUs: 500_000, endUs: 1_000_000 }],
        });
        store.edit(take.recordingId, {
          requestId: randomUUID(),
          expectedRevisionId: revision.id,
          operation: "trim",
          range: { startUs: 0, endUs: 1_000_000 },
        });
        const sourceEvidence = new SourceEvidenceStore(store, recordingEvidenceOwner(store)),
          sceneEvidence = new SceneEvidenceStore(store, recordingSceneOwner(store)),
          index = new ScreenshotIndexStore(store, original, recordingIndexDomain(store));
        let processing, scenes, indexing;
        jobs = new JobQueue({
          store,
          targets: recordingJobTargets(store),
          providers: { newId: randomUUID },
          execute: (execution) =>
            ({
              "source-evidence": processing,
              "source-scenes": scenes,
              "screenshot-index": indexing,
            })[execution.job.artifact].execute(execution),
        });
        processing = new SourceProcessing(
          store,
          jobs,
          sourceEvidence,
          original,
          (directory, output, signal) =>
            media.run("media.sourceEvidence", { directory, output }, signal),
        );
        scenes = new SceneProcessing({
          jobs,
          evidence: sceneEvidence,
          recording: { store, home: original, sample: media.sample },
        });
        indexing = new IndexProcessing({
          jobs: jobs,
          recording: {
            store: store,
            index: index,
            source: processing,
            scenes: scenes,
            evidence: { source: sourceEvidence, scenes: sceneEvidence },
            home: original,
            render: { decode: media.decode, sample: media.sample },
          },
        });
        let ready;
        const deadline = Date.now() + 60_000;
        for (;;) {
          signal().throwIfAborted();
          ready = indexing.request({ recordingId: take.recordingId, revisionId: revision.id });
          if (ready.published) break;
          assert.ok(!["failed", "unavailable"].includes(ready.state), JSON.stringify(ready));
          assert.ok(Date.now() < deadline, "Index deadline");
          await setTimeout(10);
        }
        await jobs.close();
        jobs = undefined;
        const sourceMetadata = processing.status(take.recordingId).published.evidence,
          sceneMetadata = scenes.status(take.recordingId).published.evidence,
          indexMetadata = ready.published.evidence;
        const selected = new Set(
          index
            .page({ identity: indexMetadata, limit: 200 })
            .entries.map((entry) => entry.candidate.requestedSourceUs),
        );
        const newTime = [2_350_000, 2_360_000, 2_370_000].find((time) => !selected.has(time));
        assert.ok(newTime);
        const pin = store.pinPackageSnapshot(take.recordingId, revision.id);
        const context = {
          snapshot: pin.snapshot,
          history: store.history(take.recordingId, pin.historyCursor).revisions,
          source: {
            ...sourceMetadata,
            receipt: { ...sourceMetadata.receipt, file: "source/normalized.jsonl" },
          },
          scenes: sceneMetadata,
          index: indexMetadata,
          assets: {
            video: "source/video.mov",
            narration: "source/narration.mov",
            system: "source/system.mov",
          },
          requests: [
            { atUs: sourceToEdited(revision, newTime), clean: false },
            { atUs: sourceToEdited(revision, newTime), clean: true },
            { atUs: sourceToEdited(revision, 3_200_000), clean: false },
            { revisionId: "r0", atUs: 750_000, clean: true },
          ],
        };
        assert.equal(context.history.length, 3);
        const libraryContext = {
          ...context,
          assets: Object.fromEntries(
            ["video", "narration", "system"].map((role) => [
              role,
              relative(original, join(source, `${role}.mov`)),
            ]),
          ),
        };
        const expected = await inspect(
          libraryContext,
          original,
          { source: sourceEvidence, scenes: sceneEvidence, index },
          media,
          baseline,
        );
        assert.ok(
          expected.frames[0].metadata.annotation.trailPoints > 0,
          "Relocation proof needs a visible trail",
        );
        assert.ok(
          expected.frames[0].metadata.annotation.cutoffs.some((row) => row.reason === "scene"),
          "Trail must honor the scene change",
        );
        assert.ok(
          expected.frames[2].metadata.distanceUs > 0,
          "Sparse fixture must select a different actual timestamp",
        );
        assert.ok(
          expected.frames[2].metadata.annotation.cutoffs.some((row) => row.reason === "pause"),
        );
        assert.deepEqual(await hashes(source), sourceHashes);
        await mkdir(join(portable, "source"));
        for (const name of [
          "video.mov",
          "narration.mov",
          "system.mov",
          "capture.journal.jsonl",
        ].filter((name) => narration || name !== "narration.mov"))
          await copyFile(join(source, name), join(portable, "source", name));
        await copyFile(sourceMetadata.receipt.file, join(portable, "source", "normalized.jsonl"));
        await writeSourceEvidencePages(
          sourceEvidence,
          sourceMetadata,
          join(portable, "source-pages"),
        );
        await writeSceneEvidencePages(
          sceneEvidence,
          recordingSceneIdentity(sceneMetadata),
          join(portable, "scene-pages"),
        );
        await writeScreenshotIndexPages(
          index,
          indexMetadata,
          revision,
          join(portable, "index-pages"),
        );
        await writeFile(join(portable, "context.json"), JSON.stringify(context));
        await beforeLibraryRemoval?.({
          store,
          home: original,
          recordingId: take.recordingId,
          revisionId: revision.id,
        });
        store.close();
        store = undefined;
        await afterLibraryClose?.({
          home: original,
          recordingId: take.recordingId,
          revisionId: revision.id,
        });
        await rm(original, { recursive: true });
        await assert.rejects(stat(original), { code: "ENOENT" });
        await rename(portable, moved);
        const before = await hashes(moved),
          child = await reader(moved, output, executable),
          actual = JSON.parse(await readFile(join(output, "result.json"), "utf8"));
        assert.deepEqual(actual.result, expected);
        assert.deepEqual(await hashes(moved), before);
        const pcm = command("ffmpeg", [
          "-v",
          "error",
          "-i",
          join(output, "excerpt.wav"),
          "-f",
          "f32le",
          "-ac",
          "1",
          "-ar",
          "48000",
          "pipe:1",
        ]);
        const amplitude = (second, frequency) => {
          const start = Math.round(second * 48000),
            count = 4800;
          let re = 0,
            im = 0;
          for (let i = 0; i < count; i++) {
            const value = pcm.readFloatLE((start + i) * 4),
              angle = (2 * Math.PI * frequency * i) / 48000;
            re += value * Math.cos(angle);
            im += value * Math.sin(angle);
          }
          return (2 * Math.hypot(re, im)) / count;
        };
        if (narration) {
          assert.ok(amplitude(0.1, 1000) > 0.055);
          assert.ok(amplitude(1.85, 1000) < 0.001);
          assert.ok(amplitude(1.85, 400) > 0.055);
        } else {
          assert.ok(amplitude(0.1, 400) > 0.055);
          assert.ok(amplitude(1.85, 400) < 0.001);
          assert.deepEqual(actual.result.audio.missingRoles, [
            { role: "narration", reason: "not_requested" },
          ]);
        }
        if (process.env.SCREENREC_RELOCATION_EVIDENCE) {
          const evidence = process.env.SCREENREC_RELOCATION_EVIDENCE;
          await mkdir(evidence);
          for (let i = 0; i < context.requests.length; i++)
            await copyFile(join(output, `${i}.png`), join(evidence, `${i}.png`));
          await copyFile(join(output, "excerpt.wav"), join(evidence, "excerpt.wav"));
          await writeFile(
            join(evidence, "report.json"),
            JSON.stringify(
              {
                scope: evidenceScope,
                sourceCommit: command("git", ["rev-parse", "HEAD"]).toString().trim(),
                nativeSha256: hash("sha256", await readFile(executable)),
                coreSourceTreeSha256: hash(
                  "sha256",
                  Buffer.from(
                    JSON.stringify(
                      await Promise.all(
                        command("git", [
                          "ls-files",
                          "--cached",
                          "--others",
                          "--exclude-standard",
                          "--",
                          "packages/core/src",
                          "apps/service/src/worker.ts",
                          "apps/macos/tests/package-relocation.mjs",
                        ])
                          .toString()
                          .trim()
                          .split("\n")
                          .sort()
                          .map(async (path) => [
                            path,
                            hash("sha256", await readFile(join(repository, path))),
                          ]),
                      ),
                    ),
                  ),
                ),
                originalInputsUnchanged: true,
                originalRemoved: true,
                packageInputsUnchanged: true,
                arbitraryRequestedSourceUs: newTime,
                selectedRequestedSourceUs: [...selected],
                historyCount: context.history.length,
                pinnedRevisionId: revision.id,
                nativeCalls: { before: media.calls(), relocated: actual.nativeCalls },
                readerProcess: child,
                workerClosure:
                  "Every production mediaWorker promise settled after owned child and pipe closure",
                parity: {
                  completeContext: true,
                  framePixels: true,
                  frameMetadata: true,
                  audioBytes: true,
                  retainedImages: true,
                  coverage: true,
                  sceneChunks: true,
                },
                frames: actual.result.frames,
                audio: actual.result.audio,
                index: {
                  metadata: actual.result.index.metadata,
                  imageHashes: actual.result.index.images,
                },
                coverage: {
                  rows: actual.result.coverage.coverage.length,
                  sha256: hash("sha256", Buffer.from(JSON.stringify(actual.result.coverage))),
                },
                scenes: {
                  metadata: actual.result.scenes.metadata,
                  sha256: hash("sha256", Buffer.from(JSON.stringify(actual.result.scenes))),
                },
              },
              null,
              2,
            ) + "\n",
          );
        }
      } finally {
        await jobs?.close();
        store?.close();
        await rm(root, { recursive: true, force: true });
      }
    },
  );
}
if (process.argv[2] === "--reader") {
  await relocatedReader(process.argv[3], process.argv[4], process.argv[5]);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) registerRelocationTest();
