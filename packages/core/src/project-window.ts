import {
  createCompiler,
  documentAssetIds,
  isMediaClip,
  processingCapabilities,
  rangeSchema,
  requireWindowReady,
  validateComposition,
  type ProcessingTap,
  type ProcessorImplementations,
} from "@screenrec/composition";
import { AssetStore, compositionAsset } from "./assets.js";
import { ProjectStore, type ProjectRevision } from "./projects.js";
import { CatalogError } from "./catalog.js";
import type { PointerPreparation } from "./pointer-preparation.js";
import { compositionPointerSources } from "./composition-pointer.js";
export type ProjectRenderSupport = {
  implementationId: string;
  rnnoise?: string;
  pointers?: PointerPreparation;
};

export type CompositionWindow = ReturnType<ReturnType<typeof createCompiler>["window"]>;
export type FontAssetBinding = { assetId: string; path: string };
export type CompositionAssetBinding = {
  assetId: string;
  streamId: string;
  path: string;
  originUs: number;
};

/** Every file consumed by the requested output or a selected DSP prerequisite. */
export function compositionMediaInputs(manifest: CompositionWindow["manifest"]) {
  const inputs = new Map(
    manifest.sources.map(({ clipId, assetId, streamId }) => [
      clipId,
      { clipId, assetId, streamId },
    ]),
  );
  for (const { clip } of manifest.state?.inputs ?? [])
    if (isMediaClip(clip))
      inputs.set(clip.id, { clipId: clip.id, assetId: clip.assetId, streamId: clip.streamId });
  return [...inputs.values()];
}
function requireStateInputsReady(manifest: CompositionWindow["manifest"]) {
  if (!manifest.state) return;
  const issues: Record<string, unknown>[] = [];
  for (const input of manifest.state.inputs) {
    if (input.unavailable.length)
      issues.push({
        kind: "unavailable-support",
        clipId: input.clip.id,
        ranges: input.unavailable,
      });
    if (isMediaClip(input.clip) && (input.channels !== 1 || input.sampleRate === undefined))
      issues.push({
        kind: "unverified-mono-input",
        clipId: input.clip.id,
        channels: input.channels ?? null,
        sampleRate: input.sampleRate ?? null,
      });
  }
  for (const node of manifest.state.nodes)
    for (const step of node.steps)
      if (step.enabled && step.processor.type !== "gain" && step.processor.type !== "rnnoise")
        issues.push({
          kind: "unverified-channel-prefix",
          target: node.target,
          stepId: step.id,
          processor: step.processor.type,
        });
  if (issues.length)
    throw new CatalogError(
      "NOT_READY",
      "State processing requires complete mono or structurally dual-mono input",
      { stateInputs: issues },
    );
}

const implementations = (support: ProjectRenderSupport): ProcessorImplementations => ({
  geometry: support.implementationId,
  opacity: support.implementationId,
  gain: support.implementationId,
  ...(support.rnnoise ? { rnnoise: support.rnnoise } : {}),
  ...(support.pointers ? { pointer: support.implementationId } : {}),
});
export const projectCapabilities = (support: ProjectRenderSupport) =>
  processingCapabilities(implementations(support));

/** One immutable revision context owns model validation, compiler timing and source bindings. */
export function projectComposition(
  projects: ProjectStore,
  assets: AssetStore,
  input: { projectId: string; revisionId?: string | undefined },
) {
  const revision = projects.revision(input.projectId, input.revisionId);
  return projectCompositionFromRevision(revision, assets, projects.contexts(revision.document));
}

/** Staged and catalog revisions share compilation; file publication is not a read prerequisite. */
export function projectCompositionFromRevision(
  revision: ProjectRevision,
  assets: Pick<AssetStore, "get" | "path">,
  contexts: Parameters<typeof validateComposition>[2],
) {
  const ids = documentAssetIds(revision.document);
  const metadata = new Map(ids.map((id) => [id, assets.get(id)]));
  const model = validateComposition(
    revision.document,
    [...metadata.values()].map(compositionAsset),
    contexts,
  );
  const compiler = createCompiler(model, revision.id);
  return {
    projectId: revision.projectId,
    revisionId: revision.id,
    model,
    compiler,
    window(
      input: {
        range?: { startUs: number; endUs: number } | undefined;
        tap?: ProcessingTap | undefined;
      },
      support: ProjectRenderSupport,
      component?: "audio" | "video",
      admission: "produced" | "retained" = "produced",
    ) {
      const parsed = rangeSchema.safeParse(input.range ?? { startUs: 0, endUs: model.durationUs });
      if (!parsed.success || parsed.data.endUs > model.durationUs)
        throw new CatalogError(
          "INVALID_PARAMS",
          "Rendering requires a nonempty range within the pinned project",
        );
      const window = (
        component === "audio"
          ? compiler.audioWindow
          : component === "video"
            ? compiler.videoWindow
            : compiler.window
      )({
        range: parsed.data,
        rendition: { sampleRate: 48000, channels: 2 },
        tap: input.tap ?? { target: { kind: "output" }, point: { kind: "processed" } },
      });
      const requirements = window.manifest.requirements.map((requirement) => ({
        ...requirement,
        implementationId:
          requirement.kind === "executor"
            ? support.implementationId
            : requirement.kind === "processor"
              ? (implementations(support)[requirement.processor.type] ?? null)
              : null,
      }));
      const bound = { ...window, manifest: { ...window.manifest, requirements } };
      if (admission === "produced") {
        requireStateInputsReady(bound.manifest);
        requireWindowReady(bound.manifest);
      }
      const bindings = new Map<string, CompositionAssetBinding>();
      for (const source of compositionMediaInputs(bound.manifest)) {
        const asset = metadata.get(source.assetId)!;
        bindings.set(JSON.stringify([asset.id, source.streamId]), {
          assetId: asset.id,
          streamId: source.streamId,
          path: assets.path(asset.id),
          originUs: asset.originUs,
        });
      }
      return {
        model,
        pointerSources: compositionPointerSources({
          model,
          compiler,
          processing: bound.manifest.processing,
          range: bound.manifest.range,
        }),
        window: bound,
        assets: [...bindings.values()],
        fonts: [...new Set(bound.manifest.fonts.map((font) => font.assetId))].map((assetId) => ({
          assetId,
          path: assets.path(assetId),
        })),
        durationUs: model.durationUs,
        frameBoundary: compiler.frameBoundary,
      };
    },
  };
}

/** Preview and media inspection resolve the same immutable dependencies and execution requirements. */
export function projectWindow(
  projects: ProjectStore,
  assets: AssetStore,
  input: {
    projectId: string;
    revisionId?: string | undefined;
    range?: { startUs: number; endUs: number } | undefined;
    tap?: ProcessingTap | undefined;
  },
  support: ProjectRenderSupport,
  component?: "audio" | "video",
) {
  return projectComposition(projects, assets, input).window(input, support, component);
}
