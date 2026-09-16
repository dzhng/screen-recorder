import { setImmediate } from "node:timers/promises";
import { CatalogError, type RevisionStore } from "./library.js";
import { sceneSampleTimes, type SourceSceneAnalysis, type VisualComparison } from "./scenes.js";

export type SceneEvidenceIdentity = {
  recordingId: string;
  sourceId: string;
  generation: string;
  policy: string;
};
export type SceneChunkReport = Awaited<ReturnType<SourceSceneAnalysis["analyze"]>>;
export type SceneEvidenceMetadata = SceneEvidenceIdentity & {
  durationUs: number;
  sourceWidth: number;
  sourceHeight: number;
  chunkCount: number;
  comparisonCount: number;
  boundaryCount: number;
};
type Generation = SceneEvidenceMetadata & {
  throughUs: number;
  complete: number;
  lastComparison: string | null;
};
const where = "recordingId=? AND sourceId=? AND generation=? AND policy=?";
const key = (identity: SceneEvidenceIdentity) => [
  identity.recordingId,
  identity.sourceId,
  identity.generation,
  identity.policy,
];
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}
function metadata(row: Generation): SceneEvidenceMetadata {
  const {
    throughUs: _throughUs,
    complete: _complete,
    lastComparison: _lastComparison,
    ...result
  } = row;
  return result;
}
/** Retained analysis lives in the catalog; queue readiness remains the publication authority. */
export class SceneEvidenceStore {
  constructor(private readonly store: RevisionStore) {
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS scene_evidence_generations (
   recordingId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,policy TEXT NOT NULL,
   durationUs INTEGER NOT NULL,sourceWidth INTEGER NOT NULL,sourceHeight INTEGER NOT NULL,
   throughUs INTEGER NOT NULL,chunkCount INTEGER NOT NULL,comparisonCount INTEGER NOT NULL,
   boundaryCount INTEGER NOT NULL,lastComparison TEXT,complete INTEGER NOT NULL,
   PRIMARY KEY(recordingId,sourceId,generation,policy)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS scene_evidence_chunks (
   recordingId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,policy TEXT NOT NULL,
   startUs INTEGER NOT NULL,content TEXT NOT NULL,
   PRIMARY KEY(recordingId,sourceId,generation,policy,startUs)
  ) STRICT;`);
  }
  private get(identity: SceneEvidenceIdentity): Generation | undefined {
    return this.store.catalog
      .prepare(`SELECT * FROM scene_evidence_generations WHERE ${where}`)
      .get(...key(identity)) as Generation | undefined;
  }
  append(identity: SceneEvidenceIdentity, report: SceneChunkReport): void {
    this.store.transaction(() => {
      const recording = this.store.get(identity.recordingId);
      const durationUs = recording.sourceDurationUs;
      if (
        recording.state === "canceled" ||
        !identity.generation ||
        !identity.policy ||
        recording.sourceId !== identity.sourceId ||
        durationUs === null ||
        report.policy !== identity.policy
      )
        invalid("Scene evidence identity does not match its source");
      if (
        report.kept.startUs !== 0 ||
        report.kept.endUs !== durationUs ||
        !integer(report.sourceWidth) ||
        report.sourceWidth < 1 ||
        !integer(report.sourceHeight) ||
        report.sourceHeight < 1
      )
        invalid("Scene evidence requires canonical source bounds and dimensions");
      const times = sceneSampleTimes(report.range, report.kept);
      if (report.coverage.length !== times.length || report.comparisons.length > 51)
        invalid("Incomplete scene coverage");
      for (const [i, point] of report.coverage.entries()) {
        if (
          point.requestedSourceUs !== times[i] ||
          !integer(point.actualSourceUs) ||
          point.actualSourceUs >= durationUs ||
          !integer(point.stillnessRunStartUs) ||
          point.stillnessRunStartUs > point.actualSourceUs ||
          point.distanceUs !== Math.abs(point.requestedSourceUs - point.actualSourceUs) ||
          !integer(point.width) ||
          point.width < 1 ||
          point.width > 64 ||
          !integer(point.height) ||
          point.height < 1 ||
          point.height > 64 ||
          (i > 0 && point.actualSourceUs < report.coverage[i - 1]!.actualSourceUs)
        )
          invalid("Invalid scene coverage");
      }
      const row = this.get(identity);
      if (row?.complete || report.range.startUs !== (row?.throughUs ?? 0))
        invalid("Scene chunks require contiguous unpublished coverage");
      if (
        row &&
        (row.sourceWidth !== report.sourceWidth ||
          row.sourceHeight !== report.sourceHeight ||
          row.durationUs !== durationUs)
      )
        invalid("Scene source dimensions changed");
      let last: VisualComparison | undefined = row?.lastComparison
        ? (JSON.parse(row.lastComparison) as VisualComparison)
        : undefined;
      const comparisons: VisualComparison[] = [];
      for (const pair of report.comparisons) {
        if (
          !integer(pair.previousActualSourceUs) ||
          !integer(pair.actualSourceUs) ||
          pair.previousActualSourceUs >= pair.actualSourceUs ||
          pair.actualSourceUs >= durationUs ||
          typeof pair.boundary !== "boolean" ||
          ![
            pair.changedPixelFraction,
            pair.changedCellFraction,
            pair.meanAbsoluteChannelDifference,
          ].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
        )
          invalid("Invalid scene comparison");
        if (last && pair.actualSourceUs <= last.actualSourceUs) {
          if (JSON.stringify(pair) !== JSON.stringify(last))
            invalid("Scene comparison moved backwards or changed");
          continue;
        }
        comparisons.push(pair);
        last = pair;
      }
      const boundaries = comparisons
        .filter((pair) => pair.boundary)
        .map((pair) => ({ kind: "scene" as const, atSourceUs: pair.actualSourceUs }));
      const content = JSON.stringify({
        policy: report.policy,
        range: report.range,
        kept: report.kept,
        sourceWidth: report.sourceWidth,
        sourceHeight: report.sourceHeight,
        coverage: report.coverage,
        comparisons,
        boundaries,
      });
      if (Buffer.byteLength(content) > 65_536) invalid("Scene chunk exceeds bounded storage");
      if (!row)
        this.store.catalog
          .prepare(`INSERT INTO scene_evidence_generations VALUES (?,?,?,?,?,?,?,0,0,0,0,NULL,0)`)
          .run(...key(identity), durationUs, report.sourceWidth, report.sourceHeight);
      this.store.catalog
        .prepare("INSERT INTO scene_evidence_chunks VALUES (?,?,?,?,?,?)")
        .run(...key(identity), report.range.startUs, content);
      this.store.catalog
        .prepare(
          `UPDATE scene_evidence_generations SET throughUs=?,chunkCount=chunkCount+1,comparisonCount=comparisonCount+?,boundaryCount=boundaryCount+?,lastComparison=? WHERE ${where}`,
        )
        .run(
          report.range.endUs,
          comparisons.length,
          boundaries.length,
          last ? JSON.stringify(last) : null,
          ...key(identity),
        );
    });
  }
  finish(identity: SceneEvidenceIdentity, durationUs: number): SceneEvidenceMetadata {
    return this.store.transaction(() => {
      const row = this.get(identity);
      if (
        !row ||
        row.complete === -1 ||
        row.durationUs !== durationUs ||
        row.throughUs !== durationUs
      )
        invalid("Scene coverage is incomplete");
      this.store.catalog
        .prepare(`UPDATE scene_evidence_generations SET complete=1 WHERE ${where}`)
        .run(...key(identity));
      return metadata(row);
    });
  }
  page({
    identity,
    afterStartUs,
    limit = 100,
  }: {
    identity: SceneEvidenceIdentity;
    afterStartUs?: number;
    limit?: number;
  }): { metadata: SceneEvidenceMetadata; chunks: SceneChunkReport[]; nextStartUs: number | null } {
    if (
      !integer(limit) ||
      limit < 1 ||
      limit > 100 ||
      (afterStartUs !== undefined && !integer(afterStartUs))
    )
      throw new CatalogError("INVALID_PARAMS", "Invalid scene page limit or cursor");
    const row = this.get(identity);
    if (row?.complete !== 1) invalid("Scene evidence is not complete");
    const rows = this.store.catalog
      .prepare(
        `SELECT startUs,content FROM scene_evidence_chunks WHERE ${where} AND startUs>? ORDER BY startUs LIMIT ?`,
      )
      .all(...key(identity), afterStartUs ?? -1, limit + 1) as {
      startUs: number;
      content: string;
    }[];
    const more = rows.length > limit;
    if (more) rows.pop();
    return {
      metadata: metadata(row),
      chunks: rows.map((r) => JSON.parse(r.content) as SceneChunkReport),
      nextStartUs: more ? rows.at(-1)!.startUs : null,
    };
  }
  async remove(identity: SceneEvidenceIdentity): Promise<void> {
    this.store.transaction(() => {
      this.store.catalog
        .prepare(`UPDATE scene_evidence_generations SET complete=-1 WHERE ${where}`)
        .run(...key(identity));
    });
    while (true) {
      const removed = this.store.transaction(
        () =>
          this.store.catalog
            .prepare(
              `DELETE FROM scene_evidence_chunks WHERE rowid IN (SELECT rowid FROM scene_evidence_chunks WHERE ${where} LIMIT 100)`,
            )
            .run(...key(identity)).changes,
      );
      if (Number(removed) < 100) break;
      await setImmediate();
    }
    this.store.transaction(() => {
      this.store.catalog
        .prepare(`DELETE FROM scene_evidence_generations WHERE ${where}`)
        .run(...key(identity));
    });
  }
  async reclaim(
    recordingId: string,
    keep: (generation: string) => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    let cursor = 0;
    while (true) {
      signal?.throwIfAborted();
      const rows = this.store.catalog
        .prepare(
          "SELECT rowid AS cursor,recordingId,sourceId,generation,policy FROM scene_evidence_generations WHERE recordingId=? AND rowid>? ORDER BY rowid LIMIT 100",
        )
        .all(recordingId, cursor) as (SceneEvidenceIdentity & { cursor: number })[];
      for (const row of rows) {
        signal?.throwIfAborted();
        if (!keep(row.generation)) await this.remove(row);
        cursor = row.cursor;
      }
      if (rows.length < 100) return;
      await setImmediate();
    }
  }
}
