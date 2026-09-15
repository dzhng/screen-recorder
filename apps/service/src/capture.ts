import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  isSettled,
  type LifecycleEvent,
  type Recording,
  type RevisionStore,
} from "@screenrec/core/library";
import {
  NATIVE_SEQUENCE_LIMIT,
  captureDeviceSchema,
  captureReportSchema,
  captureSourcesSchema,
  nativeStartSchema,
  type CaptureReport,
  type CaptureSource,
  type OperationResult,
} from "@screenrec/protocol";
import type { MediaWorker } from "./worker.js";

/** The native peer reached over the app's private control channel. */
export type NativeCall = (
  operation: string,
  params: Record<string, unknown>,
) => Promise<OperationResult>;

export type CaptureSelection = {
  source: CaptureSource;
  microphone: boolean;
  systemAudio: boolean;
  microphoneDeviceId?: string | undefined;
};

/**
 * The only outcomes this service states on its own behalf: a take it discarded, and a take whose
 * capture it proved ended. Every other transition arrives from the native session that made it.
 */
type AuthoredOutcome =
  | { state: "canceled" }
  | { state: "interrupted"; reason: string; sourceDurationUs: number | null };

export class CaptureError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function recordingDirectory(home: string, recordingId: string): string {
  return join(home, "recordings", recordingId);
}
export function sourceDirectory(home: string, recordingId: string): string {
  return join(recordingDirectory(home, recordingId), "source");
}

/**
 * Capture control as this service owns it: it allocates a take's identity and directory, asks
 * the app's native capture session to act, and persists what that session reports. Device state,
 * permissions and media belong to native; nothing here re-derives a transition, a duration or a
 * device state machine of its own.
 */
export class CaptureService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: RevisionStore,
    private readonly home: string,
    private readonly native: NativeCall,
    private readonly worker: MediaWorker,
    private readonly log: (message: string) => void = () => {},
  ) {}

  /**
   * One control order for everything that touches the capture device. Native refuses a second
   * concurrent take by itself; this queue is what makes which request meets that refusal
   * deterministic instead of a race between two half-finished starts.
   */
  private serialize<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  // Reading what the device can see, and what it is doing, changes nothing and so does not
  // join the control order below.
  async sources(): Promise<unknown> {
    return captureSourcesSchema.parse(await this.ask("capture.sources", {}));
  }

  async status(): Promise<unknown> {
    const device = captureDeviceSchema.parse(await this.ask("capture.status", {}));
    return {
      device,
      recording: device.recordingId === null ? null : this.store.get(device.recordingId),
    };
  }

  /** Allocates identity and directory first; a repeated request ID answers with the same take. */
  start(selection: CaptureSelection & { requestId: string }): Promise<Recording> {
    return this.serialize(async () => {
      const allocated = this.store.allocate(selection.requestId);
      return allocated.state === "preparing" ? this.begin(allocated, selection) : allocated;
    });
  }

  /** A new identity every time, and the same new identity for a replayed request. */
  restart(
    selection: CaptureSelection & { recordingId: string; requestId: string },
  ): Promise<Recording> {
    return this.serialize(async () => {
      const fresh = this.store.allocate(selection.requestId);
      if (fresh.state !== "preparing") return fresh;
      if (fresh.recordingId === selection.recordingId)
        throw new CaptureError("INVALID_STATE", "A take cannot restart itself");
      await this.discard(selection.recordingId);
      return this.begin(fresh, selection);
    });
  }

  pause(recordingId: string): Promise<Recording> {
    return this.serialize(() => this.transition(recordingId, "capture.pause"));
  }

  resume(recordingId: string): Promise<Recording> {
    return this.serialize(() => this.transition(recordingId, "capture.resume"));
  }

  stop(recordingId: string): Promise<Recording> {
    return this.serialize(async () => {
      const recording = this.store.get(recordingId);
      if (isSettled(recording.state)) return recording;
      const answer = await this.native("capture.stop", { recordingId });
      if (answer.ok) return this.apply(recording, answer.data);
      if (answer.error.code !== "INVALID_STATE") throw fromNative(answer);
      // Native is not holding this take, so its own durable media is the only truth left.
      return this.reconcile(recording);
    });
  }

  cancel(recordingId: string): Promise<Recording> {
    return this.serialize(() => this.discard(recordingId));
  }

  /** Applies one transition native reported on its own, without this service asking for it. */
  report(report: CaptureReport): Recording {
    return this.store.ingestLifecycle(report.recordingId, lifecycleEvent(report));
  }

  /**
   * Settles every take the catalog still describes as live against its own durable media. A take
   * is only ever settled from a validated recovery, so a service that cannot reach its native
   * worker leaves the take alone for the next startup instead of publishing a state it has not
   * proved.
   */
  async reconcileStranded(): Promise<void> {
    for (const recording of this.store.unsettled()) {
      try {
        const settled = await this.reconcile(recording);
        this.log(
          `reconciled ${settled.recordingId} state=${settled.state} reason=${settled.interruptionReason} durationUs=${settled.sourceDurationUs}`,
        );
      } catch (error) {
        this.log(`reconcile failed for ${recording.recordingId}: ${(error as Error).message}`);
      }
    }
  }

  private async begin(recording: Recording, selection: CaptureSelection): Promise<Recording> {
    await mkdir(sourceDirectory(this.home, recording.recordingId), {
      recursive: true,
      mode: 0o700,
    });
    const answer = await this.native(
      "capture.start",
      nativeStartSchema.parse({
        ...selection,
        recordingId: recording.recordingId,
        sourceId: recording.sourceId,
        outputDirectory: sourceDirectory(this.home, recording.recordingId),
      }),
    );
    if (answer.ok) return this.apply(recording, answer.data);
    // A take that never captured keeps its identity and a terminal reason rather than
    // disappearing or waiting forever in preparing.
    const failed = this.author(recording, {
      state: "interrupted",
      reason: answer.error.code,
      sourceDurationUs: null,
    });
    throw new CaptureError(
      answer.error.code,
      answer.error.message,
      { recordingId: failed.recordingId, state: failed.state },
      answer.error.retryable,
    );
  }

  private async transition(recordingId: string, operation: string): Promise<Recording> {
    const recording = this.store.get(recordingId);
    if (isSettled(recording.state)) return recording;
    const answer = await this.native(operation, { recordingId });
    if (!answer.ok) throw fromNative(answer);
    return this.apply(recording, answer.data);
  }

  private async discard(recordingId: string): Promise<Recording> {
    const recording = this.store.get(recordingId);
    if (isSettled(recording.state) && recording.state !== "canceled")
      throw new CaptureError(
        "INVALID_STATE",
        "A finished take is removed through the library, not canceled",
        { state: recording.state },
      );
    let current = recording;
    if (current.state !== "canceled") {
      const answer = await this.native("capture.cancel", { recordingId });
      if (answer.ok) current = this.apply(current, answer.data);
      else if (answer.error.code !== "INVALID_STATE") throw fromNative(answer);
      current = this.author(current, { state: "canceled" });
    }
    // Only this take's own allocated directory is removed, and only once it is discarded, so a
    // late native write lands in a directory nothing discovers.
    await rm(recordingDirectory(this.home, recordingId), { recursive: true, force: true });
    return current;
  }

  private async reconcile(recording: Recording): Promise<Recording> {
    const recovered = await this.worker("media.recover", {
      directory: sourceDirectory(this.home, recording.recordingId),
    });
    if (!recovered.ok) throw fromNative(recovered);
    const { durationUs, captured } = readRecovery(recovered.data);
    return this.author(recording, {
      state: "interrupted",
      reason:
        durationUs > 0
          ? "CAPTURE_INTERRUPTED"
          : captured
            ? "NO_RECOVERABLE_VIDEO"
            : "NO_SOURCE_MEDIA",
      sourceDurationUs: durationUs > 0 ? durationUs : null,
    });
  }

  private apply(recording: Recording, data: unknown): Recording {
    const report = captureReportSchema.parse(data);
    if (report.recordingId !== recording.recordingId || report.sourceId !== recording.sourceId)
      throw new CaptureError("INVALID_STATE", "Native reported another take", {
        recordingId: recording.recordingId,
        reportedRecordingId: report.recordingId,
      });
    return this.report(report);
  }

  /**
   * Numbers an event this service authors itself. Native journal sequences stay below
   * `NATIVE_SEQUENCE_LIMIT`, so a service-authored outcome is always the later word and can never
   * be mistaken for, or silently overwritten by, a number the journal produced.
   */
  private author(recording: Recording, outcome: AuthoredOutcome): Recording {
    return this.store.ingestLifecycle(recording.recordingId, {
      ...outcome,
      sourceId: recording.sourceId,
      sequence: Math.max(recording.lifecycleSequence + 1, NATIVE_SEQUENCE_LIMIT + 1),
    });
  }

  private async ask(operation: string, params: Record<string, unknown>): Promise<unknown> {
    const answer = await this.native(operation, params);
    if (!answer.ok) throw fromNative(answer);
    return answer.data;
  }
}

function fromNative(result: OperationResult & { ok: false }): CaptureError {
  return new CaptureError(
    result.error.code,
    result.error.message,
    result.error.details,
    result.error.retryable,
  );
}

function lifecycleEvent(report: CaptureReport): LifecycleEvent {
  const identity = { sourceId: report.sourceId, sequence: report.sequence };
  if (report.state === "complete") {
    if (typeof report.sourceDurationUs !== "number")
      throw new CaptureError("INVALID_STATE", "A finalized take must report its source duration");
    return { ...identity, state: "complete", sourceDurationUs: report.sourceDurationUs };
  }
  if (report.state === "interrupted")
    return {
      ...identity,
      state: "interrupted",
      reason: report.reason ?? "CAPTURE_INTERRUPTED",
      sourceDurationUs: report.sourceDurationUs ?? null,
    };
  return { ...identity, state: report.state };
}

/** Reads only what settling a take needs: the validated video extent and whether a take ran. */
function readRecovery(data: unknown): { durationUs: number; captured: boolean } {
  const value = data as { durationUs?: unknown; journal?: { header?: unknown } | null };
  if (!value || !Number.isSafeInteger(value.durationUs) || (value.durationUs as number) < 0)
    throw new CaptureError("MEDIA_WORKER_FAILED", "Recovery returned no usable source duration");
  return {
    durationUs: value.durationUs as number,
    captured: Boolean(value.journal?.header),
  };
}
