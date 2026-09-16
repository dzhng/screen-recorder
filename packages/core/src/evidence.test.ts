import { test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevisionStore } from "./library.js";
import { CursorEvidenceStore } from "./evidence.js";
const roots: string[] = [];
const stores: RevisionStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  roots.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
});
function fixture(times = [0, 10, 10, 20]) {
  const root = mkdtempSync(join(tmpdir(), "evidence-"));
  roots.push(root);
  let id = 0;
  const store = new RevisionStore(join(root, "library.sqlite"), {
    now: () => "",
    newId: () => `id-${++id}`,
  });
  stores.push(store);
  const recording = store.allocate().recording;
  const identity = {
    recordingId: recording.recordingId,
    sourceId: recording.sourceId,
    generation: "attempt-1",
  };
  const samples = times.map((sourceUs) => ({
    sourceUs,
    x: -2,
    y: 4,
    globalX: 22,
    globalY: 44,
    buttons: 0,
    eligibility: "outside",
    geometryEpoch: 1,
  }));
  const file = join(root, "normalized.jsonl");
  const body = samples
    .map((data) => JSON.stringify({ event: "cursorSample", data }) + "\n")
    .join("");
  writeFileSync(file, body);
  const receipt = {
    file,
    journal: "capture.journal.jsonl",
    header: { sessionID: recording.sourceId },
    cursorSamples: times.length,
    geometryRecords: 0,
    displaySpaces: 0,
    firstCursorSourceUs: times[0] ?? null,
    lastCursorSourceUs: times.at(-1) ?? null,
    lastSequence: 5,
    incompleteTail: true,
    invalidAtSequence: 6,
    finished: false,
    bytes: Buffer.byteLength(body),
  };
  return { store, evidence: new CursorEvidenceStore(store), identity, file, receipt, samples };
}
test("pages equal-time raw samples with explicit range and stable continuation", async () => {
  const f = fixture();
  await f.evidence.ingest({ ...f.identity, file: f.file, receipt: f.receipt });
  const first = f.evidence.page({ ...f.identity, range: { startUs: 10, endUs: 20 }, limit: 1 });
  expect(first.samples).toEqual([{ sequence: 2, ...f.samples[1] }]);
  expect(
    f.evidence.page({
      ...f.identity,
      range: { startUs: 10, endUs: 20 },
      afterSequence: first.nextSequence!,
      limit: 1,
    }),
  ).toEqual({ samples: [{ sequence: 3, ...f.samples[2] }], nextSequence: null });
});

test("generations and recording identities never share pages; duplicate ingestion preserves evidence", async () => {
  const f = fixture();
  const metadata = await f.evidence.ingest({ ...f.identity, file: f.file, receipt: f.receipt });
  expect(metadata.receipt).toEqual(f.receipt);
  const newer = { ...f.identity, generation: "attempt-2" };
  await f.evidence.ingest({ ...newer, file: f.file, receipt: f.receipt });
  await expect(
    f.evidence.ingest({ ...f.identity, file: f.file, receipt: f.receipt }),
  ).rejects.toThrow("already exists");
  await expect(
    f.evidence.ingest({
      ...f.identity,
      generation: "bad",
      sourceId: "wrong",
      file: f.file,
      receipt: f.receipt,
    }),
  ).rejects.toThrow("identity");
  expect(() =>
    f.evidence.page({ ...newer, sourceId: "wrong", range: { startUs: 0, endUs: 30 } }),
  ).toThrow("not indexed");
  f.evidence.removeUnpublished(newer);
  expect(() => f.evidence.page({ ...newer, range: { startUs: 0, endUs: 30 } })).toThrow(
    "not indexed",
  );
  expect(
    f.evidence.page({ ...f.identity, range: { startUs: 0, endUs: 30 } }).samples.map((s) => s.x),
  ).toEqual([-2, -2, -2, -2]);
});

test("malformed normalized data and receipt mismatch remove all partial rows", async () => {
  const f = fixture(Array.from({ length: 600 }, (_, i) => i));
  writeFileSync(f.file, '{"event":"cursorSample","data":{"sourceUs":1.5}}\n', { flag: "a" });
  const { statSync } = await import("node:fs");
  await expect(
    f.evidence.ingest({
      ...f.identity,
      file: f.file,
      receipt: { ...f.receipt, bytes: statSync(f.file).size },
    }),
  ).rejects.toThrow("Invalid normalized");
  expect(
    f.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_records").get(),
  ).toEqual({ n: 0 });
  expect(() => f.evidence.page({ ...f.identity, range: { startUs: 0, endUs: 1000 } })).toThrow(
    "not indexed",
  );
  const g = fixture();
  await expect(
    g.evidence.ingest({
      ...g.identity,
      file: g.file,
      receipt: { ...g.receipt, cursorSamples: 99 },
    }),
  ).rejects.toThrow("receipt");
  expect(
    g.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_generations").get(),
  ).toEqual({ n: 0 });
});

test("bounded batches yield and cancellation cleans a partially indexed generation", async () => {
  const f = fixture(Array.from({ length: 4000 }, (_, i) => i));
  const controller = new AbortController();
  const { setImmediate } = await import("node:timers/promises");
  const ingest = f.evidence.ingest({
    ...f.identity,
    file: f.file,
    receipt: f.receipt,
    signal: controller.signal,
  });
  let sawPartial = false;
  for (let i = 0; i < 200; i++) {
    await setImmediate();
    if (
      (f.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_records").get()!
        .n as number) > 0
    ) {
      sawPartial = true;
      break;
    }
  }
  expect(sawPartial).toBe(true);
  expect(() => f.evidence.page({ ...f.identity, range: { startUs: 0, endUs: 5000 } })).toThrow(
    "not indexed",
  );
  controller.abort();
  await expect(ingest).rejects.toThrow();
  expect(
    f.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_records").get(),
  ).toEqual({ n: 0 });
  expect(
    f.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_generations").get(),
  ).toEqual({ n: 0 });
});

test("retains geometry/display records and unknown raw fields without geometry reinterpretation", async () => {
  const f = fixture([10]);
  const records = [
    { event: "displaySpace", data: { hostUs: 50, zeroOriginHeight: 1080 } },
    {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 51,
        geometry: {
          outputWidth: 100,
          outputHeight: 100,
          contentScale: 1,
          scaleFactor: 2,
          contentRect: { x: 0, y: 0, width: 50, height: 50 },
        },
      },
    },
    { event: "cursorSample", data: { ...f.samples[0], nativeExtra: "preserved" } },
  ];
  const body = records.map((r) => JSON.stringify(r) + "\n").join("");
  writeFileSync(f.file, body);
  await f.evidence.ingest({
    ...f.identity,
    file: f.file,
    receipt: { ...f.receipt, geometryRecords: 1, displaySpaces: 1, bytes: Buffer.byteLength(body) },
  });
  expect(
    f.store.catalog
      .prepare("SELECT event,content FROM cursor_evidence_records ORDER BY sequence")
      .all()
      .map((r) => ({ event: r.event, data: JSON.parse(r.content as string) })),
  ).toEqual(records);
  expect(f.evidence.page({ ...f.identity, range: { startUs: 0, endUs: 20 } }).samples).toEqual([
    { sequence: 3, ...records[2]!.data },
  ]);
});

test("large streamed evidence pages seek through SQLite without reading the file again", async () => {
  const f = fixture([]);
  const { open, readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const handle = await open(f.file, "w");
  const total = 50000;
  let bytes = 0;
  for (let start = 0; start < total; start += 250) {
    const lines = Array.from(
      { length: 250 },
      (_, i) =>
        JSON.stringify({
          event: "cursorSample",
          data: {
            sourceUs: Math.floor((start + i) / 2),
            globalX: 1,
            globalY: 2,
            buttons: 0,
            eligibility: "unknownGeometry",
            geometryEpoch: 0,
          },
        }) + "\n",
    ).join("");
    await handle.write(lines);
    bytes += Buffer.byteLength(lines);
  }
  await handle.close();
  const hash = async () =>
    createHash("sha256")
      .update(await readFile(f.file))
      .digest("hex");
  const before = await hash();
  await f.evidence.ingest({
    ...f.identity,
    file: f.file,
    receipt: {
      ...f.receipt,
      cursorSamples: total,
      firstCursorSourceUs: 0,
      lastCursorSourceUs: 24999,
      bytes,
    },
  });
  expect(await hash()).toBe(before);
  rmSync(f.file);
  const range = { startUs: 24900, endUs: 25000 };
  let afterSequence: number | undefined;
  const sequences: number[] = [];
  do {
    const page = f.evidence.page({
      ...f.identity,
      range,
      limit: 17,
      ...(afterSequence === undefined ? {} : { afterSequence }),
    });
    sequences.push(...page.samples.map((s) => s.sequence));
    afterSequence = page.nextSequence ?? undefined;
  } while (afterSequence);
  expect(sequences).toEqual(Array.from({ length: 200 }, (_, i) => 49801 + i));
  const plans = f.store.catalog
    .prepare(
      "EXPLAIN QUERY PLAN SELECT sequence,content FROM cursor_evidence_records WHERE recordingId=? AND sourceId=? AND generation=? AND event='cursorSample' AND sourceUs>=? AND sourceUs<? AND (sourceUs,sequence)>(?,?) ORDER BY sourceUs,sequence LIMIT ?",
    )
    .all(
      f.identity.recordingId,
      f.identity.sourceId,
      f.identity.generation,
      24900,
      25000,
      24990,
      49981,
      18,
    );
  expect(plans.map((p) => p.detail).join(" ")).toContain(
    "SEARCH cursor_evidence_records USING INDEX cursor_evidence_time",
  );
  expect(plans.map((p) => p.detail).join(" ")).not.toContain("TEMP B-TREE");
});

test("source time ordering handles out-of-order records and bounds invalid requests", async () => {
  const f = fixture([20, 10, 10, 0]);
  await f.evidence.ingest({ ...f.identity, file: f.file, receipt: f.receipt });
  const range = { startUs: 0, endUs: 30 };
  const first = f.evidence.page({ ...f.identity, range, limit: 2 });
  expect(first.samples.map((s) => s.sequence)).toEqual([4, 2]);
  expect(
    f.evidence
      .page({ ...f.identity, range, afterSequence: first.nextSequence! })
      .samples.map((s) => s.sequence),
  ).toEqual([3, 1]);
  expect(() => f.evidence.page({ ...f.identity, range, limit: 5001 })).toThrow("limit");
  expect(() => f.evidence.page({ ...f.identity, range, afterSequence: 99 })).toThrow(
    "continuation",
  );
  expect(() => f.evidence.page({ ...f.identity, range: { startUs: 0.5, endUs: 30 } })).toThrow(
    "range",
  );
});

test("rejects a wrong export path and nonfinite coordinates without publishing rows", async () => {
  const f = fixture();
  await expect(
    f.evidence.ingest({
      ...f.identity,
      file: f.file,
      receipt: { ...f.receipt, file: "/different" },
    }),
  ).rejects.toThrow("receipt");
  const body =
    '{"event":"cursorSample","data":{"sourceUs":0,"globalX":1e999,"globalY":2,"buttons":0,"eligibility":"inside","geometryEpoch":1}}\n';
  writeFileSync(f.file, body);
  await expect(
    f.evidence.ingest({
      ...f.identity,
      file: f.file,
      receipt: { ...f.receipt, bytes: Buffer.byteLength(body) },
    }),
  ).rejects.toThrow("sample");
  expect(
    f.store.catalog.prepare("SELECT count(*) AS n FROM cursor_evidence_generations").get(),
  ).toEqual({ n: 0 });
});

test("cursor pages honor the contract's 1000 default and inclusive 5000 maximum", async () => {
  const f = fixture(Array.from({ length: 5001 }, (_, i) => i));
  await f.evidence.ingest({ ...f.identity, file: f.file, receipt: f.receipt });
  const request = { ...f.identity, range: { startUs: 0, endUs: 6000 } };
  const normal = f.evidence.page(request);
  expect(normal.samples).toEqual(
    f.samples.slice(0, 1000).map((sample, i) => ({ ...sample, sequence: i + 1 })),
  );
  expect(normal.nextSequence).toBe(1000);
  const maximum = f.evidence.page({ ...request, limit: 5000 });
  expect(maximum.samples.at(-1)).toEqual({ ...f.samples[4999], sequence: 5000 });
  expect(maximum.samples).toHaveLength(5000);
  expect(maximum.nextSequence).toBe(5000);
  expect(
    f.evidence.page({ ...request, limit: 5000, afterSequence: maximum.nextSequence! }),
  ).toEqual({
    samples: [{ ...f.samples[5000], sequence: 5001 }],
    nextSequence: null,
  });
  expect(() => f.evidence.page({ ...request, limit: 5001 })).toThrow("range or limit");
});
