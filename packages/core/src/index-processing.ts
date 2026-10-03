import type { ProjectStore } from "./projects.js";
import type { ProjectFrameInput } from "./frame-inspection.js";
import { projectComposition } from "./project-window.js";
import {
  projectIndexPlan,
  type ProjectIndexIdentity,
  type ProjectIndexRecords,
} from "./project-index.js";
import { materializeProjectIndex } from "./project-index-materialization.js";
import { isDeepStrictEqual } from "node:util";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import type { DerivedCache } from "./cache.js";
import type { MediaFrameInspection } from "./frame-inspection.js";
import {
  sceneGenerationResource,
  type SceneEvidenceStore,
  type SceneEvidenceMetadata,
} from "./scene-evidence.js";
import { type SourceSelection } from "./source-selection.js";
import type { SourceIndexIdentity, SourceIndexRecords } from "./source-index.js";
import { sourceIndexPolicy } from "./source-index-selection.js";
import { materializeSourceIndex } from "./source-index-materialization.js";
import { evidenceRecordingId } from "./evidence.js";
import {
  RetainedIndexRead,
  validateIndexCoverageCursor,
  type IndexCoverageCursor,
  type IndexReadCursor,
} from "./index-read.js";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { type RevisionStore } from "./library.js";
import { CatalogError, type Catalog } from "./catalog.js";
import type { Job, JobAdmission, JobExecution, JobQueue, RetainedArtifact } from "./jobs.js";
import type { SourceTrailRead, SourceEvidenceMetadata } from "./evidence.js";
import type { SourceProcessing } from "./processing.js";
import type { SceneProcessing } from "./scene-processing.js";
import type { SceneEvidenceRead, RecordingSceneEvidenceMetadata } from "./scene-evidence.js";
import { selectIndex } from "./selection.js";
import { selectionEvidence } from "./selection-evidence.js";
import { materializeFrame, framePolicy, type FrameDecoder } from "./frame-materialization.js";
import { trailPolicy } from "./trails.js";
import type { VisualSampler } from "./scenes.js";
import {
  selectionPolicy,
  encodeIndexRecord,
  type ScreenshotIndexStore,
  type ScreenshotIndexMetadata,
} from "./screenshot-index.js";

const artifact = "screenshot-index";
export type IndexReference = Pick<
  ScreenshotIndexMetadata,
  "recordingId" | "revisionId" | "generation"
>;
export type IndexFrameReference = IndexReference & { ordinal: number };
export type IndexEvidence = {
  source: SourceEvidenceMetadata;
  scenes: RecordingSceneEvidenceMetadata;
};
type IndexInput = IndexEvidence & {
  selectionPolicy: string;
  framePolicy: string;
  trailPolicy: string;
};
export type SourceIndexReference = SourceSelection & { generation: string };
type SourceIndexInput = Omit<SourceIndexIdentity, "generation">;
export type ProjectIndexReference = Pick<
  ProjectIndexIdentity,
  "projectId" | "revisionId" | "generation" | "tap" | "maxLongEdge"
>;
export type ProjectIndexInput = Omit<ProjectFrameInput, "atUs">;
type ProjectIndexRecipe = Omit<ProjectIndexIdentity, "generation">;
function projectRecipe(metadata: ProjectIndexRecipe): ProjectIndexRecipe {
  return {
    projectId: metadata.projectId,
    revisionId: metadata.revisionId,
    maxLongEdge: metadata.maxLongEdge,
    tap: metadata.tap,
    implementationId: metadata.implementationId,
    selectionPolicy: metadata.selectionPolicy,
    scenes: metadata.scenes,
  };
}
type MediaIndexOwners = {
  catalog: Catalog;
  assets: AssetStore;
  acquisitions: AcquisitionStore;
  scenes: SceneProcessing;
  records: SceneEvidenceStore;
  frames: MediaFrameInspection;
  cache: DerivedCache;
};
export type IndexProcessingOptions = {
  jobs: JobQueue;
  asset?: MediaIndexOwners & { index: ScreenshotIndexStore<SourceIndexRecords> };
  project?: MediaIndexOwners & {
    projects: ProjectStore;
    index: ScreenshotIndexStore<ProjectIndexRecords>;
  };
  recording?: {
    store: RevisionStore;
    index: ScreenshotIndexStore;
    source: SourceProcessing;
    scenes: SceneProcessing;
    evidence: { source: SourceTrailRead; scenes: SceneEvidenceRead };
    home: string;
    render: { decode: FrameDecoder; sample: VisualSampler };
    retained?: (recordingId: string, generation: string) => boolean;
  };
};
/** Dependency readiness is resolved before index admission to the existing work lanes. */
export class IndexProcessing {
  private readonly jobs: JobQueue;
  constructor(private readonly options: IndexProcessingOptions) {
    this.jobs = options.jobs;
    if (options.project)
      options.project.catalog.catalog.exec(`CREATE INDEX IF NOT EXISTS project_index_publication
        ON artifacts(targetKind,targetId,revisionId,artifact,json_extract(result,'$.generation'))
        WHERE targetKind='project' AND artifact='screenshot-index'`);
    if (options.asset)
      options.asset.catalog.catalog.exec(`
      CREATE INDEX IF NOT EXISTS source_index_publication ON artifacts(targetKind,targetId,artifact,json_extract(result,'$.generation')) WHERE targetKind='asset' AND artifact='screenshot-index';
    `);
  }
  private get recording() {
    if (!this.options.recording)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording indexes are unavailable");
    return this.options.recording;
  }

  private get asset() {
    if (!this.options.asset)
      throw new CatalogError("UNSUPPORTED_JOB", "Source indexes are unavailable");
    return this.options.asset;
  }
  private get project() {
    if (!this.options.project)
      throw new CatalogError("UNSUPPORTED_JOB", "Project indexes are unavailable");
    return this.options.project;
  }
  private projectPlan(input: ProjectIndexInput) {
    return projectIndexPlan(
      projectComposition(this.project.projects, this.project.assets, input),
      input,
      this.project.frames.projectSupport,
    );
  }
  requestProject(input: ProjectIndexInput) {
    const plan = this.projectPlan(input);
    const dependencies = plan.sources.map((selection) => ({
      artifact: "source-scenes" as const,
      ...this.project.scenes.publishedSource(selection),
    }));
    const waiting =
      dependencies.find(
        (value) => !value.published && ["failed", "unavailable"].includes(value.state),
      ) ?? dependencies.find((value) => !value.published);
    if (waiting)
      return {
        ...plan.identity,
        state: waiting.state,
        reason: waiting.reason,
        retryable: waiting.retryable,
        jobId: null,
        published: null,
        dependencies,
      };
    const recipe = projectRecipe({
      ...plan.identity,
      scenes: dependencies.map((value) => value.published!.evidence),
    });
    const identity = {
      target: {
        kind: "project" as const,
        projectId: recipe.projectId,
        revisionId: recipe.revisionId,
      },
      artifact,
      input: encodeIndexRecord(recipe),
    };
    const submit = plan.pointerSources.length
      ? this.jobs.submitDeferred.bind(this.jobs)
      : this.jobs.submit.bind(this.jobs);
    if (!this.jobs.status(identity).published)
      submit({ ...identity, lane: "heavy" }, (job) => {
        encodeIndexRecord({ ...recipe, generation: job.attemptId });
        this.jobs.retainInputs(
          job.jobId,
          "scene-generation",
          recipe.scenes.map(sceneGenerationResource),
        );
      });
    const status = this.jobs.status(identity);
    return {
      ...plan.identity,
      ...status,
      dependencies: [],
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(
              status.published.result,
            ) as ScreenshotIndexMetadata<ProjectIndexRecords>,
          }
        : null,
    };
  }
  retryProject(input: ProjectIndexInput) {
    const status = this.requestProject(input);
    if (!status.published)
      for (const selection of this.projectPlan(input).pointerSources)
        this.project.frames.projectSupport.pointers?.retry(selection);
    if (status.jobId) this.jobs.retry(status.jobId);
    else
      for (const dependency of status.dependencies)
        if (dependency.retryable && !["queued", "processing", "ready"].includes(dependency.state))
          this.project.scenes.retrySource(dependency);
    return this.requestProject(input);
  }
  publishedProject(reference: ProjectIndexReference) {
    this.project.projects.get(reference.projectId);
    const row = this.project.catalog.catalog
      .prepare(`SELECT result FROM artifacts
      WHERE targetKind='project' AND targetId=? AND revisionId=? AND artifact='screenshot-index'
      AND json_extract(result,'$.generation')=? LIMIT 1`)
      .get(reference.projectId, reference.revisionId, reference.generation) as
      | { result: string }
      | undefined;
    if (!row)
      throw new CatalogError("ARTIFACT_CHANGED", "Project screenshot index is not published");
    const metadata = JSON.parse(row.result) as ScreenshotIndexMetadata<ProjectIndexRecords>;
    if (!isDeepStrictEqual(this.projectReference(metadata), this.projectReference(reference)))
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Project screenshot index belongs to another selection",
      );
    return metadata;
  }
  private projectReference(input: ProjectIndexReference): ProjectIndexReference {
    return {
      projectId: input.projectId,
      revisionId: input.revisionId,
      generation: input.generation,
      tap: input.tap,
      maxLongEdge: input.maxLongEdge,
    };
  }
  private projectRead(reference: ProjectIndexReference) {
    const pinned = this.projectReference(reference);
    return new RetainedIndexRead<ProjectIndexReference, ProjectIndexRecords>(
      this.project.index,
      this.publishedProject(pinned),
      pinned,
    );
  }
  getProject(
    input: ProjectIndexInput & {
      cursor?: IndexReadCursor<ProjectIndexReference> | undefined;
      limit?: number;
    },
  ) {
    if (
      input.cursor &&
      (input.cursor.projectId !== input.projectId ||
        (input.revisionId !== undefined && input.cursor.revisionId !== input.revisionId) ||
        (input.tap !== undefined && !isDeepStrictEqual(input.cursor.tap, input.tap)) ||
        (input.maxLongEdge !== undefined && input.cursor.maxLongEdge !== input.maxLongEdge))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Project index continuation belongs to another selection",
      );
    const status = input.cursor ? null : this.requestProject(input);
    if (status && !status.published) return { ...status, page: null };
    const metadata = input.cursor
      ? this.publishedProject(input.cursor)
      : status!.published!.evidence;
    return this.projectRead(metadata).get({ cursor: input.cursor, limit: input.limit });
  }
  coverageProject(
    input: ProjectIndexReference & {
      candidateOrdinal?: number | undefined;
      cursor?: IndexCoverageCursor<ProjectIndexReference> | undefined;
      limit?: number | undefined;
    },
  ) {
    return this.projectRead(input).coverage(input);
  }
  frameProject(input: ProjectIndexReference & { ordinal: number }) {
    return this.projectRead(input).frame(input.ordinal);
  }
  openReadProject(input: ProjectIndexReference & { ordinal: number }) {
    return this.projectRead(input).openRead(input.ordinal);
  }
  private async cleanupProject(projectId: string, signal: AbortSignal) {
    const owner = { kind: "project" as const, projectId };
    await this.project.index.reclaim(
      owner,
      ({ generation }) => this.jobs.retainsAttempt(owner, artifact, generation),
      signal,
    );
  }
  admitProject(job: Job): ReturnType<JobAdmission> {
    if (job.target.kind !== "project" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Index admission requires a project index");
    const input = JSON.parse(job.input) as ProjectIndexRecipe;
    if (input.implementationId !== this.project.frames.projectSupport.implementationId)
      throw new CatalogError(
        "NOT_READY",
        "Pinned picture renderer is unavailable",
        { implementationId: input.implementationId },
        true,
      );
    const plan = this.projectPlan(input);
    return (
      this.project.frames.projectSupport.pointers?.admit(plan.pointerSources) ?? { state: "ready" }
    );
  }
  private async executeProject({ job, signal }: JobExecution) {
    if (job.target.kind !== "project" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Project index requires a project job");
    const input = JSON.parse(job.input) as ProjectIndexRecipe;
    const plan = this.projectPlan(input);
    const { scenes, ...identity } = input;
    if (
      job.target.projectId !== input.projectId ||
      job.target.revisionId !== input.revisionId ||
      !isDeepStrictEqual(identity, plan.identity)
    )
      throw new CatalogError("ARTIFACT_CHANGED", "Project index recipe changed");
    await this.cleanupProject(input.projectId, signal);
    const materialize = () =>
      materializeProjectIndex(
        { ...identity, scenes, generation: job.attemptId },
        plan,
        { ...this.project, jobs: this.jobs },
        job.generation > 1 && !this.jobs.wasReadmitted(job.jobId),
        signal,
      );
    const pointers = this.project.frames.projectSupport.pointers;
    return JSON.stringify(
      pointers ? await pointers.withReady(plan.pointerSources, materialize) : await materialize(),
    );
  }
  portableProject(metadata: ScreenshotIndexMetadata<ProjectIndexRecords>) {
    const publication = this.jobs.retainedArtifact(
      { kind: "project", projectId: metadata.projectId },
      artifact,
      metadata.generation,
    );
    if (publication && !isDeepStrictEqual(JSON.parse(publication.result), metadata))
      throw new CatalogError(
        "INVALID_STORAGE",
        "Project screenshot publication differs from retained rows",
      );
    return publication
      ? {
          generation: publication.generation,
          attemptId: publication.attemptId,
          input: publication.input,
        }
      : null;
  }
  adoptProjectPublication(
    original: ScreenshotIndexMetadata<ProjectIndexRecords>,
    adopted: ScreenshotIndexMetadata<ProjectIndexRecords>,
    publication: Pick<RetainedArtifact, "generation" | "attemptId" | "input"> | null,
  ) {
    if (!publication) return;
    let saved: ProjectIndexRecipe;
    try {
      saved = JSON.parse(publication.input) as ProjectIndexRecipe;
    } catch {
      throw new CatalogError("INVALID_PACKAGE", "Invalid project screenshot recipe");
    }
    if (
      publication.attemptId !== original.generation ||
      !isDeepStrictEqual(saved, projectRecipe(original))
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Project screenshot recipe differs from retained evidence",
      );
    const scenes = original.scenes.map((metadata, index) => {
      const retained = this.project.scenes.portablePublication(metadata);
      const scene = retained
        ? (JSON.parse(retained.result) as SceneEvidenceMetadata)
        : saved.scenes[index]!;
      if (!isDeepStrictEqual(scene, metadata))
        throw new CatalogError(
          "INVALID_PACKAGE",
          "Project screenshot scene recipe differs from retained evidence",
        );
      return scene;
    });
    this.jobs.adoptArtifact({
      ...publication,
      target: { kind: "project", projectId: adopted.projectId, revisionId: adopted.revisionId },
      input: encodeIndexRecord(projectRecipe({ ...adopted, scenes })),
      artifact,
      result: JSON.stringify(this.project.index.metadata(adopted)),
    });
  }
  portableSource(metadata: ScreenshotIndexMetadata<SourceIndexRecords>) {
    const publication = this.jobs.retainedArtifact(
      { kind: "asset", assetId: metadata.assetId },
      artifact,
      metadata.generation,
    );
    if (publication && !isDeepStrictEqual(JSON.parse(publication.result), metadata))
      throw new CatalogError(
        "INVALID_STORAGE",
        "Screenshot index publication differs from retained rows",
      );
    return publication
      ? {
          generation: publication.generation,
          attemptId: publication.attemptId,
          input: publication.input,
        }
      : null;
  }
  adoptSourcePublication(
    metadata: ScreenshotIndexMetadata<SourceIndexRecords>,
    publication: Pick<RetainedArtifact, "generation" | "attemptId" | "input"> | null,
  ) {
    if (!publication) return;
    let saved: SourceIndexInput;
    try {
      saved = JSON.parse(publication.input) as SourceIndexInput;
    } catch {
      throw new CatalogError("INVALID_PACKAGE", "Invalid screenshot index recipe");
    }
    const scenePublication = this.asset.scenes.portablePublication(metadata.scenes);
    const scenes = scenePublication
      ? (JSON.parse(scenePublication.result) as SceneEvidenceMetadata)
      : saved?.scenes;
    if (!isDeepStrictEqual(scenes, metadata.scenes))
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Screenshot index scene recipe differs from retained evidence",
      );
    const input: SourceIndexInput = {
      assetId: metadata.assetId,
      streamId: metadata.streamId,
      ...(metadata.acquisitionId === undefined ? {} : { acquisitionId: metadata.acquisitionId }),
      scenes,
      selectionPolicy: metadata.selectionPolicy,
      implementationId: metadata.implementationId,
      maxLongEdge: metadata.maxLongEdge,
    };
    if (
      publication.attemptId !== metadata.generation ||
      publication.input !== encodeIndexRecord(input)
    )
      throw new CatalogError(
        "INVALID_PACKAGE",
        "Retained screenshot index recipe differs from metadata",
      );
    this.jobs.adoptArtifact({
      ...publication,
      target: { kind: "asset", assetId: metadata.assetId },
      artifact,
      result: JSON.stringify(this.asset.index.metadata(metadata)),
    });
  }
  private sourceRecipe(
    options: ReturnType<MediaFrameInspection["sourcePlan"]>["options"],
    scenes: SceneEvidenceMetadata,
  ): SourceIndexInput {
    return {
      ...options.selection,
      scenes,
      selectionPolicy: sourceIndexPolicy.id,
      implementationId: options.implementationId,
      maxLongEdge: options.maxLongEdge,
    };
  }
  requestSource(selection: SourceSelection) {
    const plan = this.asset.frames.sourcePlan({ ...selection, atUs: 0 });
    selection = plan.source.selection;
    const dependency = this.asset.scenes.publishedSource(selection);
    if (!dependency.published)
      return {
        ...selection,
        state: dependency.state,
        reason: dependency.reason,
        retryable: dependency.retryable,
        jobId: null,
        published: null,
        dependencies: [{ artifact: "source-scenes", ...dependency }],
      };
    const input = this.sourceRecipe(plan.options, dependency.published.evidence);
    const identity = {
      target: { kind: "asset" as const, assetId: input.assetId },
      artifact,
      input: encodeIndexRecord(input),
    };
    if (!this.jobs.status(identity).published)
      this.jobs.submit({ ...identity, lane: "heavy" }, (job) => {
        encodeIndexRecord({ ...input, generation: job.attemptId });
        this.jobs.retainInputs(job.jobId, "scene-generation", [
          sceneGenerationResource(input.scenes),
        ]);
        const owner = { kind: "job" as const, id: job.jobId };
        this.asset.assets.retain(owner, [input.assetId]);
        if (input.acquisitionId) this.asset.acquisitions.retain(owner, [input.acquisitionId]);
      });
    const status = this.jobs.status(identity);
    return {
      ...selection,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(
              status.published.result,
            ) as ScreenshotIndexMetadata<SourceIndexRecords>,
          }
        : null,
      dependencies: [],
    };
  }
  retrySource(selection: SourceSelection) {
    const status = this.requestSource(selection);
    if (status.jobId) this.jobs.retry(status.jobId);
    else if (status.retryable && !["queued", "processing", "ready"].includes(status.state))
      this.asset.scenes.retrySource(
        this.asset.frames.sourcePlan({ ...selection, atUs: 0 }).source.selection,
      );
    return this.requestSource(selection);
  }
  publishedSource(reference: SourceIndexReference) {
    const selected = this.asset.frames.sourcePlan({ ...reference, atUs: 0 }).source;
    const row = this.asset.catalog.catalog
      .prepare(
        `SELECT result FROM artifacts WHERE targetKind='asset' AND targetId=? AND artifact='screenshot-index' AND json_extract(result,'$.generation')=? LIMIT 1`,
      )
      .get(reference.assetId, reference.generation) as { result: string } | undefined;
    if (!row)
      throw new CatalogError("ARTIFACT_CHANGED", "Source screenshot index is not published");
    const metadata = JSON.parse(row.result) as ScreenshotIndexMetadata<SourceIndexRecords>;
    if (
      metadata.assetId !== selected.selection.assetId ||
      metadata.streamId !== selected.selection.streamId ||
      metadata.acquisitionId !== selected.selection.acquisitionId
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Source screenshot index belongs to another selection",
      );
    return metadata;
  }
  private sourceRead(reference: SourceIndexReference) {
    const pinned = {
      assetId: reference.assetId,
      streamId: reference.streamId,
      ...(reference.acquisitionId === undefined ? {} : { acquisitionId: reference.acquisitionId }),
      generation: reference.generation,
    };
    return new RetainedIndexRead<SourceIndexReference, SourceIndexRecords>(
      this.asset.index,
      this.publishedSource(pinned),
      pinned,
    );
  }
  getSource(
    input: SourceSelection & {
      cursor?: IndexReadCursor<SourceIndexReference> | undefined;
      limit?: number;
    },
  ) {
    if (
      input.cursor &&
      (input.cursor.assetId !== input.assetId ||
        input.cursor.streamId !== input.streamId ||
        input.cursor.acquisitionId !== input.acquisitionId)
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Source index continuation belongs to another selection",
      );
    const status = input.cursor ? null : this.requestSource(input);
    if (status && !status.published) return { ...status, page: null };
    const metadata = input.cursor
      ? this.publishedSource(input.cursor)
      : status!.published!.evidence;
    return this.sourceRead(metadata).get({ cursor: input.cursor, limit: input.limit });
  }
  coverageSource(
    input: SourceIndexReference & {
      candidateOrdinal?: number | undefined;
      cursor?: IndexCoverageCursor<SourceIndexReference> | undefined;
      limit?: number | undefined;
    },
  ) {
    return this.sourceRead(input).coverage(input);
  }
  frameSource(input: SourceIndexReference & { ordinal: number }) {
    return this.sourceRead(input).frame(input.ordinal);
  }
  openReadSource(input: SourceIndexReference & { ordinal: number }) {
    return this.sourceRead(input).openRead(input.ordinal);
  }
  /** Scene evidence stays pinned for unfinished recipes, including explicit retry after failure. */
  retainsSourceScenes(assetId: string, generation: string) {
    return this.jobs.retainsInput(
      "scene-generation",
      sceneGenerationResource({ owner: { kind: "asset", assetId }, generation }),
    );
  }
  private async cleanupAsset(assetId: string, signal: AbortSignal) {
    const owner = { kind: "asset" as const, assetId };
    await this.asset.index.reclaim(
      owner,
      ({ generation }) => this.jobs.retainsAttempt(owner, artifact, generation),
      signal,
    );
  }
  private async executeSource({ job, signal }: JobExecution) {
    if (job.target.kind !== "asset" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Source index requires an asset job");
    const input = JSON.parse(job.input) as SourceIndexInput;
    if (job.target.assetId !== input.assetId)
      throw new CatalogError("ARTIFACT_CHANGED", "Source index recipe changed");
    const { options, source } = this.asset.frames.sourcePlan({ ...input, atUs: 0 });
    if (!isDeepStrictEqual(input, this.sourceRecipe(options, input.scenes)))
      throw new CatalogError("ARTIFACT_CHANGED", "Source index recipe changed");
    await this.cleanupAsset(input.assetId, signal);
    return JSON.stringify(
      await materializeSourceIndex(
        { ...input, generation: job.attemptId },
        { durationUs: source.durationUs, support: source.track.available },
        this.asset,
        job.generation > 1,
        signal,
      ),
    );
  }

  request(input: {
    recordingId: string;
    revisionId?: string | undefined;
    evidence?: IndexEvidence;
  }) {
    const revision = this.recording.store.revision(input.recordingId, input.revisionId);
    let selected = input.evidence;
    if (!selected) {
      this.recording.source.prepare(input.recordingId);
      this.recording.scenes.prepare(input.recordingId);
      const source = this.recording.source.status(input.recordingId);
      const scenes = this.recording.scenes.status(input.recordingId);
      const dependencies = [
        { artifact: "source", ...source },
        { artifact: "scenes", ...scenes },
      ];
      if (!source.published || !scenes.published) {
        const waiting =
          dependencies.find((item) => ["failed", "unavailable"].includes(item.state)) ??
          dependencies.find((item) => !item.published)!;
        return {
          recordingId: input.recordingId,
          revisionId: revision.id,
          state: waiting.state,
          reason: waiting.reason,
          retryable: waiting.retryable,
          jobId: null,
          published: null,
          dependencies,
        };
      }
      selected = { source: source.published.evidence, scenes: scenes.published.evidence };
    }
    const sourceId = this.recording.store.get(input.recordingId).sourceId;
    if (
      evidenceRecordingId(selected.source) !== input.recordingId ||
      selected.scenes.recordingId !== input.recordingId ||
      [selected.source, selected.scenes].some((value) => value.sourceId !== sourceId)
    )
      throw new CatalogError("INVALID_EVIDENCE", "Index evidence belongs to another source");
    const options: IndexInput = {
      ...selected,
      selectionPolicy: selectionPolicy.id,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const identity = {
      target: {
        kind: "recording" as const,
        recordingId: input.recordingId,
        revisionId: revision.id,
      },

      artifact,
      input: JSON.stringify(options),
    };
    const existing = this.jobs.status(identity);
    if (!existing.jobId) this.requireSlot();
    this.jobs.submit({ ...identity, lane: "frame" });
    const status = this.jobs.status(identity);
    return {
      recordingId: input.recordingId,
      revisionId: revision.id,
      ...status,
      published: status.published
        ? {
            generation: status.published.generation,
            evidence: JSON.parse(status.published.result) as ScreenshotIndexMetadata,
          }
        : null,
      dependencies: [],
    };
  }

  get(input: {
    recordingId: string;
    revisionId?: string | undefined;
    cursor?: IndexReadCursor<IndexReference> | undefined;
    limit?: number | undefined;
  }) {
    const cursor = input.cursor;
    if (
      cursor &&
      (cursor.recordingId !== input.recordingId ||
        (input.revisionId !== undefined && input.revisionId !== cursor.revisionId))
    )
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Index continuation belongs to another recording or revision",
      );
    const status = cursor ? null : this.request(input);
    if (status && !status.published) return { ...status, page: null };
    const metadata = cursor ? this.published(cursor) : status!.published!.evidence;
    return new RetainedIndexRead(this.recording.index, metadata, {
      recordingId: metadata.recordingId,
      revisionId: metadata.revisionId,
      generation: metadata.generation,
    }).get({ cursor, limit: input.limit });
  }

  coverage(
    input: IndexReference & {
      candidateOrdinal?: number | undefined;
      cursor?: IndexCoverageCursor<IndexReference> | undefined;
      limit?: number | undefined;
    },
  ) {
    const reference: IndexReference = {
      recordingId: input.recordingId,
      revisionId: input.revisionId,
      generation: input.generation,
    };
    validateIndexCoverageCursor(reference, input);
    return new RetainedIndexRead(
      this.recording.index,
      this.published(reference),
      reference,
    ).coverage(input);
  }

  frame(input: IndexFrameReference) {
    return this.read(input).frame(input.ordinal);
  }

  openRead(input: IndexFrameReference) {
    return this.read(input).openRead(input.ordinal);
  }

  private read(input: IndexReference) {
    const reference: IndexReference = {
      recordingId: input.recordingId,
      revisionId: input.revisionId,
      generation: input.generation,
    };
    return new RetainedIndexRead(this.recording.index, this.published(reference), reference);
  }

  /** Public references resolve through queue publication, never merely a completed store row. */
  published(input: IndexReference) {
    this.recording.store.revision(input.recordingId, input.revisionId);
    const row = this.recording.store.catalog
      .prepare(`SELECT result FROM artifacts WHERE targetKind='recording' AND targetId=? AND revisionId=? AND artifact=?
        AND json_extract(result,'$.generation')=? LIMIT 1`)
      .get(input.recordingId, input.revisionId, artifact, input.generation) as
      | { result: string }
      | undefined;
    if (!row)
      throw new CatalogError(
        "ARTIFACT_CHANGED",
        "Screenshot index reference is not published for this revision",
      );
    return JSON.parse(row.result) as ScreenshotIndexMetadata;
  }

  retry(input: { recordingId: string; revisionId?: string | undefined }) {
    const status = this.request(input);
    if (!status.jobId) return status;
    const job = this.jobs.job(status.jobId);
    if (!["queued", "running", "ready"].includes(job.state)) this.requireSlot();
    this.jobs.retry(job.jobId);
    return this.request({ ...input, revisionId: status.revisionId });
  }
  private requireSlot() {
    if (this.jobs.isArtifactBusy(artifact))
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Another screenshot index is using the background frame slot",
        {},
        true,
      );
  }

  async execute({ job, signal }: JobExecution): Promise<string> {
    if (job.target.kind === "asset") return this.executeSource({ job, signal });
    if (job.target.kind === "project") return this.executeProject({ job, signal });
    if (job.target.kind !== "recording" || job.target.revisionId === null)
      throw new CatalogError("UNSUPPORTED_JOB", "Recording processing requires a pinned revision");
    const input = JSON.parse(job.input) as IndexInput;
    if (
      job.artifact !== artifact ||
      input.selectionPolicy !== selectionPolicy.id ||
      input.framePolicy !== framePolicy ||
      input.trailPolicy !== trailPolicy.id
    )
      throw new CatalogError("UNSUPPORTED_JOB", "Index processor cannot execute this job");
    const revision = this.recording.store.revision(job.target.recordingId, job.target.revisionId);
    const sourceId = this.recording.store.get(job.target.recordingId).sourceId;
    const sourceIdentity = {
      owner: { kind: "recording" as const, recordingId: job.target.recordingId },
      sourceId,
      generation: input.source.generation,
    };
    const sceneIdentity = {
      recordingId: job.target.recordingId,
      sourceId,
      generation: input.scenes.generation,
      policy: input.scenes.policy,
    };
    const identity = {
      recordingId: job.target.recordingId,
      sourceId,
      revisionId: revision.id,
      generation: job.attemptId,
      sourceIdentity,
      sceneIdentity,
      selectionPolicy: input.selectionPolicy,
      framePolicy: input.framePolicy,
      trailPolicy: input.trailPolicy,
    };
    await this.cleanupRecording(job.target.recordingId, signal);
    const selection = {
      revision,
      sourceIdentity,
      sceneIdentity,
      sourceWidth: input.scenes.sourceWidth,
      sourceHeight: input.scenes.sourceHeight,
    };
    try {
      this.recording.index.begin(identity);
      for await (const row of selectIndex(
        selection,
        selectionEvidence(selection, this.recording.evidence, signal),
        signal,
      )) {
        signal.throwIfAborted();
        if (row.kind === "coverage") this.recording.index.appendCoverage(identity, row);
        else {
          const selectionEndUs = row.reasons.reduce(
            (end, reason) => (reason.side === "before" ? Math.min(end, reason.eventSourceUs) : end),
            row.kept.endUs,
          );
          const frame = await materializeFrame(
            {
              recordingId: job.target.recordingId,
              sourceId,
              revision,
              source: join(
                this.recording.home,
                "recordings",
                job.target.recordingId,
                "source",
                "video.mov",
              ),
              output: this.recording.index.outputPath(identity, row.ordinal),
              atUs: row.requestedPlaybackUs,
              ...(selectionEndUs < row.kept.endUs ? { selectionEndUs } : {}),
              maxLongEdge: 1600,
              crop: null,
              clean: false,
              trailUs: trailPolicy.defaultUs,
              sourceEvidence: input.source,
            },
            { ...this.recording.render, evidence: this.recording.evidence.source },
            signal,
          );
          this.recording.index.appendCandidate(identity, row, frame);
        }
        await setImmediate();
      }
      signal.throwIfAborted();
      const result = await this.recording.index.finish(identity, signal);
      signal.throwIfAborted();
      return JSON.stringify(result);
    } catch (error) {
      await this.recording.index.remove(identity);
      throw error;
    }
  }

  private cleanupRecording(recordingId: string, signal: AbortSignal) {
    return this.recording.index.reclaim(
      { kind: "recording", recordingId },
      ({ generation }) =>
        this.jobs.retainsAttempt(
          { kind: "recording", recordingId: recordingId },
          artifact,
          generation,
        ) || !!this.recording.retained?.(recordingId, generation),
      signal,
    );
  }
  async cleanup(signal: AbortSignal): Promise<void> {
    if (this.options.recording)
      await this.recording.store.forEachRecording(signal, ({ recordingId }) =>
        this.cleanupRecording(recordingId, signal),
      );
    if (this.options.project) {
      let afterSequence = 0;
      for (;;) {
        signal.throwIfAborted();
        const page = this.project.projects.list({ afterSequence, limit: 100 });
        for (const project of page.projects) await this.cleanupProject(project.projectId, signal);
        if (!page.nextCursor) break;
        afterSequence = page.nextCursor.afterSequence;
        await setImmediate(undefined, { signal });
      }
    }
    if (this.options.asset) {
      let afterSequence = 0,
        failure: unknown;
      for (;;) {
        signal.throwIfAborted();
        const page = this.asset.assets.list({ afterSequence, limit: 100 });
        for (const asset of page.assets) {
          try {
            await this.cleanupAsset(asset.id, signal);
          } catch (error) {
            signal.throwIfAborted();
            failure ??= error;
          }
        }
        if (!page.nextCursor) break;
        afterSequence = page.nextCursor.afterSequence;
        await setImmediate(undefined, { signal });
      }
      if (failure) throw failure;
    }
  }
}
