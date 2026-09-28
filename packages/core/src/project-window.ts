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

export type CompositionWindow = ReturnType<ReturnType<typeof createCompiler>["window"]>;
export type CompositionAssetBinding = {
  assetId: string;
  streamId: string;
  path: string;
  originUs: number;
};

const implementations = (id: string): ProcessorImplementations => ({ gain: id });
export const projectCapabilities = (id: string) => processingCapabilities(implementations(id));

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
  implementationId: string,
  component?: "audio" | "video",
) {
  const revision = projects.revision(input.projectId, input.revisionId);
  const ids = [...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId))];
  const metadata = new Map(ids.map((id) => [id, assets.get(id)]));
  const model = validateComposition(
    revision.document,
    [...metadata.values()].map(compositionAsset),
    projects.contexts(revision.document),
  );
  const parsed = rangeSchema.safeParse(input.range ?? { startUs: 0, endUs: model.durationUs });
  if (!parsed.success || parsed.data.endUs > model.durationUs)
    throw new CatalogError(
      "INVALID_PARAMS",
      "Rendering requires a nonempty range within the pinned project",
    );
  const compiler = createCompiler(model, revision.id);
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
        ? implementationId
        : requirement.kind === "processor"
          ? (implementations(implementationId)[requirement.processor.type] ?? null)
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
  return { window: bound, assets: [...bindings.values()], durationUs: model.durationUs };
}
