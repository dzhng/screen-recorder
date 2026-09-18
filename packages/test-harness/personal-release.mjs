// The installed personal journey: one real narrated take, read and edited the way an external
// agent would, then exported both ways and reopened after relocation. It drives the installed
// `screenrec` CLI over the person's own library and writes its evidence to a scratch directory.
//
//   node packages/test-harness/personal-release.mjs [--recording <id>] [--out <directory>]
//
// It never deletes a recording and never edits anything but the take it names, whose edits are
// revision history a person can undo.
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    recording: { type: "string" },
    out: { type: "string" },
    cli: { type: "string", default: join(homedir(), ".local", "bin", "screenrec") },
    phrase: { type: "string", default: "this is free" },
  },
});
const out = values.out ?? mkdtempSync("/tmp/screenrec-journey-");
mkdirSync(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), steps: [] };
const step = (name, detail) => {
  report.steps.push({ name, at: new Date().toISOString(), ...detail });
  const summary = JSON.stringify(detail);
  console.log(`${name}: ${summary.length > 220 ? summary.slice(0, 220) + "…" : summary}`);
};

function call(operation, params = {}, options = {}) {
  const result = spawnSync(
    values.cli,
    [operation, "--params", JSON.stringify(params), ...(options.args ?? [])],
    { cwd: "/", encoding: "utf8", timeout: options.timeoutMs ?? 200_000 },
  );
  if (result.error) throw result.error;
  const answer = JSON.parse(result.stdout || result.stderr || "{}");
  if (!answer.ok && !options.allowFailure)
    throw new Error(`${operation} failed: ${JSON.stringify(answer.error ?? answer)}`);
  return answer.ok ? answer.data : { error: answer.error };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Media is prepared in the background: the first answer is readiness, not the file. */
async function media(operation, params, file, budgetMs = 600_000) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const answer = call(operation, params, { args: ["--output", file] });
    const items = answer.items ?? [answer];
    if (items.every((item) => (item.data ?? item).state === "ready")) return answer;
    const stopped = items.find((item) =>
      ["failed", "unavailable"].includes((item.data ?? item).state),
    );
    if (stopped) throw new Error(`${operation} ${JSON.stringify(stopped)}`);
    if (Date.now() > deadline) throw new Error(`${operation} never became ready`);
    await wait(1000);
  }
}

/** Polls one artifact's readiness, sampling the native worker's memory while it runs. */
async function ready(recordingId, artifact, budgetMs = 900_000) {
  const deadline = Date.now() + budgetMs;
  let peakResidentBytes = 0,
    startedAt;
  for (;;) {
    const status = call("processing.status", { recordingId, artifact });
    if (status.state === "ready")
      return { ...status, peakResidentBytes, elapsedMs: startedAt ? Date.now() - startedAt : 0 };
    if (["failed", "unavailable"].includes(status.state))
      throw new Error(`${artifact} is ${status.state}: ${status.reason ?? "no reason given"}`);
    startedAt ??= Date.now();
    peakResidentBytes = Math.max(peakResidentBytes, workerResidentBytes());
    if (Date.now() > deadline) throw new Error(`${artifact} did not become ready`);
    await wait(500);
  }
}

/** Resident bytes of the media worker, when one is running. */
function workerResidentBytes() {
  const listed = execFileSync("/bin/ps", ["-axo", "rss=,command="], { encoding: "utf8" });
  let peak = 0;
  for (const line of listed.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (match && match[2].includes("screenrec-native"))
      peak = Math.max(peak, Number(match[1]) * 1024);
  }
  return peak;
}

/** Every page of a paged operation, following its own continuation. */
function pages(operation, params, take = (page) => page.rows ?? page.entries ?? []) {
  const all = [];
  let cursor;
  do {
    const answer = call(operation, { ...params, ...(cursor ? { cursor } : {}) });
    const page = answer.page ?? answer;
    all.push(...take(page));
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

const main = async () => {
  const recordingId = values.recording ?? call("recording.latest")?.recordingId;
  if (!recordingId) throw new Error("No recording to inspect; record a take first");
  const recording = call("recording.get", { recordingId });
  step("recording", {
    recordingId,
    state: recording.state,
    sourceDurationUs: recording.sourceDurationUs,
    currentRevisionId: recording.currentRevisionId,
  });
  if (!recording.sourceDurationUs) throw new Error("That take holds no media");

  const source = await ready(recordingId, "source");
  step("source evidence", {
    generation: source.published?.generation,
    elapsedMs: source.elapsedMs,
  });

  const transcript = await ready(recordingId, "transcript");
  const engine = transcript.published.transcript.engine;
  step("transcript", {
    elapsedMs: transcript.elapsedMs,
    peakResidentBytes: transcript.peakResidentBytes,
    // Real time or better is the resource target; narration length is the yardstick.
    timesRealTime: transcript.elapsedMs / (recording.sourceDurationUs / 1000),
    engine: {
      runtime: engine.runtime,
      model: engine.model,
      encoderPrecision: engine.encoderPrecision,
    },
  });

  const rows = pages("transcript.get", { recordingId, limit: 1000 });
  const words = rows.filter((row) => row.type === "word");
  const fillers = words.filter((word) => word.kind === "filler");
  writeFileSync(join(out, "transcript.json"), JSON.stringify(rows, null, 2) + "\n");
  step("transcript rows", {
    words: words.length,
    fillers: fillers.map((word) => [word.id, word.text, word.sourceRange.startUs]),
    gaps: rows.filter((row) => row.type === "gap").map((row) => row.sourceRange),
    text: words.map((word) => word.text).join(" "),
  });

  // The screenshot index reports its own readiness through index.get, not processing.status.
  const index = await (async () => {
    const deadline = Date.now() + 900_000;
    for (;;) {
      const answer = call("index.get", { recordingId, limit: 1 });
      if (answer.page) return answer;
      if (["failed", "unavailable"].includes(answer.state))
        throw new Error(`index is ${answer.state}: ${answer.reason}`);
      if (Date.now() > deadline) throw new Error("index did not become ready");
      await wait(1000);
    }
  })();
  // The index's own cursor carries its generation; the request names only the revision.
  const selected = pages("index.get", { recordingId, revisionId: index.revisionId, limit: 200 });
  step("screenshot index", {
    selected: selected.length,
    reasons: selected.flatMap(
      (entry) => entry.candidate?.reasons?.map((reason) => reason.kind) ?? [],
    ),
  });
  if (selected.length) {
    const ordinals = selected.slice(0, 2).map((entry) => entry.ordinal ?? entry.candidate.ordinal);
    await media(
      "index.frames",
      { recordingId, revisionId: index.revisionId, generation: index.generation, ordinals },
      join(out, "index-frame"),
    );
    step("index images", { ordinals, files: `${out}/index-frame*` });
  }

  // An agent asking for a moment the index never selected: halfway through the take.
  await media(
    "frame.batch",
    { recordingId, atUs: [Math.floor(recording.sourceDurationUs / 2)] },
    join(out, "midpoint-frame"),
  );
  step("arbitrary frame", { atUs: Math.floor(recording.sourceDurationUs / 2) });

  const found = call("transcript.search", { recordingId, text: values.phrase });
  const phrase = found.page?.entries?.[0];
  step("phrase search", { phrase: values.phrase, entry: phrase ?? null });

  const clips = [];
  const clip = async (name, range, revision) => {
    const padded = {
      startUs: Math.max(0, range.startUs - 1_500_000),
      endUs: Math.min(recording.sourceDurationUs, range.endUs + 1_500_000),
    };
    await media(
      "audio.get",
      {
        recordingId,
        range: padded,
        track: "narration",
        ...(revision ? { revisionId: revision } : {}),
      },
      join(out, `${name}.wav`),
    );
    clips.push({ name, range: padded });
  };

  let revisionId = recording.currentRevisionId;
  const cuts = [];
  if (phrase) {
    await clip("before-phrase-cut", phrase.sourceRange, revisionId);
    const edited = call("edit.cut", {
      recordingId,
      requestId: randomUUID(),
      expectedRevisionId: revisionId,
      ranges: [phrase.sourceRange],
    });
    cuts.push({ what: values.phrase, range: phrase.sourceRange, revision: edited.revision.id });
    step("cut phrase", { from: revisionId, to: edited.revision.id });
    // The same request against the revision it replaced must be refused, not applied twice.
    const stale = call(
      "edit.cut",
      {
        recordingId,
        requestId: randomUUID(),
        expectedRevisionId: revisionId,
        ranges: [phrase.sourceRange],
      },
      { allowFailure: true },
    );
    step("stale edit refused", { code: stale.error?.code ?? "accepted" });
    revisionId = edited.revision.id;
  }

  if (fillers.length) {
    const ranges = fillers.map((word) => word.sourceRange);
    const edited = call("edit.cut", {
      recordingId,
      requestId: randomUUID(),
      expectedRevisionId: revisionId,
      ranges,
    });
    cuts.push({ what: "fillers", ranges, revision: edited.revision.id });
    step("cut fillers", { count: ranges.length, to: edited.revision.id });
    revisionId = edited.revision.id;
  }

  // The same moments in the edited revision: what a person hears across each join.
  for (const [ordinal, cut] of cuts.entries()) {
    const at = cut.range ?? cut.ranges[0];
    await clip(`after-cut-${ordinal}`, { startUs: at.startUs, endUs: at.startUs + 1 }, revisionId);
  }
  step("audio clips", { clips: clips.map((item) => item.name) });

  const history = call("revision.history", { recordingId, limit: 50 });
  const undone = call("edit.undo", {
    recordingId,
    requestId: randomUUID(),
    expectedRevisionId: revisionId,
  });
  step("undo", {
    historyEntries: (history.entries ?? history.revisions ?? []).length,
    now: undone.revision.id,
  });
  const restored = call("edit.restore", {
    recordingId,
    requestId: randomUUID(),
    expectedRevisionId: undone.revision.id,
    targetRevisionId: revisionId,
  });
  revisionId = restored.revision.id;
  step("restore", { now: revisionId });

  const preview = await (async () => {
    const deadline = Date.now() + 600_000;
    for (;;) {
      const answer = call(
        "preview.get",
        { recordingId, revisionId },
        { args: ["--output", join(out, "preview.mp4")] },
      );
      if (answer.state === "ready") return answer;
      if (["failed", "unavailable"].includes(answer.state))
        throw new Error(`preview is ${answer.state}: ${answer.reason}`);
      if (Date.now() > deadline) throw new Error("preview never became ready");
      await wait(1000);
    }
  })();
  step("preview", { revisionId, file: join(out, "preview.mp4"), state: preview.state });

  const exports = {};
  for (const [kind, leaf] of [
    ["video", "demo.mp4"],
    ["processed-package", "demo.zip"],
  ]) {
    const exportId = randomUUID();
    call("export.create", { exportId, recordingId, kind, revisionId, directory: out, leaf });
    const deadline = Date.now() + 900_000;
    for (;;) {
      const status = call("export.status", { exportId });
      if (status.state === "committed") {
        exports[kind] = { exportId, output: status.output };
        break;
      }
      if (["failed", "unavailable", "canceled"].includes(status.state))
        throw new Error(`${kind} export ${status.state}: ${status.reason}`);
      if (Date.now() > deadline) throw new Error(`${kind} export never committed`);
      await wait(1000);
    }
    step(`export ${kind}`, exports[kind]);
  }

  // Relocation: the package must answer from its own files, wherever it lands.
  // Opening a package refuses symlinked path components, and /tmp is one.
  const moved = join(realpathSync(mkdtempSync("/tmp/screenrec-moved-")), "relocated.zip");
  renameSync(exports["processed-package"].output, moved);
  const admission = call("package.open", { path: moved });
  // Whatever happens from here, the service must not be left holding this package open with its
  // extracted copy on disk: it is the person's own service, not one a run can walk away from.
  const closeAdmission = () => {
    try {
      call("package.close", { admissionId: admission.id }, { allowFailure: true });
    } catch {
      // Already closed, or the service is gone with it.
    }
  };
  process.once("exit", closeAdmission);
  try {
    const opened = await (async () => {
      const deadline = Date.now() + 300_000;
      for (;;) {
        const status = call("package.status", { admissionId: admission.id });
        if (status.state === "ready") return status;
        if (["failed", "cleanup_failed"].includes(status.state))
          throw new Error(`package ${status.state}: ${JSON.stringify(status)}`);
        if (Date.now() > deadline) throw new Error("package never opened");
        await wait(500);
      }
    })();
    const packaged = pages("transcript.get", {
      packageHandle: opened.packageHandle,
      revisionId,
      limit: 1000,
    });
    const libraryRows = pages("transcript.get", { recordingId, revisionId, limit: 1000 });
    const identical = JSON.stringify(packaged) === JSON.stringify(libraryRows);
    await media(
      "frame.batch",
      { packageHandle: opened.packageHandle, atUs: [Math.floor(recording.sourceDurationUs / 3)] },
      join(out, "package-frame"),
    );
    step("relocated package", {
      path: moved,
      transcriptMatchesLibrary: identical,
      newFrameRequested: true,
    });
  } finally {
    closeAdmission();
    process.removeListener("exit", closeAdmission);
    rmSync(dirname(moved), { recursive: true, force: true });
  }

  step("storage", call("storage.usage", {}));
  report.finishedAt = new Date().toISOString();
  report.out = out;
  writeFileSync(join(out, "journey.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`\nEvidence in ${out}`);
  console.log("Listen to the audio clips to judge the cuts, then keep or undo the edits.");
};

main().catch((error) => {
  report.failure = String(error?.message ?? error);
  writeFileSync(join(out, "journey.json"), JSON.stringify(report, null, 2) + "\n");
  console.error(`\nJourney stopped: ${report.failure}\nPartial evidence in ${out}`);
  process.exitCode = 1;
});
