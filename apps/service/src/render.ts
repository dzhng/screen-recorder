import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, open, realpath } from "node:fs/promises";
import { basename, join } from "node:path";
import type { DirectoryIdentity } from "@screenrec/core/cache";
import { CatalogError } from "@screenrec/core/catalog";
import type { AudioTrackPlan } from "@screenrec/core/audio";
import type { PreviewRenderer, RenderedMovie } from "@screenrec/core/preview";
import {
  PresentationEvidence,
  type PresentationReceipt,
} from "@screenrec/core/presentation-evidence";
import { writePointerSchedule } from "@screenrec/core/pointer-schedule";
import type { RenderSpan } from "@screenrec/core/timeline";
import { O_EXLOCK, O_SHLOCK, O_NOFOLLOW_ANY } from "@screenrec/core/files";
import { MAX_MEDIA_TIMEOUT_MS, nativeConfirmed, nativeResult, type MediaWorker } from "./worker.js";

/** The sequential reader may decode discarded prefixes, so budget the last source
 * position, not merely the shorter edited result. Allow realtime work plus startup;
 * add retained playback time for the sequential AAC assembly phase. Other native
 * calls keep the worker's ordinary deadline. */
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
  descriptors: readonly number[];
  identity: DirectoryIdentity;
  worker: MediaWorker;
  clear: () => Promise<void>;
};

async function withLockedRenderWorkspace<T>(
  worker: MediaWorker,
  directory: string,
  signal: AbortSignal,
  authority: {
    lock: "shared" | "exclusive";
    inherited: readonly number[];
    parent?: { expectedDirectory: DirectoryIdentity; name: string };
  },
  action: (workspace: LockedWorkspace) => Promise<T>,
): Promise<T> {
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
    constants.O_RDONLY |
    constants.O_DIRECTORY |
    constants.O_NONBLOCK |
    (authority.lock === "shared" ? O_SHLOCK : O_EXLOCK) |
    O_NOFOLLOW_ANY;
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
  const identity = { dev: before.dev.toString(), ino: before.ino.toString() };
  const descriptors = [workspace.fd, ...authority.inherited];
  const boundWorker: MediaWorker = (operation, params, options) =>
    worker(operation, params, {
      ...options,
      signal,
      descriptors: [...descriptors, ...(options?.descriptors ?? [])],
    });
  const clear = async () => {
    nativeConfirmed(
      await worker(
        "storage.clearRenderWorkspace",
        {
          expectedDirectory: identity,
          ...(authority.parent ? { parent: authority.parent } : {}),
        },
        { descriptors },
      ),
      "removed",
      "Render workspace cleanup did not confirm completion",
    );
  };
  try {
    const opened = await workspace.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino)
      throw new CatalogError("INVALID_STORAGE", "Render workspace changed while opening");
    const result = await action({
      directory: parent,
      descriptors,
      identity,
      worker: boundWorker,
      clear,
    });
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
  await withLockedRenderWorkspace(
    worker,
    parent,
    signal,
    { lock: "exclusive", inherited: [] },
    async ({ clear }) => clear(),
  );
}

/**
 * The playable preview of a pinned revision: the observed pointer is scheduled from the source's
 * own presentation evidence, then the movie is rendered and copied to the preview's output, all
 * inside one locked attempt in the service's private render workspace.
 */
/** What a preview's pointer schedule is read from: a library's evidence, or a package's own. */
export type PreviewEvidence = Parameters<typeof writePointerSchedule>[0]["evidence"];

export function previewRenderer(
  worker: MediaWorker,
  workspace: string,
  evidence: PreviewEvidence,
): PreviewRenderer {
  return async (request, signal) => {
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    return withRenderedMedia(
      worker,
      {
        source: request.source,
        plan: request.plan,
        tracks: request.tracks,
        maxLongEdge: request.maxLongEdge,
        attemptParent: workspace,
        preparePointer: async (attempt, execute, signal) => {
          const response = await execute(
            "media.presentationEvidence",
            {
              source: request.source,
              plan: request.plan,
              output: join(attempt, "presentation.jsonl"),
              maxBytes: 1024 ** 3,
            },
            { signal, timeoutMs: renderDeadlineMs(request.plan) },
          );
          const presentation = await PresentationEvidence.open(
            nativeResult(response) as PresentationReceipt,
            request.revision,
            signal,
          );
          try {
            return await writePointerSchedule(
              {
                presentation,
                evidence,
                identity: request.sourceEvidence,
                output: join(attempt, "pointer.jsonl"),
                maxBytes: 128 * 1024 ** 2,
                maxEvents: 1_000_000,
              },
              signal,
            );
          } finally {
            await presentation.close();
          }
        },
      },
      signal,
      async (movie) => {
        await copyFile(movie.file, request.output, constants.COPYFILE_EXCL);
        return { ...movie, file: request.output };
      },
    );
  };
}

/** One service-owned attempt lifetime. The consumer must finish retaining/using
 * successful output before returning. A late native answer never reaches the
 * consumer. The consumer's commit owner must fence/reconcile its own durable side
 * effects; cancellation after consumption cannot undo them. The worker resolves
 * only after actual child close. */
export async function withRenderedMedia<T>(
  worker: MediaWorker,
  request: {
    source: string;
    plan: readonly RenderSpan[];
    tracks: readonly AudioTrackPlan[];
    /** Bounds the rendition's long edge; absent or null renders at the capture's resolution. */
    maxLongEdge?: number | null;
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
  return withRenderAttempt(
    worker,
    request.attemptParent,
    signal,
    async (attempt, boundWorker) => {
      const pointerSchedule = await request.preparePointer?.(attempt, boundWorker, signal);
      if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
      const file = join(attempt, "video.mp4");
      const response = await boundWorker(
        "media.renderMovie",
        {
          source: request.source,
          plan: request.plan,
          output: file,
          tracks: request.tracks,
          ...(pointerSchedule ? { pointerSchedule } : {}),
          ...(request.maxLongEdge == null ? {} : { maxLongEdge: request.maxLongEdge }),
        },
        { signal, timeoutMs: renderDeadlineMs(request.plan, request.tracks.length > 0) },
      );
      if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
      const receipt = nativeResult(response) as RenderedMovie;
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
      return receipt;
    },
    consume,
  );
}

/** Native encoders may stage beside their output. Keep that entire lifetime under
 * the render workspace lock; only completed bytes enter the disposable cache. */
export async function withRenderedFile(
  worker: MediaWorker,
  request: { attemptParent: string; output: string; filename: "audio.wav" | "frame.png" },
  signal: AbortSignal,
  produce: (output: string, worker: MediaWorker) => Promise<unknown>,
): Promise<unknown> {
  await mkdir(request.attemptParent, { recursive: true, mode: 0o700 });
  return withRenderAttempt(
    worker,
    request.attemptParent,
    signal,
    async (directory, boundWorker) => {
      const file = join(directory, request.filename);
      const receipt = await produce(file, boundWorker);
      if (!receipt || typeof receipt !== "object" || !("file" in receipt) || receipt.file !== file)
        throw new CatalogError("INVALID_RESPONSE", "Media receipt changed the render attempt path");
      return { ...receipt, file };
    },
    async (artifact) => {
      await copyFile(
        artifact.file,
        request.output,
        constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE,
      );
      return { ...artifact, file: request.output };
    },
  );
}

/** The render action owns media semantics; this owner fences late results and
 * retains the workspace lock until the consumer and native children finish.
 * Independent attempts share the root but own their child cleanup. Startup must
 * clear stale attempts before admitting jobs. Actions must await every native call. */
export async function withRenderAttempt<Artifact, Result>(
  worker: MediaWorker,
  parent: string,
  signal: AbortSignal,
  render: (directory: string, worker: MediaWorker) => Promise<Artifact>,
  consume: (artifact: Artifact) => Promise<Result>,
): Promise<Result> {
  const checkCanceled = () => {
    if (signal.aborted) throw new CatalogError("CANCELED", "Media render was canceled");
  };
  checkCanceled();
  return withLockedRenderWorkspace(
    worker,
    parent,
    signal,
    { lock: "shared", inherited: [] },
    async ({ directory, descriptors, identity }) => {
      checkCanceled();
      const attempt = await mkdtemp(join(directory, "render-"));
      return withLockedRenderWorkspace(
        worker,
        attempt,
        signal,
        {
          lock: "exclusive",
          inherited: descriptors,
          parent: { expectedDirectory: identity, name: basename(attempt) },
        },
        async ({ worker: boundWorker, clear }) => {
          try {
            checkCanceled();
            const artifact = await render(attempt, boundWorker);
            checkCanceled();
            const result = await consume(artifact);
            checkCanceled();
            return result;
          } finally {
            await clear();
          }
        },
      );
    },
  );
}
