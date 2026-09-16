import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  appendFileSync,
  existsSync,
  symlinkSync,
  linkSync,
  readdirSync,
  truncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
const executable =
  process.env.SCREENREC_NATIVE ??
  new URL("../.build/debug/screenrec-native", import.meta.url).pathname;
function request(directory, output, extra = {}) {
  const result = spawnSync(executable, [], {
    input:
      JSON.stringify({
        id: "evidence",
        operation: "media.cursorEvidence",
        params: { directory, output, ...extra },
      }) + "\n",
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function fixture(t, records) {
  const root = mkdtempSync(join(tmpdir(), "cursor-evidence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, "source");
  mkdirSync(directory);
  const header = {
    schemaVersion: 1,
    sessionID: "fixture",
    source: { kind: "display", displayID: 1 },
    width: 100,
    height: 80,
    microphone: false,
    systemAudio: false,
  };
  const text =
    [{ event: "header", data: header }, ...records]
      .map((r, i) => JSON.stringify({ sequence: i + 1, ...r }))
      .join("\n") + "\n";
  const journal = join(directory, "capture.journal.jsonl");
  writeFileSync(journal, text);
  return { root, directory, journal, text, output: join(root, "evidence.jsonl") };
}
test("worker exports display-space observations and preserves source", (t) => {
  const f = fixture(t, [
    { event: "displaySpace", data: { hostUs: 123, zeroOriginHeight: 900 } },
    { event: "finished", data: {} },
  ]);
  const r = request(f.directory, f.output);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.finished, true);
  assert.equal(r.data.displaySpaces, 1);
  assert.deepEqual(readFileSync(f.output, "utf8").trim().split("\n").map(JSON.parse), [
    { event: "displaySpace", data: { hostUs: 123, zeroOriginHeight: 900 } },
  ]);
  assert.equal(readFileSync(f.journal, "utf8"), f.text);
});
const sample = {
  sourceUs: 22,
  x: -3,
  y: 9,
  globalX: 100,
  globalY: 200,
  buttons: 1,
  eligibility: "outside",
  geometryEpoch: 1,
};
const geometry = {
  epoch: 1,
  hostUs: 100,
  sourceUs: 0,
  geometry: {
    outputWidth: 100,
    outputHeight: 80,
    contentRect: { x: 0, y: 0, width: 100, height: 80 },
    contentScale: 1,
    scaleFactor: 1,
  },
};
test("samples preserve raw values and geometry ordering across batches", (t) => {
  const f = fixture(t, [
    { event: "geometry", data: geometry },
    { event: "cursorSamples", data: { samples: [sample, { ...sample, sourceUs: 33 }] } },
    { event: "geometry", data: { ...geometry, epoch: 2 } },
    { event: "cursorSamples", data: { samples: [{ ...sample, sourceUs: 44, geometryEpoch: 2 }] } },
  ]);
  const r = request(f.directory, f.output);
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = readFileSync(f.output, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(rows, [
    { event: "geometry", data: geometry },
    { event: "cursorSample", data: sample },
    { event: "cursorSample", data: { ...sample, sourceUs: 33 } },
    { event: "geometry", data: { ...geometry, epoch: 2 } },
    { event: "cursorSample", data: { ...sample, sourceUs: 44, geometryEpoch: 2 } },
  ]);
  assert.equal(r.data.firstCursorSourceUs, 22);
  assert.equal(r.data.lastCursorSourceUs, 44);
  assert.equal(r.data.geometryRecords, 2);
  assert.equal(r.data.cursorSamples, 3);
});

test("corrupt and incomplete tails retain only observed prefix with explicit markers", (t) => {
  for (const [tail, incompleteTail, invalidAtSequence] of [
    ["{", true, undefined],
    ["x".repeat(1_048_577), true, undefined],
    ["{bad}\n", false, 3],
  ]) {
    const f = fixture(t, [{ event: "cursorSamples", data: { samples: [sample] } }]);
    appendFileSync(f.journal, tail);
    const before = readFileSync(f.journal);
    const r = request(f.directory, f.output);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.incompleteTail, incompleteTail);
    assert.equal(r.data.invalidAtSequence, invalidAtSequence);
    assert.equal(r.data.lastSequence, 2);
    assert.equal(r.data.finished, false);
    assert.deepEqual(JSON.parse(readFileSync(f.output, "utf8")), {
      event: "cursorSample",
      data: sample,
    });
    assert.deepEqual(readFileSync(f.journal), before);
  }
});
test("existing paths, links, source descendants and invalid requests never mutate source", (t) => {
  const f = fixture(t, []);
  const existing = join(f.root, "existing");
  writeFileSync(existing, "keep");
  const hard = join(f.root, "hard");
  linkSync(f.journal, hard);
  const symbolic = join(f.root, "symbolic");
  symlinkSync(f.journal, symbolic);
  const dangling = join(f.root, "dangling");
  symlinkSync(join(f.root, "absent"), dangling);
  const alias = join(f.root, "source-alias");
  symlinkSync(f.directory, alias);
  for (const output of [
    existing,
    hard,
    symbolic,
    dangling,
    f.directory,
    f.journal,
    join(f.directory, "new"),
    join(alias, "new"),
  ]) {
    const r = request(f.directory, output);
    assert.equal(r.ok, false, output);
    assert.equal(r.error.code, "INVALID_OUTPUT");
  }
  for (const [directory, output, extra] of [
    [f.directory, "relative", {}],
    [f.directory, f.output, { unexpected: 1 }],
    [f.directory + "\0suffix", f.output, {}],
  ]) {
    assert.equal(request(directory, output, extra).error.code, "INVALID_REQUEST");
  }
  assert.equal(readFileSync(existing, "utf8"), "keep");
  assert.equal(readFileSync(f.journal, "utf8"), f.text);
  assert.equal(existsSync(f.output), false);
  assert.equal(existsSync(join(f.directory, "new")), false);
  assert.equal(
    readdirSync(f.root).some((p) => p.startsWith(".cursor-evidence-")),
    false,
  );
});
test("large journal streams individual samples through the real worker with a small receipt", (t) => {
  const f = fixture(t, []);
  const batches = 2000,
    batchSize = 60;
  for (let batch = 0; batch < batches; batch++)
    appendFileSync(
      f.journal,
      JSON.stringify({
        sequence: batch + 2,
        event: "cursorSamples",
        data: {
          samples: Array.from({ length: batchSize }, (_, i) => ({
            ...sample,
            sourceUs: batch * batchSize + i,
          })),
        },
      }) + "\n",
    );
  const r = request(f.directory, f.output);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.cursorSamples, batches * batchSize);
  assert.equal(r.data.lastCursorSourceUs, batches * batchSize - 1);
  assert.ok(JSON.stringify(r).length < 2048);
  const rows = readFileSync(f.output, "utf8").trim().split("\n");
  assert.equal(rows.length, batches * batchSize);
  assert.deepEqual(JSON.parse(rows.at(-1)), {
    event: "cursorSample",
    data: { ...sample, sourceUs: batches * batchSize - 1 },
  });
});
test("budget and malformed-header failures publish nothing and clean staging", (t) => {
  const f = fixture(t, []);
  truncateSync(f.journal, 268435457);
  assert.equal(request(f.directory, f.output).error.code, "EVIDENCE_LIMIT");
  const oversized = JSON.parse(f.text);
  oversized.data.sessionID = "s".repeat(17000);
  writeFileSync(f.journal, JSON.stringify(oversized) + "\n");
  assert.equal(request(f.directory, f.output).error.code, "EVIDENCE_LIMIT");
  writeFileSync(f.journal, "{bad}\n");
  assert.equal(request(f.directory, f.output).error.code, "INVALID_JOURNAL");
  assert.equal(existsSync(f.output), false);
  assert.deepEqual(readdirSync(f.root), ["source"]);
});
