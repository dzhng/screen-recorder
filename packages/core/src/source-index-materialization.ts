import { setTimeout } from "node:timers/promises";
import { CatalogError } from "./catalog.js";
import type { DerivedCache } from "./cache.js";
import type { MediaFrameInspection, SourceFrameArtifact } from "./frame-inspection.js";
import type { SceneEvidenceStore } from "./scene-evidence.js";
import type { SourceSceneChunk } from "./source-scene-chunks.js";
import { scenePolicy } from "./scenes.js";
import { compareSceneSampleClocks } from "./source-scenes.js";
import { copyRetainedFile } from "./files.js";
import type { ScreenshotIndexStore } from "./screenshot-index.js";
import type {
  SourceIndexIdentity,
  SourceIndexRecords,
  SourceIndexCoverage,
} from "./source-index.js";
import {
  sourceIndexChunks,
  selectSourceIndex,
  type SourceIndexRequest,
} from "./source-index-selection.js";
import type { TimeRange } from "./timeline.js";
type Point = SourceSceneChunk["coverage"][number];

/** One forward evidence walk serves every adjacent coverage range; no candidate scans from zero. */
class Stillness {
  private before: Point | undefined;
  private next: IteratorResult<Point> | undefined;
  constructor(private readonly points: AsyncGenerator<Point>) {}
  async equality(frame: SourceFrameArtifact | undefined, range: TimeRange) {
    this.next ??= await this.points.next();
    while (!this.next.done && this.next.value.requestedSourceUs <= range.startUs) {
      this.before = this.next.value;
      this.next = await this.points.next();
    }
    let unchanged =
      !!frame &&
      this.before?.status === "available" &&
      compareSceneSampleClocks(frame.sample, this.before.sample) === 0 &&
      range.startUs - this.before.requestedSourceUs <= scenePolicy.stepUs;
    const run = this.before?.status === "available" ? this.before.stillnessRunStartUs : undefined;
    while (!this.next.done && this.next.value.requestedSourceUs <= range.endUs) {
      const point = this.next.value;
      unchanged &&=
        point.status === "available" &&
        point.continuousFromPrevious &&
        point.stillnessRunStartUs === run;
      this.before = point;
      this.next = await this.points.next();
    }
    return unchanged &&
      this.before &&
      range.endUs - this.before.requestedSourceUs <= scenePolicy.stepUs
      ? ("sampled" as const)
      : ("unproven" as const);
  }
  close() {
    return this.points.return(undefined);
  }
}
async function* points(
  records: SceneEvidenceStore,
  identity: SourceIndexIdentity,
  signal: AbortSignal,
) {
  let through = -1;
  for await (const chunk of sourceIndexChunks(records, identity.scenes, signal))
    for (const point of chunk.coverage) {
      if (point.requestedSourceUs <= through) continue;
      signal.throwIfAborted();
      through = point.requestedSourceUs;
      yield point;
    }
}
type Resolved = { request: SourceIndexRequest } & (
  | { ordinal: number; frame: SourceFrameArtifact }
  | {
      ordinal: null;
      observation: Extract<SourceIndexCoverage, { basis: "observation" }>["observation"];
    }
);

/** A heavy index attempt waits only on existing frame-lane jobs, then retains their leased bytes. */
export async function materializeSourceIndex(
  identity: SourceIndexIdentity,
  source: { durationUs: number; support: readonly TimeRange[] },
  owners: {
    index: ScreenshotIndexStore<SourceIndexRecords>;
    records: SceneEvidenceStore;
    frames: MediaFrameInspection;
    cache: DerivedCache;
  },
  retryFrames: boolean,
  signal: AbortSignal,
) {
  const { index, records, frames, cache } = owners;
  const stillness = new Stillness(points(records, identity, signal));
  let ordinal = 0,
    through = 0,
    previous: Resolved | undefined;
  async function resolve(request: SourceIndexRequest): Promise<Resolved> {
    signal.throwIfAborted();
    if (request.kind === "unavailable")
      return { request, ordinal: null, observation: { kind: "scene", point: request.observation } };
    const input = {
      assetId: identity.assetId,
      streamId: identity.streamId,
      ...(identity.acquisitionId === undefined ? {} : { acquisitionId: identity.acquisitionId }),
      atUs: request.requestedSourceUs,
      maxLongEdge: identity.maxLongEdge,
    };
    let status = frames.request(input);
    if (
      retryFrames &&
      status.retryable &&
      !["queued", "processing", "ready"].includes(status.state)
    )
      status = frames.retry(input);
    while (status.state === "queued" || status.state === "processing") {
      await setTimeout(10, undefined, { signal });
      status = frames.request(input);
    }
    signal.throwIfAborted();
    const dependency = { artifact: "frame", jobId: status.jobId, ...input };
    if (status.state === "unavailable") {
      try {
        return {
          request,
          ordinal: null,
          observation: { kind: "frame", frame: frames.sourceUnavailable(input) },
        };
      } catch (error) {
        if (error instanceof CatalogError && error.code === "NOT_READY")
          throw new CatalogError(
            "FRAME_FAILED",
            status.reason ?? "Picture unavailable without physical observation",
            { dependency },
            status.retryable,
          );
        throw error;
      }
    }
    if (!status.published)
      throw new CatalogError(
        "FRAME_FAILED",
        status.reason ?? "Picture preparation did not publish",
        { dependency },
        status.retryable,
      );
    const frame = status.published.frame;
    if (frame.implementationId !== identity.implementationId)
      throw new CatalogError("ARTIFACT_CHANGED", "Pinned picture renderer changed");
    const lease = cache.acquire(frame.cacheId);
    if (!lease)
      throw new CatalogError("NOT_READY", "Picture was evicted before index retention", {}, true);
    const file = index.outputPath(identity, ordinal);
    try {
      await copyRetainedFile(lease, file, signal);
      signal.throwIfAborted();
      const { cacheId: _cache, ...retained } = frame;
      index.appendCandidate(
        identity,
        {
          ordinal,
          requestedSourceUs: request.requestedSourceUs,
          support: request.support,
          reasons: request.reasons,
        },
        { ...retained, file },
      );
    } finally {
      lease.release();
    }
    return { request, ordinal: ordinal++, frame };
  }
  async function cover(value: Resolved | undefined, endUs: number) {
    if (endUs <= through) return;
    const range = { startUs: through, endUs };
    const equality = await stillness.equality(
      value?.ordinal !== null ? value?.frame : undefined,
      range,
    );
    signal.throwIfAborted();
    index.appendCoverage(
      identity,
      value === undefined
        ? { ordinal: null, state: "unavailable", basis: "support", source: range }
        : value.ordinal === null
          ? {
              ordinal: null,
              state: "unavailable",
              basis: "observation",
              equality: "unproven",
              observation: value.observation,
              source: range,
            }
          : { ordinal: value.ordinal, state: "available", equality, source: range },
    );
    through = endUs;
  }
  try {
    index.begin(identity);
    for await (const request of selectSourceIndex(
      source.support,
      sourceIndexChunks(records, identity.scenes, signal),
      signal,
    )) {
      if (previous && previous.request.support !== request.support) {
        await cover(previous, previous.request.support.endUs);
        previous = undefined;
      }
      if (!previous) await cover(undefined, request.support.startUs);
      const current = await resolve(request);
      if (previous) await cover(previous, request.requestedSourceUs);
      previous = current;
    }
    if (previous) await cover(previous, previous.request.support.endUs);
    await cover(undefined, source.durationUs);
    signal.throwIfAborted();
    return await index.finish(identity, signal);
  } catch (error) {
    await index.remove(identity);
    throw error;
  } finally {
    await stillness.close();
  }
}
