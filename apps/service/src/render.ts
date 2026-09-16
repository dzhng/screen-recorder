import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import type { AudioTrackPlan, NativeAudio } from "@screenrec/core/audio";
import type { RenderSpan } from "@screenrec/core/timeline";
import { MAX_MEDIA_TIMEOUT_MS, type MediaWorker } from "./worker.js";

export type RenderedMedia = Readonly<{
  file: string;
  mediaType: "video/mp4";
  codec: "h264";
  durationUs: number;
  width: number;
  height: number;
  frameCount: number;
  bytes: number;
  audio?: Readonly<{
    codec?: "aac";
    frames: number;
    sampleRate: number;
    channels: number;
    tracks: NativeAudio["tracks"];
  }>;
}>;

/** The sequential reader may decode discarded prefixes, so budget the last source
 * position, not merely the shorter edited result. Allow realtime work plus startup;
 * add retained playback time for the sequential AAC assembly phase. Keep unrelated
 * native calls on their existing short deadline. */
export function renderDeadlineMs(plan: readonly RenderSpan[], withAudio = false): number {
  return Math.min(
    MAX_MEDIA_TIMEOUT_MS,
    30_000 +
      Math.ceil((plan.at(-1)?.source.endUs ?? 0) / 1000) +
      (withAudio ? Math.ceil((plan.at(-1)?.playback.endUs ?? 0) / 1000) : 0),
  );
}

/** One service-owned attempt lifetime. The consumer must finish retaining/using
 * successful output before returning. A late native answer never reaches the
 * consumer. The consumer's commit owner must fence/reconcile its own durable side
 * effects; cancellation after consumption cannot undo them. The existing worker
 * resolves only after actual child close. */
export async function withRenderedMedia<T>(
  worker: MediaWorker,
  request: {
    source: string;
    plan: readonly RenderSpan[];
    tracks?: readonly AudioTrackPlan[];
    attemptParent: string;
  },
  signal: AbortSignal,
  consume: (video: RenderedMedia) => Promise<T>,
): Promise<T> {
  const checkCanceled = () => {
    if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
  };
  checkCanceled();
  const attempt = await mkdtemp(join(request.attemptParent, "render-"));
  try {
    checkCanceled();
    const file = join(attempt, "video.mp4");
    const response = await worker(
      request.tracks === undefined ? "media.renderVideo" : "media.renderMovie",
      {
        source: request.source,
        plan: request.plan,
        output: file,
        ...(request.tracks === undefined ? {} : { tracks: request.tracks }),
      },
      { signal, timeoutMs: renderDeadlineMs(request.plan, (request.tracks?.length ?? 0) > 0) },
    );
    checkCanceled();
    if (!response.ok)
      throw new CatalogError(
        response.error.code,
        response.error.message,
        response.error.details,
        response.error.retryable,
      );
    const receipt = response.data as RenderedMedia;
    if (
      receipt.file !== file ||
      receipt.durationUs !== request.plan.at(-1)?.playback.endUs ||
      receipt.mediaType !== "video/mp4" ||
      receipt.codec !== "h264"
    ) {
      throw new CatalogError(
        "NATIVE_DECODE_FAILED",
        "Native media receipt does not match the pinned attempt",
      );
    }
    const result = await consume(receipt);
    checkCanceled();
    return result;
  } finally {
    await rm(attempt, { recursive: true, force: true });
  }
}
