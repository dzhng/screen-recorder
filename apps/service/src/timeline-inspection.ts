import { dirname } from "node:path";
import { CatalogError, type RevisionStore } from "@screenrec/core/library";
import { TimelineInspection } from "@screenrec/core/timeline-inspection";
import type { SourceProcessing } from "@screenrec/core/processing";
import type { SceneProcessing } from "@screenrec/core/scene-processing";
import type { SourceEvidenceStore } from "@screenrec/core/evidence";
import type { SceneEvidenceStore, SceneEvidenceIdentity } from "@screenrec/core/scene-evidence";
import { FileSceneEvidence } from "@screenrec/core/scene-pages";
import { fileSubdirectory } from "@screenrec/core/files";
import { PackageMediaContext, type PackageTarget } from "./package-media.js";
import type { PackageRegistry } from "./package-registry.js";

export class LibraryTimelineInspection extends TimelineInspection<{ recordingId: string }> {
  constructor(
    private readonly store: RevisionStore,
    private readonly sourceProcessing: SourceProcessing,
    private readonly sceneProcessing: SceneProcessing,
    private readonly source: SourceEvidenceStore,
    private readonly scenes: SceneEvidenceStore,
  ) {
    super();
  }
  protected resolve(input: { recordingId: string; revisionId?: string | undefined }) {
    const recording = this.store.get(input.recordingId),
      revision = this.store.revision(input.recordingId, input.revisionId);
    const source = this.sourceProcessing.status(input.recordingId),
      scenes = this.sceneProcessing.status(input.recordingId);
    for (const [artifact, status] of [
      ["source", source],
      ["scenes", scenes],
    ] as const) {
      if (!status.published)
        throw new CatalogError(
          status.state === "unavailable"
            ? "UNAVAILABLE"
            : status.state === "failed"
              ? "PROCESSING_FAILED"
              : "NOT_READY",
          `Timeline ${artifact} evidence is not ready`,
          { artifact, state: status.state, jobId: status.jobId },
          status.retryable,
        );
    }
    return {
      target: { recordingId: input.recordingId },
      events: {
        source: this.source,
        sourceIdentity: source.published!.evidence,
        scenes: this.scenes,
        sceneIdentity: scenes.published!.evidence,
        revision,
        interrupted: recording.state === "interrupted",
      },
    };
  }
}

/** PackageInspection supplies its existing private authority; no second handle registry is introduced. */
export class PackageTimelineInspection extends TimelineInspection<PackageTarget> {
  private sceneRead:
    | { context: object; identity: SceneEvidenceIdentity; reader: FileSceneEvidence }
    | undefined;
  constructor(
    private readonly media: PackageMediaContext,
    private readonly context: () => ReturnType<PackageRegistry["lookup"]>,
  ) {
    super();
  }
  protected resolve(input: PackageTarget & { revisionId?: string | undefined }) {
    const resolved = this.media.resolve(input),
      context = this.context(),
      source = this.media.sourceData();
    if (this.sceneRead?.context !== context) {
      const artifact = context.manifest.evidence.find(
        (entry) => entry.artifact.reference.kind === "scenes",
      )!;
      const manifests = artifact.files.filter((path) => path.endsWith("/pages.json"));
      if (manifests.length !== 1 || typeof artifact.artifact.generation !== "string")
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Timeline requires one pinned scene page manifest",
        );
      const identity = {
        recordingId: resolved.recordingId,
        sourceId: resolved.sourceId,
        generation: artifact.artifact.generation,
        policy: artifact.artifact.policy,
      };
      this.sceneRead = {
        context,
        identity,
        reader: new FileSceneEvidence(
          fileSubdirectory(context.files, dirname(manifests[0]!)),
          identity,
        ),
      };
    }
    return {
      target: resolved.target,
      events: {
        source: source.reader,
        sourceIdentity: source.metadata,
        scenes: this.sceneRead.reader,
        sceneIdentity: this.sceneRead.identity,
        revision: resolved.revision,
        interrupted: context.manifest.snapshot.capture.state === "interrupted",
      },
    };
  }
}
