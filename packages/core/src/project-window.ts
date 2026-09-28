import {
  createCompiler,
  isMediaClip,
  processingCapabilities,
  rangeSchema,
  requireWindowReady,
  validateComposition,
  type ProcessingTap,
  type ProcessorImplementations,
} from "@screenrec/composition";
import { AssetStore, compositionAsset } from "./assets.js";
import { ProjectStore } from "./projects.js";
import { CatalogError } from "./catalog.js";
import type { PointerPreparation } from "./pointer-preparation.js";
import { compositionPointerSources } from "./composition-pointer.js";
export type ProjectRenderSupport = { implementationId: string; pointers?: PointerPreparation };

export type CompositionWindow = ReturnType<ReturnType<typeof createCompiler>["window"]>;
export type CompositionAssetBinding = {
  assetId: string;
  streamId: string;
  path: string;
  originUs: number;
};

const implementations = (support: ProjectRenderSupport): ProcessorImplementations => ({
  geometry: support.implementationId,
  opacity: support.implementationId,
  gain: support.implementationId,
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
  const ids = [...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId))];
  const metadata = new Map(ids.map((id) => [id, assets.get(id)]));
  const model = validateComposition(
    revision.document,
    [...metadata.values()].map(compositionAsset),
    projects.contexts(revision.document),
  );
  const compiler = createCompiler(model, revision.id);
  return {
    projectId: input.projectId,
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
      requireWindowReady(bound.manifest);
      const bindings = new Map<string, CompositionAssetBinding>();
      for (const source of bound.manifest.sources) {
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
