import { curveValuesWithin } from "./curve.js";
import { compare, fromTime, add, subtract, multiply, divide, toFraction } from "./rational.js";
import { z } from "zod";
import { CompositionError } from "./errors.js";
import {
  processorRegistry,
  processingTargetSchema,
  scalarCurveSchema,
  type ProcessingTarget,
  type ProcessingStep,
  type ScalarCurve,
} from "./schema.js";
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
/** Closed scalar slots, shared by validation, edit preservation and temporal compilation. */
export function processingScalars(
  processor: ProcessingStep["processor"],
): Record<string, number | ScalarCurve> {
  if (processor.type === "rnnoise")
    return processor.mix === undefined ? {} : { mix: processor.mix };
  if (processor.type === "gain") return { gain: processor.gain };
  if (processor.type === "opacity") return { opacity: processor.opacity };
  if (processor.type === "geometry")
    return {
      ...(processor.scale ? { "scale.x": processor.scale.x, "scale.y": processor.scale.y } : {}),
      ...(processor.rect
        ? {
            "rect.x": processor.rect.x,
            "rect.y": processor.rect.y,
            "rect.width": processor.rect.width,
            "rect.height": processor.rect.height,
          }
        : {}),
      ...(processor.crop
        ? {
            "crop.x": processor.crop.x,
            "crop.y": processor.crop.y,
            "crop.width": processor.crop.width,
            "crop.height": processor.crop.height,
          }
        : {}),
      ...(processor.pivot ? { "pivot.x": processor.pivot.x, "pivot.y": processor.pivot.y } : {}),
      ...(processor.rotationDeg !== undefined ? { rotationDeg: processor.rotationDeg } : {}),
    };
  return {};
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
      if (
        step.stateKey !== undefined &&
        (step.processor.type !== "rnnoise" || target.kind !== "clip")
      )
        invalid("Shared state continuity requires a stateful clip processor", {
          target,
          stepId: step.id,
        });
      if (
        (step.window || step.evaluationRange) &&
        !["opacity", "geometry", "gain", "rnnoise"].includes(step.processor.type)
      )
        invalid("Temporal processing is not supported for this processor", {
          target,
          stepId: step.id,
        });
      if (step.window && step.window.kind !== "project") {
        if (target.kind !== "clip" || step.window.clipId !== target.id)
          invalid("Processing windows must use their own clip or project time", {
            target,
            stepId: step.id,
          });
        if (step.window.kind === "content" && clips.get(target.id)!.source.kind !== "range")
          invalid("Content processing window requires a selected source range", {
            target,
            stepId: step.id,
          });
      }
      const domain = step.window?.kind ?? (target.kind === "clip" ? "clip" : "project");
      if (step.evaluationRange && (target.kind !== "clip" || domain !== "clip"))
        invalid("Evaluation range requires normalized clip timing", { target, stepId: step.id });
      for (const [slot, value] of Object.entries(processingScalars(step.processor)))
        if (typeof value !== "number") {
          const parsed = scalarCurveSchema(domain).safeParse(value);
          const bounds =
            step.processor.type === "gain"
              ? [0, 3.4028234663852886e38]
              : step.processor.type === "opacity" ||
                  step.processor.type === "rnnoise" ||
                  slot === "pivot.x" ||
                  slot === "pivot.y"
                ? [0, 1]
                : ["rect.width", "rect.height", "crop.width", "crop.height"].includes(slot)
                  ? [Number.MIN_VALUE, Number.MAX_VALUE]
                  : [-Number.MAX_VALUE, Number.MAX_VALUE];
          if (!parsed.success || !curveValuesWithin(parsed.data, bounds[0]!, bounds[1]!))
            invalid("Processing curve must match its clock and remain within parameter bounds", {
              target,
              stepId: step.id,
            });
        }
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

/** Copies configuration and restricts its original normalized clock over retained pieces. */
export function remapClipProcessing(
  document: Document,
  clips: Document["clips"],
  lineage: readonly { originalId: string; clipIds: readonly string[] }[],
  allocate: (kind: "processingStep", copiedFrom?: string) => string,
  restrictions: ReadonlyMap<
    string,
    { original: import("./model.js").ExactRange; retained: import("./model.js").ExactRange }
  > = new Map(),
  continuity: "preserve" | "copy" = "preserve",
): Document["processing"] {
  const live = new Set(clips.map((clip) => clip.id));
  const tracks = new Map(clips.map((clip) => [clip.id, clip.trackId]));
  const descendants = new Map(lineage.map((entry) => [entry.originalId, entry.clipIds]));
  const copyGroups = new Map<string, ProcessingStep[]>();
  const result = document.processing.flatMap((stack) => {
    if (stack.target.kind !== "clip") return [stack];
    const originalId = stack.target.id;
    const ids = [
      ...new Set([
        ...(live.has(originalId) ? [originalId] : []),
        ...(descendants.get(originalId) ?? []),
      ]),
    ];
    const mapped = ids.map((id) => ({
      target: { kind: "clip" as const, id },
      steps: stack.steps.map((step) => {
        let evaluationRange = step.evaluationRange;
        const restricted = restrictions.get(id);
        const normalized = !step.window || step.window.kind === "clip";
        if (
          restricted &&
          (compare(restricted.original.start, restricted.retained.start) !== 0 ||
            compare(restricted.original.end, restricted.retained.end) !== 0) &&
          normalized &&
          (step.window ||
            Object.values(processingScalars(step.processor)).some(
              (value) => typeof value !== "number",
            ))
        ) {
          const prior = evaluationRange ?? {
            start: { numerator: 0, denominator: 1 },
            end: { numerator: 1, denominator: 1 },
          };
          const span = subtract(restricted.original.end, restricted.original.start);
          const length = subtract(fromTime(prior.end), fromTime(prior.start));
          const at = (time: typeof span) =>
            toFraction(
              add(
                fromTime(prior.start),
                multiply(divide(subtract(time, restricted.original.start), span), length),
              ),
            );
          evaluationRange = {
            start: at(restricted.retained.start),
            end: at(restricted.retained.end),
          };
        }
        return {
          ...step,
          id: id === originalId ? step.id : allocate("processingStep", step.id),
          ...(step.window && step.window.kind !== "project"
            ? { window: { ...step.window, clipId: id } }
            : {}),
          ...(evaluationRange ? { evaluationRange } : {}),
        };
      }),
    }));
    for (let index = 0; index < stack.steps.length; index++) {
      const original = stack.steps[index]!;
      if (original.processor.type !== "rnnoise") continue;
      const copies = mapped.filter((entry) => entry.target.id !== originalId);
      if (continuity === "copy") {
        for (const entry of copies) {
          const step = entry.steps[index]!;
          delete step.stateKey;
          if (original.stateKey !== undefined) {
            const track = tracks.get(entry.target.id)!;
            const key = JSON.stringify([original.stateKey, track]);
            const group = copyGroups.get(key) ?? [];
            group.push(step);
            copyGroups.set(key, group);
          }
        }
      } else if (copies.length && original.stateKey === undefined) {
        const key = copies[0]!.steps[index]!.id;
        for (const entry of mapped) entry.steps[index]!.stateKey = key;
      }
    }
    return mapped;
  });
  for (const copies of copyGroups.values())
    if (copies.length > 1) for (const step of copies) step.stateKey = copies[0]!.id;
  return result;
}
