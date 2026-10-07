import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function preparedParakeet(path) {
  const models = JSON.parse(readFileSync(path)).nativeRequest;
  assert(models?.directory && models.files.length, "Use verified first-class Parakeet preparation");
  const expected = JSON.parse(
    readFileSync(
      new URL(
        "../../../../specs/done/video-editing-feedback/assets/01-corpus-audio/speech-parity/requests.json",
        import.meta.url,
      ),
    ),
  )[0].params.models;
  assert.deepEqual(
    models.files,
    expected.files,
    "Use the frozen first-class Parakeet model inventory",
  );
  return models;
}

export function recognize({ native, models, source, durationUs, name, out, secondsPerCall }) {
  assert(Number.isSafeInteger(durationUs) && durationUs > 0 && durationUs <= 20000000);
  assert(Number.isSafeInteger(secondsPerCall) && secondsPerCall > 0 && secondsPerCall <= 180);
  const request = {
    id: name,
    operation: "speech.transcribe",
    params: {
      models,
      track: {
        source: resolve(source),
        sourceOffsetUs: 0,
        available: [{ startUs: 0, endUs: durationUs }],
      },
      output: join(out, name + ".jsonl"),
      execution: {
        executionRange: null,
        context: { beforeUs: 0, afterUs: 0 },
        recipe: "source-windows-20s-context4s-guard1s-v2",
      },
    },
  };
  writeFileSync(join(out, name + "-request.json"), JSON.stringify(request, null, 2) + "\n");
  const result = spawnSync(
    "/usr/bin/sandbox-exec",
    ["-p", "(version 1)(allow default)(deny network*)", resolve(native)],
    {
      input: JSON.stringify(request) + "\n",
      encoding: "utf8",
      timeout: secondsPerCall * 1000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  writeFileSync(join(out, name + ".stderr.log"), result.stderr ?? "");
  writeFileSync(join(out, name + "-response.json"), result.stdout ?? "");
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert(response.ok, JSON.stringify(response));
  const raw = readFileSync(join(out, name + ".jsonl"));
  assert.equal(createHash("sha256").update(raw).digest("hex"), response.data.output.sha256);
  return raw;
}
