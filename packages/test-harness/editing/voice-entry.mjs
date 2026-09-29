import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { voiceRenderer } from "../../../apps/service/dist/voice.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
const { values } = parseArgs({
  options: Object.fromEntries(
    ["out", "python", "entry", "model", "cache", "native"].map((x) => [x, { type: "string" }]),
  ),
});
for (const key of ["out", "python", "entry", "model", "cache", "native"])
  assert(values[key], `Missing --${key}`);
const out = resolve(values.out);
await mkdir(out, { mode: 0o700 });
const workspace = join(out, "workspace");
const root = new URL("../../../", import.meta.url).pathname;
const frozen = join(root, "specs/agent-editing/assets/18-voice");
const cases = JSON.parse(
  await readFile(join(root, "packages/test-harness/editing/voice/cases.json")),
);
const preparation = Object.fromEntries(
  ["python", "entry", "model", "cache"].map((k) => [k, resolve(values[k])]),
);
const native = mediaWorker({ SCREENREC_NATIVE: resolve(values.native) });
const run = voiceRenderer(native, preparation, workspace);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const request = (name) => ({
  reference: join(frozen, "reference.wav"),
  referenceText: cases.reference.text,
  text: cases.replacements[0].text,
  generation: cases.generation,
  seed: cases.seed,
  output: join(out, `${name}.wav`),
});
const report = {
  passed: false,
  checks: [],
  scope: "Private entry parity; no public job, managed-origin or listening acceptance",
  preparation,
};
async function empty() {
  assert.deepEqual(await readdir(workspace), []);
}
async function refusal(label, execute, code) {
  let error;
  try {
    await execute();
  } catch (e) {
    error = e;
  }
  assert.equal(error?.code, code, `${label}: ${error}`);
  await empty();
  report.checks.push({ label, code });
}
const previousPythonPath = process.env.PYTHONPATH;
const shadow = join(out, "shadow");
await mkdir(shadow);
await writeFile(
  join(shadow, "mlx_audio.py"),
  'raise RuntimeError("unprepared ambient module was imported")\n',
);
process.env.PYTHONPATH = shadow;
try {
  for (const replacement of cases.replacements) {
    const q = { ...request(replacement.id), text: replacement.text };
    const result = await run(q, new AbortController().signal);
    const actual = await readFile(q.output),
      expected = await readFile(join(frozen, `same-take-${replacement.id}.wav`));
    assert.deepEqual(actual, expected);
    await empty();
    report.checks.push({
      label: replacement.id,
      exactWAVAndPCM: true,
      ignoresAmbientPythonPath: true,
      sha256: digest(actual),
      receipt: result,
    });
  }
  await refusal(
    "preexisting destination",
    () => run(request("word"), new AbortController().signal),
    "INVALID_REQUEST",
  );
  const same = { ...request("collision"), output: join(frozen, "reference.wav") };
  const before = digest(await readFile(same.output));
  await refusal(
    "input/output collision",
    () => run(same, new AbortController().signal),
    "INVALID_REQUEST",
  );
  assert.equal(digest(await readFile(same.output)), before);
  await refusal(
    "missing runtime",
    () =>
      voiceRenderer(
        native,
        { ...preparation, python: join(out, "missing-python") },
        workspace,
      )(request("missing"), new AbortController().signal),
    "MODEL_NOT_PREPARED",
  );
  await refusal(
    "wrong runtime",
    () =>
      voiceRenderer(
        native,
        { ...preparation, python: process.execPath },
        workspace,
      )(request("wrong"), new AbortController().signal),
    "MODEL_NOT_PREPARED",
  );
  await refusal(
    "missing model",
    () =>
      voiceRenderer(
        native,
        { ...preparation, model: join(out, "missing-model") },
        workspace,
      )(request("missing-model"), new AbortController().signal),
    "MODEL_NOT_PREPARED",
  );
  const wrongModel = join(out, "wrong-model");
  await mkdir(wrongModel);
  await writeFile(join(wrongModel, ".gitattributes"), "changed prepared bytes");
  await refusal(
    "mismatched model bytes",
    () =>
      voiceRenderer(
        native,
        { ...preparation, model: wrongModel },
        workspace,
      )(request("changed-model"), new AbortController().signal),
    "MODEL_NOT_PREPARED",
  );
  const unsupported = join(out, "unsupported.wav");
  const unsupportedBytes = Buffer.from(await readFile(join(frozen, "reference.wav")));
  let formatPosition = 12;
  while (unsupportedBytes.subarray(formatPosition, formatPosition + 4).toString() !== "fmt ")
    formatPosition +=
      8 +
      unsupportedBytes.readUInt32LE(formatPosition + 4) +
      (unsupportedBytes.readUInt32LE(formatPosition + 4) % 2);
  unsupportedBytes.writeUInt32LE(48000, formatPosition + 12);
  unsupportedBytes.writeUInt32LE(48000 * 4, formatPosition + 16);
  await writeFile(unsupported, unsupportedBytes);
  await refusal(
    "unsupported reference rate",
    () => run({ ...request("unsupported"), reference: unsupported }, new AbortController().signal),
    "INVALID_REQUEST",
  );
  const invalid = join(out, "invalid.wav");
  await writeFile(invalid, "not a WAV");
  await refusal(
    "malformed reference",
    () => run({ ...request("malformed"), reference: invalid }, new AbortController().signal),
    "INVALID_REQUEST",
  );
  const long = join(out, "too-long.wav");
  await writeFile(long, await readFile(join(frozen, "reference.wav")));
  // Preserve valid Float32 WAV format while adding one frame beyond the measured five-second scope.
  const longBytes = await readFile(long);
  longBytes.writeUInt32LE(longBytes.readUInt32LE(4) + 4, 4);
  let p = 12;
  while (longBytes.subarray(p, p + 4).toString() !== "data")
    p += 8 + longBytes.readUInt32LE(p + 4) + (longBytes.readUInt32LE(p + 4) % 2);
  longBytes.writeUInt32LE(longBytes.readUInt32LE(p + 4) + 4, p + 4);
  await writeFile(long, Buffer.concat([longBytes, Buffer.alloc(4)]));
  await refusal(
    "reference exceeds measured frames",
    () => run({ ...request("long"), reference: long }, new AbortController().signal),
    "INVALID_REQUEST",
  );
  for (const mode of ["cancel", "deadline"]) {
    const controller = new AbortController();
    const pending = run(
      request(mode),
      controller.signal,
      mode === "deadline" ? 10000 : 600000,
    ).then(
      () => ({ unexpected: true }),
      (error) => ({ error }),
    );
    try {
      let pid;
      const end = Date.now() + 8000;
      while (Date.now() < end) {
        const dirs = await readdir(workspace);
        if (
          dirs.length &&
          (await stat(join(workspace, dirs[0], "audio.wav")).then(
            () => true,
            () => false,
          ))
        ) {
          const rows = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
            encoding: "utf8",
          }).split("\n");
          const row = rows.find(
            (s) =>
              s.includes(preparation.entry) && Number(s.trim().split(/\s+/)[1]) === process.pid,
          );
          if (row) {
            pid = Number(row.trim().split(/\s+/)[0]);
            break;
          }
        }
        await delay(10);
      }
      assert(pid, `${mode}: worker did not reach partial output`);
      process.kill(pid, "SIGSTOP");
      if (mode === "cancel") controller.abort();
      const result = await pending;
      assert.equal(result.error?.code, mode === "cancel" ? "CANCELED" : "MEDIA_WORKER_TIMEOUT");
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
      await empty();
      report.checks.push({
        label: mode,
        pid,
        partialOutput: true,
        closedBeforeReturn: true,
        code: result.error.code,
      });
    } finally {
      controller.abort();
      await pending;
    }
  }
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  if (previousPythonPath === undefined) delete process.env.PYTHONPATH;
  else process.env.PYTHONPATH = previousPythonPath;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
