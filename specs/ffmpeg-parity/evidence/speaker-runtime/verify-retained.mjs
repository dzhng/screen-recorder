import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { join } from "node:path";

const { values } = parseArgs({
  options: { "runtime-artifact": { type: "string" }, out: { type: "string" } },
});
assert(values.out, "An explicit fresh diagnostic --out directory is required");
const root = new URL("./", import.meta.url);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const operand = values["runtime-artifact"] ?? new URL("runtime-artifact.json.gz", root);
const bytes = await readFile(operand);
const raw = String(operand).endsWith(".gz") ? gunzipSync(bytes) : bytes;
const protocolBytes = await read("frozen-protocol.json");
const assemblyBytes = await read("assembly-verification.json");
await mkdir(values.out, { mode: 0o700 });
await writeFile(join(values.out, "runtime-artifact.json.gz"), gzipSync(raw), { flag: "wx" });
await writeFile(join(values.out, "frozen-protocol.json"), protocolBytes, { flag: "wx" });
await writeFile(join(values.out, "assembly-verification.json"), assemblyBytes, { flag: "wx" });
const report = {
  verified: false,
  scope: "Post-run retained-operand verification; no assembly, preparation or inference",
  protocolSha256: sha(protocolBytes),
  observerSha256: sha(await read("verify-retained.mjs")),
  runtimeArtifactSha256: sha(raw),
};
const save = () =>
  writeFile(join(values.out, "verification.json"), JSON.stringify(report, null, 2) + "\n");
await save();
try {
  const protocol = JSON.parse(protocolBytes),
    assembly = JSON.parse(assemblyBytes);
  assert.equal(assembly.verified, true, "Assembly receipt is unverified");
  const artifact = JSON.parse(raw);
  const assemblyInputBytes = await read("assembly-input-protocol.json");
  assert.equal(
    sha(assemblyInputBytes),
    assembly.protocolSha256,
    "Assembly protocol identity changed",
  );
  const assemblyInput = JSON.parse(assemblyInputBytes);
  const originalNative = assemblyInput.boundFiles.find(
    (input) => input.path === "../../../../packages/test-harness/editing/runtime-native.py",
  );
  const originalNativeBytes = await read("assembly-runtime-native.py");
  assert.equal(originalNativeBytes.length, originalNative.bytes);
  assert.equal(sha(originalNativeBytes), originalNative.sha256);
  report.assemblyProtocolSha256 = sha(assemblyInputBytes);
  const runtimeDigest = sha(JSON.stringify(artifact.entries));
  assert.equal(runtimeDigest, assembly.manifestSha256, "Frozen runtime inventory changed");
  assert.equal(artifact.digest, runtimeDigest, "Artifact digest disagrees with complete inventory");
  report.archivedSourceBindings = [];
  for (const input of protocol.boundFiles) {
    const archive = {
      "../../../../packages/test-harness/editing/runtime-native.py": "frozen-runtime-native.py",
      "../../../../apps/service/src/worker.ts": "frozen-json-worker.ts",
    }[input.path];
    const actual = await read(archive ?? input.path);
    if (archive)
      report.archivedSourceBindings.push({
        originalPath: input.path,
        archive,
        currentSourceSha256: sha(await read(input.path)),
        frozenSha256: input.sha256,
      });
    assert.equal(actual.length, input.bytes, input.path);
    assert.equal(sha(actual), input.sha256, input.path);
  }
  const retention = await json("retained-invocation.json");
  assert.equal(retention.protocolSha256, sha(protocolBytes));
  for (const file of retention.files) {
    const compressed = await read(file.path);
    const original = file.compressedSha256 ? gunzipSync(compressed) : compressed;
    if (file.compressedSha256) {
      assert.equal(sha(compressed), file.compressedSha256, file.path);
      assert.equal(compressed.length, file.compressedBytes, file.path);
    }
    assert.equal(sha(original), file.sha256, file.path);
    assert.equal(original.length, file.bytes, file.path);
  }
  const privateManifest = JSON.parse(gunzipSync(await read("private-manifest.json.gz")));
  assert.deepEqual(privateManifest.runtimeArtifact, artifact);
  const manifest = gunzipSync(await read("runtime-manifest.json.gz"));
  assert.equal(sha(manifest), assembly.manifestSha256);
  assert.deepEqual(JSON.parse(manifest), artifact.entries);
  const prepared = await json("prepared-runtime.json");
  assert.equal(prepared.runtimeDigest, runtimeDigest);
  assert.equal(prepared.runtimeRevision, runtimeDigest);
  assert.equal(prepared.modelRevision, protocol.model.revision);
  const comparison = await json("comparison.json");
  assert.equal(comparison.passed, true);
  assert.equal(comparison.runtimeDigest, runtimeDigest);
  assert.deepEqual(comparison.exactFields, protocol.comparison.exactFields);
  const output = await json("bspxd.json"),
    original = await json("../speaker-original/bspxd.json");
  for (const field of protocol.comparison.exactFields)
    assert.deepEqual(output[field], original[field], field);
  const transport = await json("response-unverified.json");
  assert.equal(transport.result.ok, true);
  assert(transport.wallSeconds <= protocol.execution.deadlineSeconds);
  assert(output.inferenceSeconds <= protocol.comparison.gate.inferenceSecondsMaximum);
  assert(output.peakProcessRSSBytes <= protocol.comparison.gate.peakProcessRSSBytesMaximum);
  assert.equal((await json("preparation-result.json")).state, "ready");
  const restart = await json("offline-restart.json");
  assert.equal(restart.state, "ready");
  Object.assign(report, {
    verified: true,
    runtimeDigest,
    exactFields: comparison.exactFields,
    preparationSeconds: restart.preparationSeconds,
    inferenceSeconds: output.inferenceSeconds,
    peakProcessRSSBytes: output.peakProcessRSSBytes,
    workerWallSeconds: transport.wallSeconds,
  });
  await save();
  console.log(JSON.stringify(report));
} catch (error) {
  report.error = String(error);
  await save();
  throw error;
}
