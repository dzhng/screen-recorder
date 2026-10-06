import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { indexScaleMetrics } from "./fixtures/index-scale-metrics.mjs";
import { Catalog } from "../../../packages/core/dist/catalog.js";
import { DerivedCache } from "../../../packages/core/dist/cache.js";
import { ScreenshotIndexStore } from "../../../packages/core/dist/screenshot-index.js";
import { AssetStore } from "../../../packages/core/dist/assets.js";
import { AcquisitionStore } from "../../../packages/core/dist/acquisitions.js";
import { SceneEvidenceStore, assetSceneOwner } from "../../../packages/core/dist/scene-evidence.js";
import { sourceIndexDomain } from "../../../packages/core/dist/source-index.js";
import { selectSource } from "../../../packages/core/dist/source-selection.js";

function fixture(t) {
  const home = mkdtempSync("/tmp/yap-scale-metrics-lock-");
  const database = join(home, "catalog.sqlite");
  const catalog = new Catalog(database);
  new DerivedCache(catalog, home, () => {});
  const assets = new AssetStore(catalog, home),
    acquisitions = new AcquisitionStore(catalog);
  const scenes = new SceneEvidenceStore(catalog, assetSceneOwner(assets, acquisitions));
  new ScreenshotIndexStore(
    catalog,
    home,
    sourceIndexDomain((selection) => selectSource(assets, acquisitions, selection), scenes, null),
  );
  const writer = catalog.catalog;
  // Controlled measurement rows, not a PNG publication; schema comes from current owners.
  writer.exec(`INSERT INTO derived_cache(id,ownerKind,ownerId,bytes,touched) VALUES('cache','asset','asset',37,0);
    INSERT INTO screenshot_index_entries(ownerKind,ownerId,generation,ordinal,bytes,candidate,frame,device,inode,modified)
    VALUES('asset','asset','generation',0,81,'{"requestedSourceUs":100}','{}',0,0,0);`);
  t.after(() => {
    catalog.close();
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
