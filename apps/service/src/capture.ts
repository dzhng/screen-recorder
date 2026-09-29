import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  isSettled,
  type LifecycleEvent,
  type Recording,
  type RevisionStore,
} from "@screenrec/core/library";
import { CatalogError } from "@screenrec/core/catalog";
import {
  NATIVE_SEQUENCE_LIMIT,
  captureDeviceSchema,
  captureReportSchema,
  captureSourcesSchema,
  nativeStartSchema,
  type CaptureReport,
  type CaptureSelection,
  type OperationResult,
} from "@screenrec/protocol";
import type { ControlChannel } from "./control.js";
import type { MediaWorker } from "./worker.js";

/**
 * The only outcomes this service states on its own behalf: a take it discarded, and a take whose
 * capture it proved ended. Every other transition arrives from the native session that made it.
 */
type AuthoredOutcome =
  | { state: "canceled" }
  | { state: "interrupted"; reason: string; sourceDurationUs: number | null };

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
  private stopping = false;
  private readonly lifetime = new AbortController();

  constructor(
    private readonly store: RevisionStore,
    private readonly home: string,
    /** The native capture session, reached over the app's private control channel. */
    private readonly native: ControlChannel["call"],
    private readonly worker: MediaWorker,
    private readonly log: (message: string) => void = () => {},
    private readonly changed: (recording: Recording) => void = () => {},
  ) {}

  /**
   * One control order for everything that touches the capture device. Native refuses a second
   * concurrent take by itself; this queue is what makes which request meets that refusal
   * deterministic instead of a race between two half-finished starts.
   */
  private serialize<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => {
      if (this.stopping) throw new CatalogError("SERVICE_STOPPED", "Capture service is closing");
      return run();
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async close(): Promise<void> {
    this.stopping = true;
    this.lifetime.abort();
    await this.queue;
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
      // A take awaiting deletion is no longer discoverable, though native may still be ending it.
      recording:
        device.recordingId === null || this.store.isDeleting(device.recordingId)
          ? null
          : this.store.get(device.recordingId),
    };
  }

  /**
   * Allocates identity and directory first, against a durable receipt for the request that asked
   * for them: a repeated request ID answers with the same take and never starts capture twice,
   * and the same ID asking for a different take is refused rather than quietly reinterpreted.
   */
  start(selection: CaptureSelection & { requestId: string }): Promise<Recording> {
    return this.serialize(async () => {
      const { recording, replay } = this.store.allocate({
        requestId: selection.requestId,
        arguments: allocationArguments("capture.start", selection),
      });
      return replay ? this.resolve(recording) : this.begin(recording, selection);
    });
  }

  /** A new identity every time, and the same new identity for a replayed request. */
  restart(
    selection: CaptureSelection & { recordingId: string; requestId: string },
  ): Promise<Recording> {
    return this.serialize(async () => {
      this.store.get(selection.recordingId);
      const { recording, replay } = this.store.allocate({
        requestId: selection.requestId,
        arguments: allocationArguments("capture.restart", selection),
      });
      if (replay) return this.resolve(recording);
      try {
        await this.discard(selection.recordingId);
      } catch (error) {
        // The take this restart named could not be discarded, so its replacement never reached
        // the device: it is settled with that refusal instead of left as an unresolvable receipt.
        throw this.refused(recording, error);
      }
      return this.begin(recording, selection);
    });
  }

  /**
   * Resolves a replay or stop of an unproved start onto the take it already named. That take
   * is ended and settled here rather than started a second time: native's refusal of
   * that second start would be about the take already running, and says nothing about whether
   * the first one captured media.
   */
  private async resolve(recording: Recording): Promise<Recording> {
    if (recording.state !== "preparing") return recording;
    const settled = await this.abandon(recording);
    if (!isSettled(settled.state))
      throw new CatalogError(
        "UNRESOLVED_START",
        "This take's start is still unproved; retry the same request",
        { recordingId: settled.recordingId, state: settled.state },
        true,
      );
    return settled;
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
      if (recording.state === "preparing") return this.resolve(recording);
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

  /** Joins the capture order; success proves this take can no longer write, but removes nothing. */
  quiesce(recordingId: string): Promise<void> {
    return this.serialize(async () => {
      const recording = this.store.deleting(recordingId);
      if (!recording)
        throw new CatalogError("INVALID_STATE", "Recording deletion has not been requested");
      if (isSettled(recording.state)) return;
      await this.endNativeCapture(recording);
      // A cancel response carries its pre-discard finalizing event. Check the device after that
      // ordered call, including when native refused because it no longer owns this take.
      const device = captureDeviceSchema.parse(await this.ask("capture.status", {}));
      if (
        device.state !== "idle" &&
        !(
          device.recordingId !== null &&
          device.recordingId !== recordingId &&
          (device.state === "recording" || device.state === "paused")
        )
      )
        throw new CatalogError(
          "CAPTURE_NOT_QUIET",
          "Native capture has not proved this take stopped",
          { recordingId },
          true,
        );
      this.observed(this.store.settleDeletingCapture(recordingId));
    });
  }

  /** Applies one transition native reported on its own, without this service asking for it. */
  report(report: CaptureReport): Recording {
    return this.observed(this.store.ingestLifecycle(report.recordingId, lifecycleEvent(report)));
  }

  /**
   * Settles every take the catalog still describes as live against its own durable media. A take
   * is only ever settled from a validated recovery, so a service that cannot reach its native
   * worker leaves the take alone for the next startup instead of publishing a state it has not
   * proved. It takes the capture order ahead of every mutation, so a take being recovered cannot
   * be restarted on the device underneath its own recovery.
   */
  reconcileStranded(): Promise<void> {
    return this.serialize(async () => {
      for (const recording of this.store.unsettled()) {
        if (this.store.isDeleting(recording.recordingId)) continue;
        try {
          const settled = await this.reconcile(recording);
          this.log(
            `reconciled ${settled.recordingId} state=${settled.state} reason=${settled.interruptionReason} durationUs=${settled.sourceDurationUs}`,
          );
        } catch (error) {
          this.log(`reconcile failed for ${recording.recordingId}: ${(error as Error).message}`);
        }
      }
    });
  }

  private async begin(recording: Recording, selection: CaptureSelection): Promise<Recording> {
    try {
      await mkdir(sourceDirectory(this.home, recording.recordingId), {
        recursive: true,
        mode: 0o700,
      });
    } catch (error) {
      throw this.refused(recording, error);
    }
    this.store.get(recording.recordingId);
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
    if (!unanswered(answer.error.code)) throw this.refused(recording, fromNative(answer));
    const failed = await this.abandon(recording);
    throw new CatalogError(
      answer.error.code,
      answer.error.message,
      { recordingId: failed.recordingId, state: failed.state },
      answer.error.retryable,
    );
  }

  /**
   * Settles a take that never reached the device, and states why. A start native refused, or one
   * whose preparation refused before native was asked, keeps its identity and that reason rather
   * than disappearing or waiting forever in preparing where nothing could ever resolve it.
   */
  private refused(recording: Recording, error: unknown): CatalogError {
    const refusal = error instanceof CatalogError ? error : null;
    // An owner's own code when there is one; anything else is a failure this service cannot name.
    const code = refusal?.code ?? "INTERNAL_ERROR";
    const failed = this.author(recording, {
      state: "interrupted",
      reason: code,
      sourceDurationUs: null,
    });
    return new CatalogError(
      code,
      (error as Error).message,
      { recordingId: failed.recordingId, state: failed.state },
      refusal?.retryable ?? false,
    );
  }

  /**
   * Ends a take whose start was never answered. A deadline or a closed channel says nothing about
   * the device, so the take is ended on it and settled from the media that ending left behind.
   * A take whose end cannot be proved stays unsettled, still reachable by a later stop, by the
   * session's own reports and by the next startup's recovery.
   */
  private async abandon(recording: Recording): Promise<Recording> {
    const stopped = await this.native("capture.stop", { recordingId: recording.recordingId });
    if (stopped.ok) {
      const report = this.readReport(recording, stopped.data);
      // A finalizing acknowledgment still owns live media; only its later terminal report
      // or a proved absent device can authorize recovery.
      if (!isSettled(report.state)) return this.report(report);
    }
    // Either native ended this take now, or it is not holding it; both leave the media in
    // charge of the outcome.
    if (stopped.ok || stopped.error.code === "INVALID_STATE") {
      try {
        return await this.reconcile(recording);
      } catch (error) {
        this.log(`recovery failed for ${recording.recordingId}: ${(error as Error).message}`);
      }
    }
    const current = this.store.get(recording.recordingId);
    if (!isSettled(current.state))
      this.log(`unsettled start for ${recording.recordingId}: capture may still be running`);
    return current;
  }

  /**
   * Pause and resume are transitions of a live capture, so a take that has already ended refuses
   * them rather than answering with its stored outcome. Stopping a finished take stays idempotent;
   * pausing a paused take and resuming a recording one stay idempotent through native's own
   * validation, which is the only thing that knows what the device is doing.
   */
  private async transition(
    recordingId: string,
    operation: "capture.pause" | "capture.resume",
  ): Promise<Recording> {
    const recording = this.store.get(recordingId);
    if (isSettled(recording.state))
      throw new CatalogError(
        "INVALID_STATE",
        `A ${recording.state} take cannot ${operation === "capture.pause" ? "pause" : "resume"}`,
        { state: recording.state },
      );
    const answer = await this.native(operation, { recordingId });
    if (!answer.ok) throw fromNative(answer);
    return this.apply(recording, answer.data);
  }

  private async discard(recordingId: string): Promise<Recording> {
    const recording = this.store.get(recordingId);
    if (isSettled(recording.state) && recording.state !== "canceled")
      throw new CatalogError(
        "INVALID_STATE",
        "A finished take is removed through the library, not canceled",
        { state: recording.state },
      );
    let current = recording;
    if (current.state !== "canceled") {
      const report = await this.endNativeCapture(current);
      if (report) current = this.report(report);
      // A cancel that joined finalization can receive a finished take. The catalog's terminal
      // rule refuses that cancellation, preserving media for an explicit library deletion.
      current = this.author(current, { state: "canceled" });
    }
    // Only this take's own allocated directory is removed, and only once it is discarded, so a
    // late native write lands in a directory nothing discovers.
    await rm(recordingDirectory(this.home, recordingId), { recursive: true, force: true });
    return current;
  }

  private async endNativeCapture(recording: Recording): Promise<CaptureReport | null> {
    const answer = await this.native("capture.cancel", { recordingId: recording.recordingId });
    if (answer.ok) return this.readReport(recording, answer.data);
    if (answer.error.code === "INVALID_STATE") return null;
    throw fromNative(answer);
  }

  private async reconcile(recording: Recording): Promise<Recording> {
    const recovered = await this.worker(
      "media.recover",
      {
        directory: sourceDirectory(this.home, recording.recordingId),
      },
      { signal: this.lifetime.signal },
    );
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
    return this.report(this.readReport(recording, data));
  }

  private readReport(recording: Recording, data: unknown): CaptureReport {
    const report = captureReportSchema.parse(data);
    if (report.recordingId !== recording.recordingId || report.sourceId !== recording.sourceId)
      throw new CatalogError("INVALID_STATE", "Native reported another take", {
        recordingId: recording.recordingId,
        reportedRecordingId: report.recordingId,
      });
    return report;
  }

  /**
   * Numbers an event this service authors itself. Native journal sequences stay below
   * `NATIVE_SEQUENCE_LIMIT`, so a service-authored outcome is always the later word and can never
   * be mistaken for, or silently overwritten by, a number the journal produced.
   */
  private author(recording: Recording, outcome: AuthoredOutcome): Recording {
    return this.observed(
      this.store.ingestLifecycle(recording.recordingId, {
        ...outcome,
        sourceId: recording.sourceId,
        sequence: Math.max(recording.lifecycleSequence + 1, NATIVE_SEQUENCE_LIMIT + 1),
      }),
    );
  }

  private observed(recording: Recording): Recording {
    // Background admission must not turn a successful native transition into a failed capture.
    try {
      this.changed(recording);
    } catch (error) {
      this.log(
        `processing admission failed for ${recording.recordingId}: ${(error as Error).message}`,
      );
    }
    return recording;
  }

  private async ask(operation: string, params: Record<string, unknown>): Promise<unknown> {
    const answer = await this.native(operation, params);
    if (!answer.ok) throw fromNative(answer);
    return answer.data;
  }
}

/**
 * What a request asked for, in one canonical order, so that a replayed request ID is recognized as
 * the same take and the same ID asking for a different one is refused. Field order is stated here
 * rather than taken from a parsed object's key order.
 */
function allocationArguments(
  operation: string,
  selection: CaptureSelection & { recordingId?: string },
): string {
  const source = selection.source;
  return JSON.stringify([
    operation,
    selection.recordingId ?? null,
    source.kind,
    source.kind === "window" ? source.windowId : source.displayId,
    source.kind === "region" ? [source.x, source.y, source.width, source.height] : null,
    selection.microphone,
    selection.systemAudio,
    selection.microphoneDeviceId ?? null,
  ]);
}

/**
 * The codes the control channel states on its own when it cannot say whether native ran the call.
 * Every other code is native's own answer, and so is proof of what it did.
 */
function unanswered(code: string): boolean {
  return code === "TIMEOUT" || code === "SERVICE_STOPPED" || code === "INVALID_RESPONSE";
}

function fromNative(result: OperationResult & { ok: false }): CatalogError {
  return new CatalogError(
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
      throw new CatalogError("INVALID_STATE", "A finalized take must report its source duration");
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
    throw new CatalogError("MEDIA_WORKER_FAILED", "Recovery returned no usable source duration");
  return {
    durationUs: value.durationUs as number,
    captured: Boolean(value.journal?.header),
  };
}
