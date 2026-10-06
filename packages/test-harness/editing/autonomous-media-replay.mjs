import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { collectUseCaseRouting } from "./autonomous-routing.mjs";

const run = promisify(execFile);
const root = resolve(new URL("../../../", import.meta.url).pathname);
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const out = resolve(value("--out") ?? (await mkdtemp(join(tmpdir(), "yap-autonomous-media-"))));
const native = resolve(value("--native") ?? process.env.YAP_NATIVE ?? "");
const model = resolve(value("--model") ?? process.env.YAP_PARAKEET_MODEL ?? "");
assert(native, "Pass --native or YAP_NATIVE");
assert(model, "Pass --model or YAP_PARAKEET_MODEL");
const routing = await collectUseCaseRouting(join(root, "skills/yap/references"));

const hashFile = async (path) => {
  const bytes = await readFile(path);
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const runPreview = async (state) => {
  const directory = join(out, state);
  const result = await run(
    process.execPath,
    [
      join(root, "packages/test-harness/editing/first-preview.mjs"),
      "--transport",
      "both",
      "--out",
      directory,
    ],
    { cwd: root, env: { ...process.env, YAP_NATIVE: native }, maxBuffer: 4 * 1024 ** 2 },
  );
  const report = JSON.parse(await readFile(join(directory, "report.json"), "utf8"));
  assert.equal(report.passed, true, `${state} preview journey failed: ${result.stderr}`);
  const delivery = await hashFile(join(directory, "exports", "pinned.mp4"));
  const normalized = join(directory, "normalized.mp4");
  await run(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      delivery.path,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-map_metadata",
      "-1",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-g",
      "30",
      "-sc_threshold",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      normalized,
    ],
    { cwd: root, maxBuffer: 2 * 1024 ** 2 },
  );
  return {
    state,
    report,
    delivery,
    normalized: await hashFile(normalized),
    sources: report.checks.deletionAndOriginals,
    native: await hashFile(native),
  };
};

const speechDirectory = join(out, "speech-repair");
await run(
  process.execPath,
  [
    join(root, "packages/test-harness/editing/contextual-join-fixture.mjs"),
    "--out",
    speechDirectory,
    "--model",
    model,
    "--native",
    native,
  ],
  { cwd: root, env: { ...process.env, YAP_NATIVE: native }, maxBuffer: 4 * 1024 ** 2 },
);
const speech = JSON.parse(await readFile(join(speechDirectory, "report.json"), "utf8"));
assert.equal(speech.passed, true);
assert.equal(speech.freshAgentReplay.discovery.expectedText, "fortunate");
assert.equal(speech.freshAgentReplay.changedOutput.rendered.state, "ready");
assert.equal(speech.freshAgentReplay.changedOutput.rendered.transcript.wordCount, 1);

const runs = await Promise.all([runPreview("clean"), runPreview("relocated")]);
assert.equal(runs[0].normalized.sha256, runs[1].normalized.sha256, "relocated delivery differs");
assert.deepEqual(runs[0].sources, runs[1].sources, "source identities differ");
for (const runResult of runs) {
  const checks = runResult.report.checks;
  assert.ok(checks.videoReplacement.frames.every(({ differingPixels }) => differingPixels === 0));
  assert.ok(checks.audioReplacement.removedA.every((value) => value < 0.001));
  assert.ok(checks.audioReplacement.tones.every((value) => value > 0.05));
}

const report = {
  version: 1,
  scope: "fresh production-native media workflow and relocated replay",
  coverage: {
    capabilityRouting: "verified",
    sourceIdentity: "verified",
    deliveryIdentity: "verified",
    native: "verified",
    visual: "verified",
    audio: "verified",
    humanQaRequired: false,
  },
  native: runs[0].native,
  routing: routing.map((receipt) => ({
    useCase: receipt.useCase,
    route: receipt.route,
    provenance: receipt.provenance,
    policy: receipt.policy,
  })),
  speechRepair: {
    expectedText: speech.freshAgentReplay.discovery.expectedText,
    observedText:
      speech.freshAgentReplay.changedOutput.join.rendered.recognition.textComparison.observedText,
    beforeRevisionId: speech.freshAgentReplay.repair.beforeRevisionId,
    afterRevisionId: speech.freshAgentReplay.repair.afterRevisionId,
  },
  runs: runs.map(({ state, delivery, normalized, sources, report: preview }) => ({
    state,
    delivery,
    normalized,
    sources,
    preview: {
      passed: preview.passed,
      rendering: preview.rendering,
      checks: Object.keys(preview.checks),
    },
  })),
  replay: { normalizedDeliveryIdentity: true, sourceIdentity: true, sourceMediaPreserved: true },
};
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({ status: "passed", out, deliverySha256: runs[0].normalized.sha256 }, null, 2),
);
