import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { CatalogError, isSettled, type RevisionStore } from "./library.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import { SourceSceneAnalysis, scenePolicy, type VisualSampler } from "./scenes.js";
import type { SceneEvidenceStore, SceneEvidenceMetadata } from "./scene-evidence.js";

const artifact = "source-scenes";
/** Canonical source analysis is independent of edit revisions and local frame demand. */
export class SceneProcessing {
  constructor(
    private readonly store: RevisionStore,
    private readonly jobs: JobQueue,
    private readonly evidence: SceneEvidenceStore,
    private readonly home: string,
    private readonly sample: VisualSampler,
    private readonly retained?: (recordingId: string, generation: string) => boolean,
  ) {}
  private identity(recordingId: string) {
    return { recordingId, revisionId: "r0", artifact, input: scenePolicy.id };
  }
  status(recordingId: string) {
    const recording = this.store.get(recordingId);
    const identity = { recordingId, sourceId: recording.sourceId, sourceRevisionId: "r0" };
    if (!isSettled(recording.state))
      return {
        ...identity,
        state: "not_requested",
        reason: "capture_not_finalized",
        retryable: false,
        jobId: null,
        published: null,
      };
    if (recording.state === "canceled" || recording.sourceDurationUs === null)
      return {
        ...identity,
        state: "unavailable",
        reason: "no_usable_video",
        retryable: false,
        jobId: null,
        published: null,
      };
    const status = this.jobs.status(this.identity(recordingId));
    return {
      ...identity,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(status.published.result) as SceneEvidenceMetadata,
          }
        : null,
    };
  }
  prepare(recordingId: string): void {
    const recording = this.store.get(recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      return;
    this.jobs.submit({ ...this.identity(recordingId), lane: "heavy" });
  }
  resume(): void {
    if (
      this.store.catalog
        .prepare("SELECT 1 FROM jobs WHERE artifact=? AND state IN ('queued','running') LIMIT 1")
        .get(artifact)
    )
      return;
    const pending = this.store.catalog
      .prepare(`SELECT recordingId FROM recordings
      WHERE state IN ('complete','interrupted') AND sourceDurationUs IS NOT NULL
      AND recordingId NOT IN (SELECT recordingId FROM recording_deletions)
      AND NOT EXISTS (SELECT 1 FROM jobs WHERE jobs.recordingId=recordings.recordingId
        AND jobs.revisionId='r0' AND jobs.artifact=? AND jobs.input=?)
      ORDER BY creationSequence LIMIT 1`)
      .get(artifact, scenePolicy.id) as { recordingId: string } | undefined;
    if (!pending) return;
    try {
      this.prepare(pending.recordingId);
    } catch (error) {
      if (error instanceof CatalogError && error.code === "LIMIT_EXCEEDED") return;
      throw error;
    }
  }
  retry(recordingId: string) {
    this.prepare(recordingId);
    const status = this.status(recordingId);
    if (!status.jobId)
      throw new CatalogError("UNAVAILABLE", status.reason ?? "Scene evidence unavailable");
    this.jobs.retry(status.jobId);
    return this.status(recordingId);
  }
  async cleanup(signal: AbortSignal): Promise<void> {
    let after = "";
    let firstError: unknown;
    for (;;) {
      signal.throwIfAborted();
      const row = this.store.catalog
        .prepare(
          "SELECT recordingId FROM recordings WHERE recordingId>? ORDER BY recordingId LIMIT 1",
        )
        .get(after) as { recordingId: string } | undefined;
      if (!row) break;
      after = row.recordingId;
      try {
        await this.cleanupRecording(row.recordingId, signal);
      } catch (error) {
        signal.throwIfAborted();
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }
  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.evidence.reclaim(
      recordingId,
      (generation) => {
        if (this.jobs.isAttemptActive(generation) || this.retained?.(recordingId, generation))
          return true;
        if (
          this.store.catalog
            .prepare(
              "SELECT 1 FROM jobs WHERE recordingId=? AND artifact=? AND attemptId=? AND state IN ('queued','running')",
            )
            .get(recordingId, artifact, generation)
        )
          return true;
        return !!this.store.catalog
          .prepare(`SELECT 1 FROM artifacts WHERE recordingId=? AND artifact=?
    AND CASE WHEN json_valid(result) THEN CASE WHEN json_type(result,'$.generation')='text'
    THEN json_extract(result,'$.generation')=? ELSE 1 END ELSE 1 END`)
          .get(recordingId, artifact, generation);
      },
      signal,
    );
  }
  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.artifact !== artifact || job.input !== scenePolicy.id || job.revisionId !== "r0")
      throw new CatalogError("UNSUPPORTED_JOB", "Scene processor cannot execute this job");
    const recording = this.store.get(job.recordingId);
    if (
      !isSettled(recording.state) ||
      recording.state === "canceled" ||
      recording.sourceDurationUs === null
    )
      throw new CatalogError("UNAVAILABLE", "Scene analysis needs finalized video");
    await this.cleanupRecording(job.recordingId, signal);
    const identity = {
      recordingId: job.recordingId,
      sourceId: recording.sourceId,
      generation: job.attemptId,
      policy: scenePolicy.id,
    };
    const kept = { startUs: 0, endUs: recording.sourceDurationUs };
    const source = join(this.home, "recordings", job.recordingId, "source", "video.mov");
    const analysis = new SourceSceneAnalysis(job.recordingId, source, kept.endUs, this.sample);
    try {
      for (let startUs = 0; startUs < kept.endUs; startUs += scenePolicy.maximumRangeUs) {
        signal.throwIfAborted();
        const analyzed = await analysis.analyze(
          { startUs, endUs: Math.min(startUs + scenePolicy.maximumRangeUs, kept.endUs) },
          signal,
        );
        this.evidence.append(identity, analyzed);
        await setImmediate();
      }
      signal.throwIfAborted();
      return JSON.stringify(this.evidence.finish(identity, kept.endUs));
    } catch (error) {
      await this.evidence.remove(identity);
      throw error;
    }
  }
}
