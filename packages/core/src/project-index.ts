import { isDeepStrictEqual } from "node:util";
import { isMediaClip } from "@screenrec/composition";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import type { ProjectStore } from "./projects.js";
import { CatalogError } from "./catalog.js";
import { projectComposition } from "./project-window.js";
import {
  projectPictureOptionsSchema,
  validateRetainedProjectFrameReceipt,
  type ProjectFrameArtifact,
  type ProjectFrameInput,
} from "./frame-inspection.js";
import {
  sourceSceneDescriptor,
  type SceneEvidenceMetadata,
  type SceneEvidenceStore,
} from "./scene-evidence.js";
import { selectSource, sourceSelectionKey, type SourceSelection } from "./source-selection.js";
import { projectIndexPolicy, type ProjectIndexCandidate } from "./project-index-selection.js";
import type { IndexDomain } from "./screenshot-index.js";
import type { TimeRange } from "./timeline.js";

export type ProjectIndexIdentity = Pick<
  ProjectFrameArtifact,
  "projectId" | "revisionId" | "tap" | "implementationId" | "maxLongEdge"
> & { generation: string; selectionPolicy: string; scenes: SceneEvidenceMetadata[] };
export type ProjectIndexCoverage = { project: TimeRange } & (
  | { ordinal: number; equality: "sampled" }
  | { ordinal: null; equality: "unproven" }
);
export type ProjectIndexRecords = {
  identity: ProjectIndexIdentity;
  candidate: ProjectIndexCandidate;
  frame: Omit<ProjectFrameArtifact, "cacheId">;
  coverage: ProjectIndexCoverage;
};

/** Empty targets validate their real processing scope without a synthetic render window. */
export function projectIndexPlan(
  composition: ReturnType<typeof projectComposition>,
  input: Pick<ProjectFrameInput, "tap" | "maxLongEdge">,
  implementationId: string,
) {
  const parsed = projectPictureOptionsSchema.safeParse({
    tap: input.tap ?? { target: { kind: "output" }, point: { kind: "processed" } },
    maxLongEdge: input.maxLongEdge ?? 1600,
    implementationId,
  });
  if (!parsed.success) throw new CatalogError("INVALID_PARAMS", "Invalid project picture options");
  const { model, compiler } = composition;
  const processing = model.durationUs
    ? composition.window({ tap: parsed.data.tap }, implementationId, "video").window.manifest
        .processing
    : compiler.tapPlan(parsed.data.tap, "video");
  const selected = new Set(
    processing.flatMap((node) => (node.target.kind === "clip" ? [node.target.id] : [])),
  );
  const bindings = new Map<string, SourceSelection>();
  for (const value of model.clips) {
    const clip = value.clip;
    if (
      !selected.has(clip.id) ||
      !isMediaClip(clip) ||
      clip.source.kind !== "range" ||
      value.stream?.kind !== "video" ||
      !value.available.length
    )
      continue;
    const selection = {
      assetId: clip.assetId,
      streamId: clip.streamId,
      ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
    };
    bindings.set(sourceSelectionKey(selection), selection);
  }
  return {
    identity: {
      projectId: composition.projectId,
      revisionId: composition.revisionId,
      ...parsed.data,
      selectionPolicy: projectIndexPolicy.id,
    },
    model,
    compiler,
    processing,
    sources: [...bindings.values()],
  };
}
function invalid(message: string): never {
  throw new CatalogError("INVALID_EVIDENCE", message);
}

/** Retained pixels keep their admitted identities even after their source analysis is reclaimed. */
export function projectIndexDomain(
  projects: ProjectStore,
  assets: AssetStore,
  acquisitions: AcquisitionStore,
  scenes: SceneEvidenceStore,
  implementationId: string,
): IndexDomain<ProjectIndexRecords> {
  // One write context bounds residency and avoids rebuilding a full revision for every appended PNG.
  let active:
    | {
        key: string;
        composition: ReturnType<typeof projectComposition>;
        plan: ReturnType<typeof projectIndexPlan>;
      }
    | undefined;
  function resolve(identity: ProjectIndexIdentity) {
    projects.get(identity.projectId);
    const key = JSON.stringify([
      identity.projectId,
      identity.revisionId,
      identity.tap,
      identity.maxLongEdge,
      identity.implementationId,
    ]);
    if (active?.key !== key) {
      const composition = projectComposition(projects, assets, identity);
      active = {
        key,
        composition,
        plan: projectIndexPlan(composition, identity, identity.implementationId),
      };
    }
    return active;
  }
  return {
    owner: (identity) => ({ kind: "project", projectId: identity.projectId }),
    pin: (identity) => ({
      projectId: identity.projectId,
      revisionId: identity.revisionId,
      generation: identity.generation,
      tap: identity.tap,
      implementationId: identity.implementationId,
      maxLongEdge: identity.maxLongEdge,
      selectionPolicy: identity.selectionPolicy,
      scenes: identity.scenes,
    }),
    begin(identity) {
      if (identity.implementationId !== implementationId)
        throw new CatalogError("NOT_READY", "Pinned picture renderer is unavailable", {}, true);
      if (!identity.generation || identity.selectionPolicy !== projectIndexPolicy.id)
        invalid("Project index selection identity is unavailable");
      const { plan } = resolve(identity);
      const bindings = new Map(
        plan.sources.map((selection) => [sourceSelectionKey(selection), selection]),
      );
      const seen = new Set<string>();
      for (const dependency of identity.scenes) {
        if (dependency.owner.kind !== "asset" || dependency.source.kind !== "asset")
          invalid("Project scenes require a selected video source");
        const selection = {
          assetId: dependency.owner.assetId,
          streamId: dependency.source.streamId,
          ...(dependency.source.acquisitionId === undefined
            ? {}
            : { acquisitionId: dependency.source.acquisitionId }),
        };
        const key = sourceSelectionKey(selection);
        if (seen.has(key) || !bindings.has(key))
          invalid("Project index scene dependency is duplicated or outside its tap");
        seen.add(key);
        const retained = scenes.sourcePage({ identity: dependency, limit: 1 }).metadata;
        if (
          !isDeepStrictEqual(retained, dependency) ||
          !isDeepStrictEqual(
            dependency.source,
            sourceSceneDescriptor(selectSource(assets, acquisitions, selection)),
          )
        )
          invalid("Project index scenes differ from their pinned source");
      }
      return plan.model.durationUs;
    },
    candidate(identity, candidate, frame, path, previous) {
      const { composition, plan } = resolve(identity);
      const expected = plan.compiler.frameBoundary(candidate.sampleAtUs).after;
      if (
        !expected ||
        !isDeepStrictEqual(expected, {
          index: candidate.index,
          sampleAtUs: candidate.sampleAtUs,
          visibleRange: candidate.visibleRange,
        }) ||
        (previous && previous.index >= candidate.index)
      )
        invalid("Project index candidates must be distinct globally phased pictures in order");
      if (
        frame.projectId !== identity.projectId ||
        frame.revisionId !== identity.revisionId ||
        frame.implementationId !== identity.implementationId ||
        frame.maxLongEdge !== identity.maxLongEdge ||
        !isDeepStrictEqual(frame.tap, identity.tap) ||
        frame.atUs !== candidate.sampleAtUs
      )
        invalid("Project index picture belongs to another request");
      validateRetainedProjectFrameReceipt(
        frame,
        composition.window(
          {
            range: { startUs: candidate.sampleAtUs, endUs: candidate.sampleAtUs + 1 },
            tap: identity.tap,
          },
          identity.implementationId,
          "video",
        ),
        path,
        identity.maxLongEdge,
      );
    },
    coverage(_identity, candidate, coverage) {
      if (coverage.equality === "sampled") {
        if (
          !candidate ||
          coverage.ordinal !== candidate.ordinal ||
          !isDeepStrictEqual(coverage.project, candidate.visibleRange)
        )
          invalid("Sampled project coverage requires the delivered picture's complete visibility");
      } else if (coverage.ordinal !== null || candidate)
        invalid("Unproven project coverage cannot name a sampled picture");
      return coverage.project;
    },
    merge(before, next) {
      return before.equality === "unproven" &&
        next.equality === "unproven" &&
        before.project.endUs === next.project.startUs
        ? { ...before, project: { startUs: before.project.startUs, endUs: next.project.endUs } }
        : null;
    },
    finishEntry(_identity, _candidate, coverageCount) {
      if (coverageCount !== 1)
        invalid("Each delivered project picture requires one complete sampled coverage interval");
    },
    finish(identity, candidateCount) {
      const { plan } = resolve(identity);
      if (plan.model.durationUs && !candidateCount)
        invalid("A nonempty project index requires a delivered picture");
      active = undefined;
    },
    isDeleting: (owner) => owner.kind === "project" && projects.isDeleting(owner.projectId),
  };
}
