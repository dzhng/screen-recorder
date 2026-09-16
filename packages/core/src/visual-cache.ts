import { writeFile } from "node:fs/promises";
import type { RevisionStore } from "./library.js";
import { CatalogError } from "./library.js";
import type { DerivedCache } from "./cache.js";
import {
  analyzeVisualSamples,
  observeVisualSamples,
  scenePolicy,
  type VisualObservations,
  type VisualSampler,
} from "./scenes.js";

/** Reuses bounded native observations; retained scene conclusions belong to scene evidence. */
export class VisualObservationCache {
  constructor(
    private readonly store: RevisionStore,
    private readonly cache: DerivedCache,
    private readonly decode: VisualSampler,
  ) {
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS visual_observation_cache (
      identity TEXT PRIMARY KEY, cacheId TEXT NOT NULL UNIQUE REFERENCES derived_cache(id) ON DELETE CASCADE
    ) STRICT;`);
  }

  readonly sample: VisualSampler = async (request, signal) => {
    signal.throwIfAborted();
    const { atSourceUs: times, kept } = request;
    if (
      !Number.isSafeInteger(kept.startUs) ||
      !Number.isSafeInteger(kept.endUs) ||
      kept.startUs < 0 ||
      kept.endUs <= kept.startUs ||
      times.length < 1 ||
      times.length > 52 ||
      times.some(
        (at, i) =>
          !Number.isSafeInteger(at) ||
          at < kept.startUs ||
          at >= kept.endUs ||
          (i > 0 && at <= times[i - 1]!),
      ) ||
      times.at(-1)! - times[0]! > 10_200_000
    )
      throw new CatalogError(
        "INVALID_RANGE",
        "Visual observations require a bounded ordered retained batch",
      );
    // Finalized source paths name immutable recording media; moving a library merely misses reuse.
    const identity = JSON.stringify([
      scenePolicy.id,
      request.source,
      kept.startUs,
      kept.endUs,
      times,
    ]);
    const existing = this.read(identity);
    if (existing) return existing;
    const observed = await observeVisualSamples(request, this.decode, signal);
    analyzeVisualSamples(observed.samples);
    signal.throwIfAborted();
    const output = this.cache.reserve();
    try {
      await writeFile(output.path, JSON.stringify(observed), { flag: "wx" });
      signal.throwIfAborted();
      await this.cache.publish(output.id);
      signal.throwIfAborted();
      // Independent frame lanes can miss together. Keep the first reusable publication.
      const winner = this.read(identity);
      if (winner) {
        this.cache.remove(output.id);
        return winner;
      }
      this.store.catalog
        .prepare("INSERT INTO visual_observation_cache(identity,cacheId) VALUES (?,?)")
        .run(identity, output.id);
      return observed;
    } catch (error) {
      this.cache.remove(output.id);
      throw error;
    }
  };

  private read(identity: string): VisualObservations | null {
    const row = this.store.catalog
      .prepare("SELECT cacheId FROM visual_observation_cache WHERE identity=?")
      .get(identity) as { cacheId: string } | undefined;
    if (!row) return null;
    const held = this.cache.acquire(row.cacheId);
    if (!held) return null;
    try {
      const bytes = Buffer.alloc(held.bytes);
      let offset = 0;
      while (offset < bytes.length) {
        const count = held.read(bytes.subarray(offset), offset);
        if (count === 0)
          throw new CatalogError("INVALID_CACHE", "Visual observation cache ended early");
        offset += count;
      }
      return JSON.parse(bytes.toString("utf8")) as VisualObservations;
    } finally {
      held.release();
    }
  }
}
