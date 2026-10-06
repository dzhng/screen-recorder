import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
assert.equal(
  process.argv.length,
  5,
  "reference input directory, frozen Signalsmith directory, fresh output required",
);
const [reference, frozen, out] = process.argv.slice(2).map((path) => resolve(path));
assert(!existsSync(out), "Choose a fresh output directory");
mkdirSync(out, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const worker =
  process.env.YAP_STRETCH ?? join(root, "helpers/stretch/.build/release/StretchParity");
const report = { workerSha256: hash(readFileSync(worker)), checks: [], passed: false };
const expected = JSON.parse(
  readFileSync(join(root, "specs/done/agent-editing/assets/13a-signalsmith/report.json")),
);
const vendor = join(root, "helpers/stretch/Sources/CSignalsmith/vendor");
const dependency = JSON.parse(readFileSync(join(vendor, "sources.json")));
for (const f of dependency.files) assert.equal(hash(readFileSync(join(vendor, f.path))), f.sha256);
assert.equal(
  hash(readFileSync(join(root, "packages/test-harness/editing/stretch/Signalsmith.cpp"))),
  expected.cppSha256,
);
report.dependency = dependency;
function call(id, input, start, end, wanted, { rate = 48000, error, expectedHash } = {}) {
  const output = join(out, id + ".f32"),
    args = [input, output, String(start), String(end), String(wanted), String(rate)];
  const result = spawnSync(worker, args, {
    timeout: 60000,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  writeFileSync(
    join(out, id + ".command.json"),
    JSON.stringify(
      {
        worker,
        args,
        status: result.status,
        signal: result.signal,
        error: result.error?.message,
        stdout: result.stdout,
        stderr: result.stderr,
      },
      null,
      2,
    ),
  );
  assert(!result.error, result.error?.message);
  if (error) {
    assert.equal(result.status, 1, id);
    assert.equal(result.stderr.trim(), error, id);
    assert(!existsSync(output), id + " published failure");
    report.checks.push({ id, error });
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  const bytes = readFileSync(output);
  assert.equal(bytes.length, wanted * 4);
  if (expectedHash) assert.equal(hash(bytes), expectedHash, id);
  for (let i = 0; i < wanted; i++) assert(Number.isFinite(bytes.readFloatLE(i * 4)), id);
  report.checks.push({ id, sha256: hash(bytes), frames: wanted });
  return bytes;
}
try {
  for (const item of expected.results) {
    const id = `${item.case}-${item.speed}`,
      input = join(reference, `${item.case}-input.f32`),
      bytes = readFileSync(input);
    assert.equal(hash(bytes), item.inputSha256);
    const old = readFileSync(join(frozen, id + "-exact.f32"));
    assert.equal(hash(old), item.sha256);
    const actual = call(id, input, ...item.sourceFrames, item.expectedFrames, {
      expectedHash: item.sha256,
    });
    assert.deepEqual(actual, old);
    if (item.case === "local-phrase") {
      const poison = Buffer.from(bytes);
      for (let i = 0; i < bytes.length / 4; i++)
        if (i < item.sourceFrames[0] || i >= item.sourceFrames[1])
          poison.writeFloatLE(i % 2 ? 0.9 : -0.9, i * 4);
      const file = join(out, id + "-poison-input.f32");
      writeFileSync(file, poison);
      assert.deepEqual(
        call(id + "-poison", file, ...item.sourceFrames, item.expectedFrames),
        actual,
      );
    }
  }
  for (const item of JSON.parse(
    readFileSync(join(root, "specs/done/agent-editing/assets/13a-support-review/report.json")),
  ).endpoints) {
    const input = Buffer.alloc(72000 * 4);
    input.writeFloatLE(0.8, item.phase * 4);
    input.writeFloatLE(0.8, (71999 - item.phase) * 4);
    assert.equal(hash(input), item.inputSha256);
    const file = join(out, `phase-${item.phase}-input.f32`);
    writeFileSync(file, input);
    call(`phase-${item.phase}-${item.speed}`, file, 0, 72000, item.wanted, {
      expectedHash: item.sha256,
    });
  }
  for (const item of JSON.parse(
    readFileSync(
      join(root, "specs/done/agent-editing/assets/13a-endpoint-verification/evidence.json"),
    ),
  ).admission.filter((v) => v.block === 5760)) {
    const id = `admission-${item.speed}-${item.selectedFrames}`,
      file = join(out, id + "-input.f32");
    writeFileSync(file, Buffer.alloc(item.selectedFrames * 4));
    const bytes = call(
      id,
      file,
      0,
      item.selectedFrames,
      item.outputFrames,
      item.accepted ? {} : { error: "unsupportedSelection" },
    );
    if (item.accepted) assert.deepEqual(bytes, Buffer.alloc(item.outputFrames * 4));
  }
  const contract = spawnSync(worker, ["--contracts"], { timeout: 60000, encoding: "utf8" });
  writeFileSync(
    join(out, "contracts.json"),
    JSON.stringify(
      {
        status: contract.status,
        error: contract.error?.message,
        stdout: contract.stdout,
        stderr: contract.stderr,
      },
      null,
      2,
    ),
  );
  assert.equal(contract.status, 0, contract.stderr);
  assert.equal(contract.stdout.trim(), "PASS format, empty selection and cancellation boundaries");
  const one = join(out, "one-input.f32");
  writeFileSync(one, Buffer.from([0, 0, 0, 128]));
  assert.deepEqual(call("one-frame-identity", one, 0, 1, 1), readFileSync(one));
  call("too-short", one, 0, 1, 2, { error: "unsupportedSelection" });
  call("missing", join(out, "missing.f32"), 0, 1, 1, { error: "missingInput" });
  call("short-input", one, 0, 2, 2, { error: "shortInput" });
  call("zero-count", one, 0, 1, 0, { error: "invalidCount" });
  call("large-count", one, 0, 1, 2880001, { error: "invalidCount" });
  call("wrong-rate", one, 0, 1, 1, { rate: 44100, error: "unsupportedFormat" });
  const nan = join(out, "nan-input.f32");
  const b = Buffer.alloc(4);
  b.writeFloatLE(NaN);
  writeFileSync(nan, b);
  call("nonfinite", nan, 0, 1, 1, { error: "nonfinite" });
  report.passed = true;
} finally {
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length }));
