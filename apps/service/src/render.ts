import { constants } from "node:fs";
import { lstat, mkdtemp, open, realpath } from "node:fs/promises";
import { join } from "node:path";
import { CatalogError } from "@screenrec/core/library";
import type { AudioTrackPlan } from "@screenrec/core/audio";
import type { RenderedMovie } from "@screenrec/core/preview";
import type { writePointerSchedule } from "@screenrec/core/pointer-schedule";
import type { RenderSpan } from "@screenrec/core/timeline";
import { MAX_MEDIA_TIMEOUT_MS, type MediaWorker } from "./worker.js";

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

type LockedWorkspace = {
  directory: string;
  worker: MediaWorker;
  clear: () => Promise<void>;
};

async function withLockedRenderWorkspace<T>(
  worker: MediaWorker,
  directory: string,
  signal: AbortSignal,
  action: (workspace: LockedWorkspace) => Promise<T>,
): Promise<T> {
  if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
  // This dedicated 0700 directory is exclusively owned by the service. The lock
  // follows the inherited open-file description if the service dies first.
  const before = await lstat(directory, { bigint: true });
  if (
    !before.isDirectory() ||
    (before.mode & 0o777n) !== 0o700n ||
    before.uid !== BigInt(process.getuid!())
  )
    throw new CatalogError(
      "INVALID_STORAGE",
      "Render workspace must be an owned private directory",
    );
  const parent = await realpath(directory);
  const flags =
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NONBLOCK | 0x20 | 0x20000000; // Darwin O_EXLOCK and O_NOFOLLOW_ANY.
  const workspace = await open(parent, flags).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EAGAIN" || error.code === "EWOULDBLOCK")
      throw new CatalogError(
        "RENDER_WORKSPACE_BUSY",
        "Another render still owns this workspace",
        {},
        true,
      );
    throw error;
  });
  const descriptors = [workspace.fd];
  const boundWorker: MediaWorker = (operation, params, options) =>
    worker(operation, params, {
      ...options,
      signal,
      descriptors: [...descriptors, ...(options?.descriptors ?? [])],
    });
  const clear = async () => {
    const response = await worker(
      "storage.clearRenderWorkspace",
      {
        expectedDirectory: { dev: before.dev.toString(), ino: before.ino.toString() },
      },
      { descriptors },
    );
    if (!response.ok)
      throw new CatalogError(
        response.error.code,
        response.error.message,
        response.error.details,
        response.error.retryable,
      );
    if (
      !(
        response.data &&
        typeof response.data === "object" &&
        "removed" in response.data &&
        response.data.removed === true
      )
    )
      throw new CatalogError(
        "INVALID_NATIVE_RESPONSE",
        "Render workspace cleanup did not confirm completion",
      );
  };
  try {
    const opened = await workspace.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino)
      throw new CatalogError("INVALID_STORAGE", "Render workspace changed while opening");
    const result = await action({ directory: parent, worker: boundWorker, clear });
    if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
    return result;
  } finally {
    await workspace.close();
  }
}

/** Startup/deletion admission uses the same authority before jobs may start.
 * A missing workspace needs neither creation nor a native process. */
export async function clearRenderWorkspace(
  worker: MediaWorker,
  parent: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
  try {
    await lstat(parent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await withLockedRenderWorkspace(worker, parent, signal, async ({ clear }) => clear());
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
    /** Dedicated private workspace; keep its ancestry stable during path-based rendering. */
    attemptParent: string;
    /** Finish all preparation calls before returning; each inherits this workspace lock. */
    preparePointer?: (
      directory: string,
      worker: MediaWorker,
      signal: AbortSignal,
    ) => Promise<Awaited<ReturnType<typeof writePointerSchedule>>>;
  },
  signal: AbortSignal,
  consume: (video: RenderedMovie) => Promise<T>,
): Promise<T> {
  const checkCanceled = () => {
    if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
  };
  checkCanceled();
  if (request.preparePointer && request.tracks === undefined)
    throw new CatalogError("INVALID_REQUEST", "Pointer preparation requires a movie request");
  return withLockedRenderWorkspace(
    worker,
    request.attemptParent,
    signal,
    async ({ directory: parent, worker: boundWorker, clear }) => {
      await clear();
      try {
        const attempt = await mkdtemp(join(parent, "render-"));
        checkCanceled();
        const pointerSchedule = await request.preparePointer?.(attempt, boundWorker, signal);
        checkCanceled();
        const file = join(attempt, "video.mp4");
        const response = await boundWorker(
          request.tracks === undefined ? "media.renderVideo" : "media.renderMovie",
          {
            source: request.source,
            plan: request.plan,
            output: file,
            ...(pointerSchedule ? { pointerSchedule } : {}),
            ...(request.tracks === undefined ? {} : { tracks: request.tracks }),
          },
          {
            signal,
            timeoutMs: renderDeadlineMs(request.plan, (request.tracks?.length ?? 0) > 0),
          },
        );
        checkCanceled();
        if (!response.ok)
          throw new CatalogError(
            response.error.code,
            response.error.message,
            response.error.details,
            response.error.retryable,
          );
        const receipt = response.data as RenderedMovie;
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
        await clear();
      }
    },
  );
}
