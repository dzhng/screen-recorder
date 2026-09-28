import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: Object.fromEntries(
    ["native", "baseline", "models", "out"].map((name) => [name, { type: "string" }]),
  ),
});
for (const name of ["native", "baseline", "models", "out"])
  assert.ok(values[name], `Pass --${name}`);
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
assert.deepEqual(readdirSync(out), [], "Use a fresh evidence directory");
const root = new URL("../../../", import.meta.url).pathname;
const models = JSON.parse(readFileSync(values.models, "utf8")).request;
assert.ok(
  models?.directory && models.files.length,
  "Use existing prepared model request; this harness never prepares models",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2) + "\n");
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr?.toString());
  return result;
}
function native(binary, name, operation, params) {
  save(`${name}-request.json`, { operation, params });
  const result = run(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", resolve(binary)],
    {
      input: JSON.stringify({ id: name, operation, params }) + "\n",
    },
  );
  writeFileSync(join(out, `${name}.log`), result.stderr);
  const reply = JSON.parse(result.stdout);
  save(`${name}-response.json`, reply);
  return reply;
}
const report = {
  boundary: "actual native speech.transcribe; no public service claim",
  passed: false,
  baselineSha256: hash(readFileSync(values.baseline)),
  nativeSha256: hash(readFileSync(values.native)),
  models,
  checks: [],
};
try {
  const source = join(root, "fixtures/narrated-workbench/narration.mov");
  report.sourceSha256 = hash(readFileSync(source));
  const fixture = join(out, "fixture");
  run("swiftc", [
    "-parse-as-library",
    join(root, "packages/test-harness/editing/selected-audio-fixture.swift"),
    "-o",
    fixture,
  ]);
  // Decode the actual take once so the fixture's authored edit boundaries are
  // exact PCM sample boundaries; its original capture priming is tested separately.
  const decodedSource = join(out, "narration.wav");
  run("ffmpeg", ["-v", "error", "-i", source, "-map", "0:a:0", "-c:a", "pcm_f32le", decodedSource]);
  run(fixture, [decodedSource, out]);
  const probe = native(values.native, "probe", "media.probe", { path: join(out, "multi.mov") });
  assert.equal(probe.ok, true, JSON.stringify(probe));
  const audio = probe.data.streams.filter((stream) => stream.kind === "audio");
  assert.equal(audio.length, 2);
  assert.notEqual(audio[0].id, audio[1].id);
  const normalize = (lines) =>
    lines.map((line) => {
      if (!line.result) return line;
      const { processingTime, ...result } = line.result;
      assert.ok(Number.isFinite(processingTime));
      return { ...line, result };
    });
  const wordsByStream = [];
  for (const [index, name] of ["first", "second"].entries()) {
    for (const [mask, available, expected] of [
      [
        "physical",
        [{ startUs: 0, endUs: 12500000 }],
        [
          { startUs: 0, endUs: 6000000 },
          { startUs: 6500000, endUs: 12500000 },
        ],
      ],
      [
        "acquired",
        [
          { startUs: 0, endUs: 2000000 },
          { startUs: 3000000, endUs: 12000000 },
        ],
        [
          { startUs: 0, endUs: 2000000 },
          { startUs: 3000000, endUs: 6000000 },
          { startUs: 6500000, endUs: 12000000 },
        ],
      ],
    ]) {
      const selection = {
        source: join(out, "multi.mov"),
        streamId: audio[index].id,
        sourceOffsetUs: -250000,
        available,
      };
      const selectedWav = join(out, `${name}-${mask}-selected.wav`);
      const plan = join(out, `${name}-${mask}-pcm.json`);
      writeFileSync(
        plan,
        JSON.stringify({ source: selection, spans: available, output: selectedWav }),
      );
      run(join(root, "helpers/mac/.build/debug/ScreenRecorderAudioTests"), [], {
        env: {
          ...process.env,
          SCREENREC_AUDIO_SELECTED_PLAN: plan,
          SCREENREC_AUDIO_EVIDENCE: join(out, "pcm-evidence"),
        },
      });
      const referenceWav = join(out, `${name}-${mask}-baseline.wav`);
      const pcm = native(values.baseline, `${name}-${mask}-pcm-baseline`, "media.audio", {
        tracks: [
          {
            role: "narration",
            source: join(out, name + ".mov"),
            sourceOffsetUs: selection.sourceOffsetUs,
            available,
          },
        ],
        spans: available,
        output: referenceWav,
      });
      assert.equal(pcm.ok, true, JSON.stringify(pcm));
      const decodePCM = (file) =>
        run("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-f", "f32le", "pipe:1"], {
          encoding: "buffer",
        }).stdout;
      const selectedPCM = decodePCM(selectedWav);
      assert.deepEqual(
        selectedPCM,
        decodePCM(referenceWav),
        "Role-free PCM changed frozen source bytes",
      );
      const lines = [];
      const receipts = [];
      for (const variant of ["baseline", "selected", "unique"]) {
        const id = `${name}-${mask}-${variant}`;
        const output = join(out, `${id}.jsonl`);
        const single = { sourceOffsetUs: selection.sourceOffsetUs, available };
        const track =
          variant === "selected"
            ? selection
            : {
                ...single,
                source: join(out, name + ".mov"),
                ...(variant === "baseline" ? { role: "narration" } : {}),
              };
        const reply = native(
          variant === "baseline" ? values.baseline : values.native,
          id,
          "speech.transcribe",
          { models, track, output },
        );
        assert.equal(reply.ok, true, JSON.stringify(reply));
        assert.deepEqual(
          reply.data.segments.map((segment) => segment.source),
          expected,
        );
        assert.ok(reply.data.wordCount > 0, "Real retained speech must produce words");
        receipts.push(reply.data);
        lines.push(normalize(readFileSync(output, "utf8").trim().split("\n").map(JSON.parse)));
      }
      assert.deepEqual(
        lines[1],
        lines[0],
        "Selected stream changed complete raw transcript apart from processing time",
      );
      assert.deepEqual(lines[2], lines[0], "Unique source selection changed frozen transcript");
      assert.deepEqual(receipts[1].engine, receipts[0].engine);
      assert.deepEqual(receipts[1].segments, receipts[0].segments);
      const text = lines[1].flatMap((line) => line.words.map((word) => word.text)).join(" ");
      if (mask === "physical") wordsByStream.push(text);
      report.checks.push({
        name,
        mask,
        streamId: selection.streamId,
        intervals: expected,
        text,
        rawParity: true,
        pcmSha256: hash(selectedPCM),
        engine: receipts[1].engine,
        wordCount: receipts[1].wordCount,
      });
      save("report.json", report);
      console.log(`${name}/${mask}: matched frozen transcript`);
    }
  }
  assert.notEqual(
    wordsByStream[0],
    wordsByStream[1],
    "Distinguishable streams must not select the same speech",
  );
  const ambiguous = native(values.native, "ambiguous", "speech.transcribe", {
    models,
    track: {
      source: join(out, "multi.mov"),
      sourceOffsetUs: -250000,
      available: [{ startUs: 0, endUs: 12500000 }],
    },
    output: join(out, "ambiguous.jsonl"),
  });
  assert.equal(ambiguous.error.code, "INVALID_REQUEST");
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  save("report.json", report);
  console.log(JSON.stringify({ out, passed: report.passed, error: report.error?.message }));
}
