import { add, fromTime, rational, toTime } from "@yap/composition";
import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { Catalog } from "./catalog.js";
import type { ProjectStore } from "./projects.js";
import type { AudioExtraction, AudioExtractionInput, ExtractedAudio } from "./audio-extraction.js";
import { CatalogError } from "./catalog.js";
import type {
  ArtifactStatus,
  Job,
  JobAdmission,
  JobExecution,
  JobQueue,
  StagedJobResult,
} from "./jobs.js";
import { ResourceReferences, resourceKinds } from "./references.js";
import {
  transcriptGenerationResource,
  type TranscriptMetadata,
  type TranscriptStore,
} from "./transcript.js";
import type { TranscriptProcessing } from "./transcript-processing.js";
import { SourceTranscriptRead } from "./transcript-read.js";

const artifact = "rendered-speech";
export type RenderedSpeechInput = Extract<AudioExtractionInput, { projectId: string }> & {
  revisionId: string;
  range: { startUs: number; endUs: number };
  tap: NonNullable<Extract<AudioExtractionInput, { projectId: string }>["tap"]>;
};
type RenderedSpeechEvidence = {
  kind: "rendered-speech";
  generation: string;
  selection: RenderedSpeechInput;
  pcm: ExtractedAudio;
  transcript: TranscriptMetadata;
};
export type RenderedSpeechRead = {
  projectId: string;
  revisionId: string;
  generation: string;
  limit?: number | undefined;
  cursor?: { generation: string; sourceCursor: unknown } | undefined;
};

/** A project attempt owns fresh recognition, even when its PCM matches a source asset. */
export class RenderedSpeech {
  private readonly references: ResourceReferences;
  constructor(
    private readonly owners: {
      catalog: Catalog;
      projects: ProjectStore;
      assets: AssetStore;
      jobs: JobQueue;
      extraction: AudioExtraction;
      transcripts: TranscriptProcessing;
      records: TranscriptStore;
    },
  ) {
    this.references = new ResourceReferences(owners.catalog);
  }

  private identity(input: RenderedSpeechInput) {
    this.owners.projects.revision(input.projectId, input.revisionId);
    const request: RenderedSpeechInput = {
      projectId: input.projectId,
      revisionId: input.revisionId,
      range: input.range,
      tap: input.tap,
      rendition: input.rendition,
    };
    return {
      target: {
        kind: "project" as const,
        projectId: request.projectId,
        revisionId: request.revisionId,
      },
      artifact,
      input: JSON.stringify({ request, execution: this.owners.transcripts.recognitionExecution() }),
    };
  }
  private status(input: RenderedSpeechInput) {
    const status = this.owners.jobs.status(this.identity(input));
    return {
      ...input,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            speech: JSON.parse(status.published.result) as RenderedSpeechEvidence,
          }
        : null,
    };
  }
  prepare(input: RenderedSpeechInput) {
    const identity = this.identity(input);
    if (!this.owners.jobs.status(identity).published)
      this.owners.jobs.submitDeferred({ ...identity, lane: "heavy" }, (job) => {
        const dependencies = this.owners.projects.revisionDependencies(
          input.projectId,
          input.revisionId,
        );
        for (const kind of resourceKinds)
          this.owners.jobs.retainInputs(
            job.jobId,
            kind,
            dependencies.filter((d) => d.kind === kind).map((d) => d.id),
          );
      });
    return this.status(input);
  }
  private selection(job: Job) {
    const input = (JSON.parse(job.input) as { request: RenderedSpeechInput }).request;
    const identity = this.identity(input);
    if (
      !isDeepStrictEqual(identity.target, job.target) ||
      job.artifact !== artifact ||
      identity.input !== job.input
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Rendered recognition revision changed");
    return input;
  }
  private dependency(
    status: Pick<ArtifactStatus, "jobId" | "reason" | "retryable"> & { published: unknown },
  ): ReturnType<JobAdmission> {
    if (status.published) return { state: "ready" };
    if (status.jobId) {
      const job = this.owners.jobs.job(status.jobId);
      if (["waiting", "queued", "running"].includes(job.state))
        return { state: "waiting", dependency: job.jobId };
      throw new CatalogError(
        job.errorCode ?? "DEPENDENCY_FAILED",
        job.reason ?? "Rendered speech dependency failed",
        {
          dependencyJobId: job.jobId,
          state: job.state,
          ...job.errorDetails,
        },
        job.retryable,
      );
    }
    throw new CatalogError(
      status.reason === "model_not_prepared" ? "MODEL_NOT_PREPARED" : "UNAVAILABLE",
      status.reason ?? "Rendered speech dependency is unavailable",
      {},
      status.retryable,
    );
  }
  private pcm(status: ArtifactStatus) {
    const pcm = JSON.parse(status.published!.result) as ExtractedAudio;
    if (pcm.origin.selection.kind !== "project")
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Rendered speech requires a project extraction origin",
      );
    if (pcm.origin.selection.unavailable.some((clip) => clip.ranges.length))
      throw new CatalogError(
        "UNAVAILABLE_SUPPORT",
        "Rendered speech cannot recognize missing source support as silence",
        {
          pcmAssetId: pcm.assetId,
          unavailable: pcm.origin.selection.unavailable,
        },
      );
    return pcm;
  }
  admit(job: Job): ReturnType<JobAdmission> {
    const input = this.selection(job);
    const extracted = this.owners.extraction.request(input);
    const extraction = this.dependency(extracted);
    if (extraction.state === "waiting") return extraction;
    const pcm = this.pcm(extracted);
    this.owners.assets.retain({ kind: "job", id: job.jobId }, [pcm.assetId]);
    if (this.owners.transcripts.recognitionReadiness().state !== "ready")
      throw new CatalogError("MODEL_NOT_PREPARED", "Speech models are not prepared", {}, true);
    return { state: "ready" };
  }
  retry(input: RenderedSpeechInput) {
    const current = this.status(input);
    if (current.published) return current;
    if (!current.jobId)
      throw new CatalogError("NOT_READY", "Use transcript.render.prepare before retry");
    const parent = this.owners.jobs.job(current.jobId);
    if (["waiting", "queued", "running"].includes(parent.state)) return current;
    const extracted = this.owners.extraction.request(input);
    if (!extracted.published && extracted.jobId) this.owners.jobs.retry(extracted.jobId);
    this.owners.jobs.retry(current.jobId);
    return this.status(input);
  }
  async execute({ job, signal }: JobExecution): Promise<StagedJobResult> {
    signal.throwIfAborted();
    const input = this.selection(job),
      extracted = this.owners.extraction.request(input);
    if (!extracted.published)
      throw new CatalogError("ARTIFACT_CHANGED", "Rendered PCM dependency disappeared", {}, true);
    const pcm = this.pcm(extracted);
    const resourceId = transcriptGenerationResource({
      owner: { kind: "asset", assetId: pcm.assetId },
      generation: job.attemptId,
    });
    this.owners.jobs.retainInputs(job.jobId, "transcript-generation", [resourceId]);
    const transcript = await this.owners.transcripts.recognizeSource(
      { assetId: pcm.assetId, streamId: pcm.streamId },
      job.attemptId,
      signal,
    );
    const speech: RenderedSpeechEvidence = {
      kind: "rendered-speech",
      generation: job.attemptId,
      selection: input,
      pcm,
      transcript,
    };
    let published = false;
    return {
      result: JSON.stringify(speech),
      publish: () => {
        this.references.retain("transcript-generation", { kind: "job", id: job.jobId }, [
          resourceId,
        ]);
        published = true;
        return undefined;
      },
      close: async () => {
        if (!published) await this.owners.records.remove(transcript);
      },
    };
  }
  get(input: RenderedSpeechRead) {
    this.owners.projects.revision(input.projectId, input.revisionId);
    const retained = this.owners.jobs.retainedArtifact(
      { kind: "project", projectId: input.projectId },
      artifact,
      input.generation,
    );
    if (!retained)
      throw new CatalogError("NOT_FOUND", "Rendered recognition generation is unavailable");
    if (retained.target.kind !== "project" || retained.target.revisionId !== input.revisionId)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Rendered recognition belongs to another revision",
      );
    if (input.cursor && input.cursor.generation !== input.generation)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Rendered recognition continuation changed generation",
      );
    const speech = JSON.parse(retained.result) as RenderedSpeechEvidence;
    const origin = speech.pcm.origin;
    if (origin.selection.kind !== "project")
      throw new CatalogError("INVALID_EVIDENCE", "Rendered PCM origin is not a project");
    const start = rational(
      BigInt(origin.selection.sampleRange.start) * 1000000n,
      BigInt(origin.input.sampleRate),
    );
    const page = new SourceTranscriptRead(this.owners.records, speech.transcript).page({
      ...(input.limit === undefined ? {} : { limit: input.limit }),
      ...(input.cursor === undefined ? {} : { cursor: input.cursor.sourceCursor }),
    });
    return {
      projectId: input.projectId,
      revisionId: input.revisionId,
      generation: input.generation,
      kind: "rendered-speech" as const,
      state: "ready" as const,
      pcm: speech.pcm,
      transcript: speech.transcript,
      page: {
        rows: page.rows.map((row) => ({
          ...row,
          projectRange: {
            startUs: toTime(add(start, fromTime(row.sourceRange.startUs))),
            endUs: toTime(add(start, fromTime(row.sourceRange.endUs))),
          },
        })),
        nextCursor: page.nextCursor
          ? { generation: input.generation, sourceCursor: page.nextCursor }
          : null,
      },
    };
  }
}
