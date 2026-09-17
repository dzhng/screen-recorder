// Needs an installed speech model: SCREENREC_SPEECH_MODELS names the `models` directory of a home
// where `model.prepare` finished. Synthetic `say` narration proves plumbing only, not accuracy.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { hash, randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { RevisionStore } from "@screenrec/core/library";
import { parakeetModel } from "@screenrec/core/speech-models";
import { launchReady, socketPath, temporary, waitFor } from "./harness.mjs";

const cli = fileURLToPath(new URL("../../cli/dist/main.js", import.meta.url));
const prepared = process.env.SCREENREC_SPEECH_MODELS;
const installed =
  prepared && isAbsolute(prepared)
    ? join(prepared, parakeetModel.name, parakeetModel.revision)
    : undefined;
const skip =
  installed && existsSync(join(installed, "receipt.json"))
    ? false
    : "SCREENREC_SPEECH_MODELS does not name the models directory of a home with the pinned speech model prepared";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", timeout: 120_000 });
}

/** Hard links keep each file's inode and mtime, so the install still matches its receipt. */
function linkInstall(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) linkInstall(join(from, entry.name), join(to, entry.name));
    else linkSync(join(from, entry.name), join(to, entry.name));
  }
}

const phrases = [
  "Open the settings panel and choose the second display.",
  "Then press record and describe the change you made.",
];
const fold = (text) =>
  text
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);

/** Two spoken phrases around an empty edit: the movie claims the gap but holds no sample there. */
function narrationMovie(work, output) {
  const pieces = phrases.map((text, index) => {
    const aiff = join(work, `phrase-${index}.aiff`);
    const wav = join(work, `phrase-${index}.wav`);
    run("say", ["-o", aiff, text]);
    run("ffmpeg", [
      "-v",
      "error",
      "-i",
      aiff,
      "-ar",
      "48000",
      "-ac",
      "1",
      "-c:a",
      "pcm_f32le",
      wav,
    ]);
    const [stream] = JSON.parse(
      run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "stream=duration_ts,sample_rate",
        "-of",
        "json",
        wav,
      ]),
    ).streams;
    return {
      wav,
      durationUs: Math.round((Number(stream.duration_ts) * 1e6) / Number(stream.sample_rate)),
    };
  });
  const maker = join(work, "narration-maker");
  run("swiftc", [
    "-parse-as-library",
    fileURLToPath(new URL("../../../helpers/mac/Tests/SpeechLab/narration.swift", import.meta.url)),
    "-o",
    maker,
  ]);
  const gapUs = 2_000_000;
  run(maker, [output, pieces[0].wav, `gap:${gapUs / 1e6}`, pieces[1].wav]);
  const gap = { startUs: pieces[0].durationUs, endUs: pieces[0].durationUs + gapUs };
  return { gap, durationUs: gap.endUs + pieces[1].durationUs };
}

test(
  "bundled service transcribes acquired narration and serves pages, search, cuts and retry through the CLI",
  { skip, timeout: 600_000 },
  async (t) => {
    const home = temporary("/tmp/scr-transcript-service-");
    try {
      linkInstall(installed, join(home, "models", parakeetModel.name, parakeetModel.revision));
    } catch (error) {
      assert.fail(
        `Cannot link the prepared model into a scratch home (${error.code}); keep it on the same volume as /tmp`,
      );
    }
    const store = new RevisionStore(join(home, "library.sqlite"), {
      now: () => new Date().toISOString(),
      newId: randomUUID,
    });
    const take = store.allocate().recording;
    const source = join(home, "recordings", take.recordingId, "source");
    await mkdir(source, { recursive: true });
    const narration = join(source, "narration.mov");
    const { gap, durationUs } = narrationMovie(
      temporary("/tmp/scr-transcript-narration-"),
      narration,
    );
    for (const [sequence, state] of ["recording", "finalizing"].entries())
      store.ingestLifecycle(take.recordingId, {
        sourceId: take.sourceId,
        sequence: sequence + 1,
        state,
      });
    store.ingestLifecycle(take.recordingId, {
      sourceId: take.sourceId,
      sequence: 3,
      state: "complete",
      sourceDurationUs: durationUs,
    });
    store.close();
    // Acquisition claims the whole take; only the movie knows the gap holds no narration.
    const rows = [
      {
        event: "header",
        data: {
          schemaVersion: 1,
          sessionID: take.sourceId,
          source: { kind: "display", displayID: 1 },
          width: 100,
          height: 80,
          microphone: true,
          systemAudio: false,
        },
      },
      { event: "origin", data: { hostUs: 1000 } },
      { event: "audioSamples", data: { role: "narration", startUs: 0, endUs: durationUs } },
      { event: "finished", data: {} },
    ];
    const journal = join(source, "capture.journal.jsonl");
    await writeFile(
      journal,
      rows.map((row, index) => JSON.stringify({ sequence: index + 1, ...row }) + "\n").join(""),
    );
    const hashes = async () =>
      Promise.all([narration, journal].map(async (path) => hash("sha256", await readFile(path))));
    const original = await hashes();

    const { instance } = await launchReady(home);
    const screenrec = (operation, params = {}) => {
      const response = JSON.parse(
        execFileSync(
          process.execPath,
          [cli, operation, "--socket", socketPath(home), "--params", JSON.stringify(params)],
          { encoding: "utf8", timeout: 15_000 },
        ),
      );
      assert.equal(response.ok, true, JSON.stringify(response));
      return response.data;
    };

    assert.deepEqual(screenrec("model.status"), { state: "ready" });
    assert.deepEqual(screenrec("model.prepare"), { state: "ready" });
    const recordingId = take.recordingId;
    const ready = await waitFor(
      () => {
        const status = screenrec("processing.status", { recordingId, artifact: "transcript" });
        if (["failed", "unavailable"].includes(status.state))
          throw new Error(JSON.stringify(status));
        return status.state === "ready" && status;
      },
      300_000,
      () => instance.diagnostics,
    );
    const { generation, engine } = ready.published.transcript;
    assert.deepEqual(
      {
        runtimeRevision: engine.runtimeRevision,
        model: engine.model,
        modelRevision: engine.modelRevision,
      },
      {
        runtimeRevision: parakeetModel.engine.runtimeRevision,
        model: parakeetModel.repo,
        modelRevision: parakeetModel.revision,
      },
    );

    const transcript = [];
    let cursor;
    let pages = 0;
    do {
      const page = screenrec("transcript.get", {
        recordingId,
        limit: 5,
        ...(cursor ? { cursor } : {}),
      });
      assert.equal(page.generation, generation);
      transcript.push(...page.page.rows);
      cursor = page.page.nextCursor;
      pages++;
    } while (cursor);
    assert.ok(pages > 1, "Transcript fit one page; paging was not exercised");
    const words = transcript.filter((row) => row.type === "word");
    assert.deepEqual(
      fold(words.map((word) => word.text).join(" ")),
      fold(phrases.join(" ")),
      JSON.stringify(words),
    );
    // The empty edit is a gap row between the phrases, never silence-transcribed words.
    const gaps = transcript.filter((row) => row.type === "gap");
    assert.equal(gaps.length, 1, JSON.stringify(gaps));
    assert.equal(gaps[0].reason, "not_acquired");
    assert.ok(Math.abs(gaps[0].sourceRange.startUs - gap.startUs) <= 1, JSON.stringify(gaps[0]));
    assert.ok(Math.abs(gaps[0].sourceRange.endUs - gap.endUs) <= 1, JSON.stringify(gaps[0]));
    const gapAt = transcript.indexOf(gaps[0]);
    assert.ok(
      transcript
        .slice(0, gapAt)
        .every((row) => row.sourceRange.endUs <= gaps[0].sourceRange.startUs),
    );
    assert.ok(
      transcript
        .slice(gapAt + 1)
        .every((row) => row.sourceRange.startUs >= gaps[0].sourceRange.endUs),
    );

    t.diagnostic(
      JSON.stringify({
        pages,
        words: words.map((word) => [
          word.id,
          word.text,
          word.sourceRange.startUs,
          word.sourceRange.endUs,
        ]),
        gap: gaps[0].sourceRange,
        engine,
      }),
    );

    const found = screenrec("transcript.search", { recordingId, text: "SECOND display" });
    assert.equal(found.generation, generation);
    const second = words.find((word) => fold(word.text)[0] === "second");
    const display = words[words.indexOf(second) + 1];
    assert.deepEqual(
      found.page.entries.map((entry) => [entry.wordIds, entry.sourceRange, entry.partial]),
      [
        [
          [second.id, display.id],
          { startUs: second.sourceRange.startUs, endUs: display.sourceRange.endUs },
          false,
        ],
      ],
    );

    // Playback equals source time in r0, so this cut lands inside one word.
    const settings = words.find((word) => fold(word.text)[0] === "settings");
    const middle = Math.floor((settings.sourceRange.startUs + settings.sourceRange.endUs) / 2);
    const removed = { startUs: middle - 50_000, endUs: middle + 50_000 };
    const { revision } = screenrec("edit.cut", {
      recordingId,
      requestId: randomUUID(),
      expectedRevisionId: "r0",
      ranges: [removed],
    });
    const edited = [];
    cursor = undefined;
    do {
      const page = screenrec("transcript.get", {
        recordingId,
        revisionId: revision.id,
        limit: 1000,
        ...(cursor ? { cursor } : {}),
      });
      assert.equal(page.generation, generation);
      edited.push(...page.page.rows);
      cursor = page.page.nextCursor;
    } while (cursor);
    const clipped = edited.find((row) => row.id === settings.id);
    assert.equal(clipped.text, settings.text);
    assert.equal(clipped.partial, true);
    assert.deepEqual(
      clipped.fragments.map((fragment) => fragment.source),
      [
        { startUs: settings.sourceRange.startUs, endUs: removed.startUs },
        { startUs: removed.endUs, endUs: settings.sourceRange.endUs },
      ],
    );
    assert.equal(
      edited.filter((row) => row.type === "word" && row.partial).length,
      1,
      "Only the cut word is partial",
    );
    const phrase = screenrec("transcript.search", {
      recordingId,
      revisionId: revision.id,
      text: `${settings.text} panel`,
    });
    assert.equal(phrase.page.entries.length, 1);
    assert.equal(phrase.page.entries[0].wordIds[0], settings.id);
    assert.equal(phrase.page.entries[0].partial, true);

    const retried = screenrec("processing.retry", { recordingId, artifact: "transcript" });
    assert.equal(retried.jobId, ready.jobId);
    assert.deepEqual(retried.published, ready.published);
    assert.deepEqual(await hashes(), original);
    const raw = join(
      home,
      "recordings",
      recordingId,
      "evidence",
      "transcript",
      generation,
      "raw.jsonl",
    );
    assert.equal(statSync(raw).size, ready.published.transcript.raw.bytes);

    instance.kill("SIGTERM");
    await waitFor(
      () => !instance.running,
      15_000,
      () => instance.diagnostics,
    );
    assert.equal((await instance.exited).code, 0);
  },
);
