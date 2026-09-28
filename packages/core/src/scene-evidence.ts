import { isDeepStrictEqual } from "node:util";
import { ownerIdentity, type JobOwner } from "./jobs.js";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { selectSource } from "./source-selection.js";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import { sceneSampleTimes, type SourceSceneAnalysis, type VisualComparison } from "./scenes.js";

export type SceneOwner = Extract<JobOwner, { kind: "recording" | "asset" }>;
export type SceneEvidenceIdentity = {
  owner: SceneOwner;
  sourceId: string;
  generation: string;
  policy: string;
};
export type SceneSource = { durationUs: number } & (
  | { kind: "recording" }
  | { kind: "asset"; streamId: string; acquisitionId?: string; supportDigest: string }
);
export type RecordingSceneEvidenceIdentity = {
  recordingId: string;
  sourceId: string;
  generation: string;
  policy: string;
};
export type SceneChunkReport = Awaited<ReturnType<SourceSceneAnalysis["analyze"]>>;
type SceneDetails = {
  sourceWidth: number;
  sourceHeight: number;
  chunkCount: number;
  comparisonCount: number;
  boundaryCount: number;
};
export type SceneEvidenceMetadata = SceneEvidenceIdentity & SceneDetails & { source: SceneSource };
export type RecordingSceneEvidenceMetadata = RecordingSceneEvidenceIdentity &
  SceneDetails & { durationUs: number };
export function recordingSceneIdentity({
  recordingId,
  sourceId,
  generation,
  policy,
}: RecordingSceneEvidenceIdentity): SceneEvidenceIdentity {
  return { sourceId, generation, policy, owner: { kind: "recording", recordingId } };
}
export function recordingSceneMetadata({
  owner,
  source,
  ...metadata
}: SceneEvidenceMetadata): RecordingSceneEvidenceMetadata {
  if (owner.kind !== "recording" || source.kind !== "recording")
    invalid("Recording scene view requires a recording source");
  return { ...metadata, recordingId: owner.recordingId, durationUs: source.durationUs };
}
export function recordingSceneOwner(store: RevisionStore) {
  return (identity: SceneEvidenceIdentity, source: SceneSource): void => {
    if (identity.owner.kind !== "recording" || source.kind !== "recording")
      invalid("Scene identity requires a recording source");
    const recording = store.get(identity.owner.recordingId);
    if (
      recording.state === "canceled" ||
      recording.sourceId !== identity.sourceId ||
      recording.sourceDurationUs !== source.durationUs
    )
      invalid("Scene evidence identity does not match its source");
  };
}
export function assetSceneOwner(assets: AssetStore, acquisitions: AcquisitionStore) {
  return (identity: SceneEvidenceIdentity, source: SceneSource): void => {
    if (
      identity.owner.kind !== "asset" ||
      source.kind !== "asset" ||
      identity.sourceId !== identity.owner.assetId
    )
      invalid("Scene identity requires an asset source");
    const selected = selectSource(assets, acquisitions, {
      assetId: identity.owner.assetId,
      streamId: source.streamId,
      ...(source.acquisitionId === undefined ? {} : { acquisitionId: source.acquisitionId }),
    });
    if (selected.stream.kind !== "video") invalid("Scene evidence requires a video stream");
    if (
      !isDeepStrictEqual(source, {
        kind: "asset",
        streamId: selected.selection.streamId,
        ...(selected.selection.acquisitionId === undefined
          ? {}
          : { acquisitionId: selected.selection.acquisitionId }),
        supportDigest: selected.supportDigest,
        durationUs: selected.durationUs,
      })
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Scene source support changed");
  };
}
type Generation = SceneDetails & {
  ownerKind: SceneOwner["kind"];
  ownerId: string;
  sourceId: string;
  generation: string;
  policy: string;
  source: string;
  durationUs: number;
  throughUs: number;
  complete: number;
  lastComparison: string | null;
};
const where = "ownerKind=? AND ownerId=? AND sourceId=? AND generation=? AND policy=?";
const key = (identity: SceneEvidenceIdentity) => [
  ...ownerIdentity(identity.owner),
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
    ownerKind,
    ownerId,
    source,
    durationUs,
    throughUs: _throughUs,
    complete: _complete,
    lastComparison: _lastComparison,
    ...details
  } = row;
  const owner: SceneOwner =
    ownerKind === "recording"
      ? { kind: "recording", recordingId: ownerId }
      : { kind: "asset", assetId: ownerId };
  return { ...details, owner, source: { ...JSON.parse(source), durationUs } };
}
/** Scene resets are the boundary comparisons; chunks do not store a second copy. */
export function sceneBoundaries(chunk: Pick<SceneChunkReport, "comparisons">) {
  return chunk.comparisons
    .filter((pair) => pair.boundary)
    .map((pair) => ({ kind: "scene" as const, atSourceUs: pair.actualSourceUs }));
}

/** Canonical chunk semantics shared by append and portable payload reads. */
export function normalizeSceneChunk(
  report: SceneChunkReport,
  durationUs: number,
  previous?: VisualComparison,
) {
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
  let last = previous;
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
  const chunk: SceneChunkReport = {
    policy: report.policy,
    range: report.range,
    kept: report.kept,
    sourceWidth: report.sourceWidth,
    sourceHeight: report.sourceHeight,
    coverage: report.coverage,
    comparisons,
  };
  if (Buffer.byteLength(JSON.stringify(chunk)) > 65_536)
    invalid("Scene chunk exceeds bounded storage");
  return { chunk, last };
}

export abstract class SceneEvidenceReader {
  protected abstract readMetadata(identity: SceneEvidenceIdentity): SceneEvidenceMetadata;
  protected abstract readChunks(
    identity: SceneEvidenceIdentity,
    afterStartUs: number,
    limit: number,
  ): SceneChunkReport[];
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
    const metadata = this.readMetadata(identity);
    const rows = this.readChunks(identity, afterStartUs ?? -1, limit + 1);
    const more = rows.length > limit;
    if (more) rows.pop();
    return {
      metadata,
      chunks: rows,
      nextStartUs: more ? rows.at(-1)!.range.startUs : null,
    };
  }
}

/** Retained analysis lives in the catalog; queue readiness remains the publication authority. */
export class SceneEvidenceStore extends SceneEvidenceReader {
  constructor(
    private readonly store: Catalog,
    private readonly validateOwner: (identity: SceneEvidenceIdentity, source: SceneSource) => void,
  ) {
    super();
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS scene_evidence_generations (
   ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,policy TEXT NOT NULL,
   source TEXT NOT NULL,durationUs INTEGER NOT NULL,sourceWidth INTEGER NOT NULL,sourceHeight INTEGER NOT NULL,
   throughUs INTEGER NOT NULL,chunkCount INTEGER NOT NULL,comparisonCount INTEGER NOT NULL,
   boundaryCount INTEGER NOT NULL,lastComparison TEXT,complete INTEGER NOT NULL,
   PRIMARY KEY(ownerKind,ownerId,sourceId,generation,policy)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS scene_evidence_chunks (
   ownerKind TEXT NOT NULL,ownerId TEXT NOT NULL,sourceId TEXT NOT NULL,generation TEXT NOT NULL,policy TEXT NOT NULL,
   startUs INTEGER NOT NULL,content TEXT NOT NULL,
   PRIMARY KEY(ownerKind,ownerId,sourceId,generation,policy,startUs)
  ) STRICT;`);
  }
  private get(identity: SceneEvidenceIdentity): Generation | undefined {
    return this.store.catalog
      .prepare(`SELECT * FROM scene_evidence_generations WHERE ${where}`)
      .get(...key(identity)) as Generation | undefined;
  }
  append(identity: SceneEvidenceIdentity, source: SceneSource, report: SceneChunkReport): void {
    this.store.transaction(() => {
      this.validateOwner(identity, source);
      const { durationUs, ...descriptor } = source;
      if (
        !integer(durationUs) ||
        durationUs < 1 ||
        !identity.generation ||
        !identity.policy ||
        report.policy !== identity.policy
      )
        invalid("Scene evidence identity does not match its source");
      const row = this.get(identity);
      if (row?.complete || report.range.startUs !== (row?.throughUs ?? 0))
        invalid("Scene chunks require contiguous unpublished coverage");
      if (
        row &&
        (row.sourceWidth !== report.sourceWidth ||
          row.sourceHeight !== report.sourceHeight ||
          !isDeepStrictEqual(metadata(row).source, source))
      )
        invalid("Scene source context or dimensions changed");
      const { chunk, last } = normalizeSceneChunk(
        report,
        durationUs,
        row?.lastComparison ? JSON.parse(row.lastComparison) : undefined,
      );
      const content = JSON.stringify(chunk);
      if (!row)
        this.store.catalog
          .prepare(
            `INSERT INTO scene_evidence_generations VALUES (?,?,?,?,?,?,?,?,?,0,0,0,0,NULL,0)`,
          )
          .run(
            ...key(identity),
            JSON.stringify(descriptor),
            durationUs,
            report.sourceWidth,
            report.sourceHeight,
          );
      this.store.catalog
        .prepare("INSERT INTO scene_evidence_chunks VALUES (?,?,?,?,?,?,?)")
        .run(...key(identity), report.range.startUs, content);
      this.store.catalog
        .prepare(
          `UPDATE scene_evidence_generations SET throughUs=?,chunkCount=chunkCount+1,comparisonCount=comparisonCount+?,boundaryCount=boundaryCount+?,lastComparison=? WHERE ${where}`,
        )
        .run(
          report.range.endUs,
          chunk.comparisons.length,
          sceneBoundaries(chunk).length,
          last ? JSON.stringify(last) : null,
          ...key(identity),
        );
    });
  }
  finish(identity: SceneEvidenceIdentity): SceneEvidenceMetadata {
    return this.store.transaction(() => {
      const row = this.get(identity);
      if (!row || row.complete === -1 || row.throughUs !== row.durationUs)
        invalid("Scene coverage is incomplete");
      this.validateOwner(identity, metadata(row).source);
      this.store.catalog
        .prepare(`UPDATE scene_evidence_generations SET complete=1 WHERE ${where}`)
        .run(...key(identity));
      return metadata(row);
    });
  }
  protected readMetadata(identity: SceneEvidenceIdentity): SceneEvidenceMetadata {
    const row = this.get(identity);
    if (row?.complete !== 1) invalid("Scene evidence is not complete");
    return metadata(row);
  }
  protected readChunks(
    identity: SceneEvidenceIdentity,
    afterStartUs: number,
    limit: number,
  ): SceneChunkReport[] {
    const rows = this.store.catalog
      .prepare(
        `SELECT content FROM scene_evidence_chunks WHERE ${where} AND startUs>? ORDER BY startUs LIMIT ?`,
      )
      .all(...key(identity), afterStartUs, limit) as { content: string }[];
    return rows.map((row) => JSON.parse(row.content));
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
    owner: SceneOwner,
    keep: (generation: string) => boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    let cursor = 0;
    while (true) {
      signal?.throwIfAborted();
      const rows = this.store.catalog
        .prepare(
          "SELECT rowid AS cursor,sourceId,generation,policy FROM scene_evidence_generations WHERE ownerKind=? AND ownerId=? AND rowid>? ORDER BY rowid LIMIT 100",
        )
        .all(...ownerIdentity(owner), cursor) as (Omit<SceneEvidenceIdentity, "owner"> & {
        cursor: number;
      })[];
      for (const row of rows) {
        signal?.throwIfAborted();
        if (!keep(row.generation)) await this.remove({ ...row, owner });
        cursor = row.cursor;
      }
      if (rows.length < 100) return;
      await setImmediate();
    }
  }
}

export type SceneEvidenceRead = Pick<SceneEvidenceStore, "page">;
