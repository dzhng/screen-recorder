import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

/** Current DerivedCache and ScreenshotIndexStore share this catalog snapshot, including
 * selected-source index entries. A transient writer lock leaves an explicit missing measurement;
 * callers can keep observing the render and require a complete snapshot at completion. */
export async function indexScaleMetrics(database, waitMs = 1000) {
  const deadline = performance.now() + waitMs;
  for (;;) {
    let db;
    try {
      db = new DatabaseSync(database, { readOnly: true });
      return {
        ...db
          .prepare(`SELECT
          (SELECT COALESCE(SUM(bytes), 0) FROM derived_cache) AS cacheBytes,
          COUNT(*) AS retainedCandidates,
          COALESCE(SUM(bytes), 0) AS retainedPngBytes,
          MAX(json_extract(candidate, '$.requestedSourceUs')) AS throughSourceUs,
          COALESCE(SUM(length(candidate)+length(frame)), 0) AS retainedRowBytes
          FROM screenshot_index_entries`)
          .get(),
      };
    } catch (error) {
      // SQLITE_BUSY alone is temporary. Schema, corruption and other failures stay visible.
      if (error.errcode !== 5) throw error;
    } finally {
      db?.close();
    }
    if (performance.now() >= deadline) return null;
    await delay(Math.min(50, Math.max(0, deadline - performance.now())));
  }
}
