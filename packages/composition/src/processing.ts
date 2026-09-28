import { z } from "zod";
import { CompositionError } from "./errors.js";
import { processorRegistry, processingTargetSchema, type ProcessingTarget } from "./schema.js";
import type { ValidatedComposition } from "./model.js";
type Document = ValidatedComposition["document"];
export const processingKey = (target: ProcessingTarget) =>
  JSON.stringify(target.kind === "output" ? ["output"] : [target.kind, target.id]);
function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new CompositionError("INVALID_COMPOSITION", message, details);
}
function targetKinds(document: Document) {
  const tracks = new Map(document.tracks.map((track) => [track.id, track.kind]));
  const kinds = new Map<string, "audio" | "video" | "output">([
    [processingKey({ kind: "output" }), "output"],
  ]);
  for (const clip of document.clips)
    kinds.set(processingKey({ kind: "clip", id: clip.id }), tracks.get(clip.trackId)!);
  for (const track of document.tracks)
    kinds.set(processingKey({ kind: "track", id: track.id }), track.kind);
  for (const group of document.groups)
    kinds.set(processingKey({ kind: "group", id: group.id }), group.kind);
  return kinds;
}
function targetKind(kinds: ReturnType<typeof targetKinds>, target: ProcessingTarget) {
  const kind = kinds.get(processingKey(target));
  if (kind === undefined) invalid("Unknown processing target", { target });
  return kind;
}
export function validateProcessing(document: Document) {
  const kinds = targetKinds(document);
  const clips = new Map(document.clips.map((clip) => [clip.id, clip]));
  const targets = new Set<string>();
  const stepIds = new Set<string>();
  for (const { target, steps } of document.processing) {
    const key = processingKey(target);
    if (targets.has(key)) invalid("Duplicate processing target", { target });
    targets.add(key);
    const kind = targetKind(kinds, target);
    for (const step of steps) {
      if (stepIds.has(step.id)) invalid("Duplicate processing step ID", { stepId: step.id });
      stepIds.add(step.id);
      const definition = processorRegistry[step.processor.type];
      if (!definition.targets.some((scope) => scope === target.kind))
        invalid("Processor is incompatible with target scope", { target, stepId: step.id });
      if (
        "requiresAcquisition" in definition &&
        definition.requiresAcquisition &&
        target.kind === "clip"
      ) {
        const clip = clips.get(target.id)!;
        if (!("acquisitionId" in clip) || !clip.acquisitionId)
          invalid("Pointer requires an explicit clip acquisition", { target, stepId: step.id });
      }
      if (kind !== "output" && kind !== definition.mediaKind)
        invalid("Processor is incompatible with target media", { target, stepId: step.id });
    }
  }
}
export function getProcessing(model: ValidatedComposition, targetInput: unknown) {
  const parsed = processingTargetSchema.safeParse(targetInput);
  if (!parsed.success) invalid(parsed.error.message);
  targetKind(targetKinds(model.document), parsed.data);
  const key = processingKey(parsed.data);
  return (
    model.document.processing.find((stack) => processingKey(stack.target) === key)?.steps ?? []
  );
}
export type ProcessorImplementations = Readonly<
  Partial<Record<keyof typeof processorRegistry, string>>
>;
export function processingCapabilities(implementations: ProcessorImplementations = {}) {
  return Object.entries(processorRegistry).map(([type, { schema, ...capability }]) => ({
    type,
    ...capability,
    execution: Boolean(implementations[type as keyof typeof processorRegistry]),
    implementationId: implementations[type as keyof typeof processorRegistry] ?? null,
    parameters: z.toJSONSchema(schema),
  }));
}

/** Copies target-owned configuration while source-attached media has its own lifetime. */
export function remapClipProcessing(
  document: Document,
  clips: Document["clips"],
  lineage: readonly { originalId: string; clipIds: readonly string[] }[],
  allocate: (kind: "processingStep", copiedFrom?: string) => string,
): Document["processing"] {
  const live = new Set(clips.map((clip) => clip.id));
  const descendants = new Map(lineage.map((entry) => [entry.originalId, entry.clipIds]));
  return document.processing.flatMap((stack) => {
    if (stack.target.kind !== "clip") return [stack];
    const originalId = stack.target.id;
    const retained = live.has(originalId) ? [stack] : [];
    for (const id of descendants.get(originalId) ?? []) {
      if (id === originalId) continue;
      retained.push({
        target: { kind: "clip", id },
        steps: stack.steps.map((step) => ({
          ...step,
          id: allocate("processingStep", step.id),
        })),
      });
    }
    return retained;
  });
}
