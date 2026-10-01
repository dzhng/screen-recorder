import { AcquisitionStore } from "@screenrec/core/acquisitions";
import { CatalogError } from "@screenrec/core/catalog";
import { CaptureStore, type Recording } from "@screenrec/core/capture-store";
import { JobQueue } from "@screenrec/core/jobs";
import { sourceDirectory } from "./capture.js";
import { operationFailure } from "./operations.js";
import type { OperationFailure } from "@screenrec/protocol";

export type CaptureSourceAdmission = {
  kind: "primary";
  sourceId: string;
  acquisitionId: string | null;
  job: ReturnType<JobQueue["inspect"]> | null;
  admissionError: OperationFailure["error"] | null;
};

/** Capture settles sources; the existing acquisition transaction and queue own their admission. */
export class CaptureAdmission {
  constructor(
    private readonly captures: CaptureStore,
    private readonly acquisitions: AcquisitionStore,
    private readonly jobs: JobQueue,
    private readonly home: string,
  ) {}

  resume(): void {
    for (const recordingId of this.acquisitions.pendingPrimaryCaptures(this.captures)) {
      this.jobs.submit(() => {
        const intent = this.acquisitions.admitCapture(
          this.captures,
          recordingId,
          sourceDirectory(this.home, recordingId),
        );
        return {
          target: { kind: "acquisition", acquisitionId: intent.acquisitionId },
          artifact: "acquisition.import",
          lane: "heavy",
          input: "capture",
        };
      });
    }
  }

  describe(
    snapshot: Pick<Recording, "recordingId">,
  ): Recording & { sourceAdmissions: CaptureSourceAdmission[] } {
    const recording = this.captures.get(snapshot.recordingId);
    try {
      this.captures.settledSource(recording.recordingId);
    } catch (error) {
      if (error instanceof CatalogError && ["NOT_READY", "UNAVAILABLE"].includes(error.code))
        return { ...recording, sourceAdmissions: [] };
      throw error;
    }
    let intent: ReturnType<AcquisitionStore["captureIntent"]> = null;
    let admissionError: OperationFailure["error"] | null = null;
    try {
      intent = this.acquisitions.captureIntent(recording.sourceId);
    } catch (error) {
      if (!(error instanceof CatalogError) || error.code !== "REQUEST_CONFLICT") throw error;
      // The conflicting row is durable refusal evidence, never this source's acquisition/job.
      admissionError = operationFailure(error).error;
    }
    const status = intent
      ? this.jobs.status({
          target: { kind: "acquisition", acquisitionId: intent.acquisitionId },
          artifact: "acquisition.import",
          input: "capture",
        })
      : null;
    const sourceAdmissions: CaptureSourceAdmission[] = [
      {
        kind: "primary",
        sourceId: recording.sourceId,
        acquisitionId: intent?.acquisitionId ?? null,
        job: status?.jobId ? this.jobs.inspect(status.jobId) : null,
        admissionError,
      },
    ];
    return { ...recording, sourceAdmissions };
  }
}
