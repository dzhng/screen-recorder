import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { indexScaleMetrics } from "./fixtures/index-scale-metrics.mjs";

function fixture(t) {
  const home = mkdtempSync("/tmp/screenrec-scale-metrics-lock-");
  const database = join(home, "library.sqlite");
  const writer = new DatabaseSync(database);
  writer.exec(`CREATE TABLE derived_cache(bytes INTEGER);
    CREATE TABLE screenshot_index_entries(bytes INTEGER,candidate TEXT,frame TEXT);
    INSERT INTO derived_cache VALUES(37);
    INSERT INTO screenshot_index_entries VALUES(81,'{"requestedSourceUs":100}','{}');`);
  t.after(() => {
    writer.close();
    rmSync(home, { recursive: true });
  });
  return { database, writer };
}

test("scale metrics retry a real competing writer and read its committed snapshot", async (t) => {
  const { database, writer } = fixture(t);
  writer.exec(
    "BEGIN EXCLUSIVE; UPDATE derived_cache SET bytes=52; UPDATE screenshot_index_entries SET bytes=99",
  );
  const release = setTimeout(() => writer.exec("COMMIT"), 125);
  t.after(() => clearTimeout(release));
  assert.deepEqual(await indexScaleMetrics(database), {
    cacheBytes: 52,
    retainedCandidates: 1,
    retainedPngBytes: 99,
    throughSourceUs: 100,
    retainedRowBytes: 27,
  });
});

test("bounded lock contention is missing evidence, then the next measurement recovers", async (t) => {
  const { database, writer } = fixture(t);
  writer.exec("BEGIN EXCLUSIVE");
  assert.equal(await indexScaleMetrics(database, 60), null);
  writer.exec("ROLLBACK");
  assert.equal((await indexScaleMetrics(database)).cacheBytes, 37);
});

test("permanent catalog errors are never treated as transient contention", async (t) => {
  const { database, writer } = fixture(t);
  writer.exec("DROP TABLE screenshot_index_entries");
  await assert.rejects(indexScaleMetrics(database), /no such table/);
});
