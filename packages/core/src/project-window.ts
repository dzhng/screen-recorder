import {
  createCompiler,
  documentAssetIds,
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
export type ProjectRenderSupport = { implementationId: string; pointers?: PointerPreparation };

export type CompositionWindow = ReturnType<ReturnType<typeof createCompiler>["window"]>;
export type FontAssetBinding = { assetId: string; path: string };
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
      if (admission === "produced") requireWindowReady(bound.manifest);
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
