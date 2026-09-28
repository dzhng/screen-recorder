import { compileScalarCurve, type CompiledScalarCurve } from "./curve.js";
import { compare, fromTime, toTime, type Rational } from "./rational.js";
import { processingScalars } from "./processing.js";
import type { Geometry } from "./geometry.js";
import type { ValidatedComposition, ExactRange } from "./model.js";
import type { ProcessingInstruction } from "./processing-plan.js";
import type { Anchor, ProcessingStep, ProcessingTarget, ScalarCurve } from "./schema.js";

/** Timing is compiled once per step; picture workers receive only resolved scalar/matrix instructions. */
export function temporalProcessing(model: ValidatedComposition) {
  const clips = new Map(model.clips.map((value) => [value.clip.id, value]));
  const programs = new Map<string, Map<string, CompiledScalarCurve | null>>();
  const clocks = new Map<string, { range: ExactRange; anchor: Anchor; empty: boolean }>();
  function clock(step: ProcessingStep, target: ProcessingTarget) {
    const cached = clocks.get(step.id);
    if (cached) return cached;
    const clip = target.kind === "clip" ? clips.get(target.id)! : undefined;
    const range = clip?.range ?? { start: fromTime(0), end: fromTime(model.durationUs) };
    let anchor: Anchor =
      step.window ??
      (target.kind === "clip"
        ? {
            kind: "clip",
            clipId: target.id,
            start: { numerator: 0, denominator: 1 },
            end: { numerator: 1, denominator: 1 },
          }
        : { kind: "project", range: { startUs: 0, endUs: model.durationUs } });
    let empty = compare(range.start, range.end) >= 0;
    if (anchor.kind === "content" && clip?.clip.source.kind === "range") {
      const source = clip.clip.source.range;
      const startUs =
        compare(fromTime(anchor.sourceRange.startUs), fromTime(source.startUs)) > 0
          ? anchor.sourceRange.startUs
          : source.startUs;
      const endUs =
        compare(fromTime(anchor.sourceRange.endUs), fromTime(source.endUs)) < 0
          ? anchor.sourceRange.endUs
          : source.endUs;
      empty ||= compare(fromTime(startUs), fromTime(endUs)) >= 0;
      if (!empty) anchor = { ...anchor, sourceRange: { startUs, endUs } };
    }
    const result = { range, anchor, empty };
    clocks.set(step.id, result);
    return result;
  }
  function program(
    step: ProcessingStep,
    target: ProcessingTarget,
    slot: string,
    value: number | ScalarCurve,
  ) {
    let slots = programs.get(step.id);
    if (!slots) {
      slots = new Map();
      programs.set(step.id, slots);
    }
    if (slots.has(slot)) return slots.get(slot)!;
    const { range, anchor, empty } = clock(step, target);
    const curve =
      typeof value === "number"
        ? {
            keys: [
              {
                at: anchor.kind === "clip" ? { numerator: 0, denominator: 1 } : 0,
                value,
                interpolation: "hold" as const,
              },
            ],
          }
        : value;
    const compiled = empty
      ? null
      : compileScalarCurve(model, curve, anchor, step.evaluationRange).restrict({
          startUs: toTime(range.start),
          endUs: toTime(range.end),
        });
    slots.set(slot, compiled);
    return compiled;
  }
  function scalar(
    step: ProcessingStep,
    target: ProcessingTarget,
    slot: string,
    value: number | ScalarCurve,
    at: number,
  ) {
    return typeof value === "number" && !step.window
      ? value
      : (program(step, target, slot, value)?.sample(at) ?? null);
  }
  return {
    opacity(step: ProcessingStep, target: ProcessingTarget, at: number) {
      return step.processor.type === "opacity"
        ? scalar(step, target, "opacity", step.processor.opacity, at)
        : null;
    },
    geometry(step: ProcessingStep, target: ProcessingTarget, at: number): Geometry | null {
      if (step.processor.type !== "geometry") return null;
      const { scale, ...rest } = step.processor;
      if (!scale)
        return step.window && program(step, target, "window", 1)?.sample(at) == null ? null : rest;
      const x = scalar(step, target, "scale.x", scale.x, at),
        y = scalar(step, target, "scale.y", scale.y, at);
      return x === null || y === null ? null : { ...rest, scale: { x, y } };
    },
    boundaries(plan: readonly ProcessingInstruction[]): Rational[] {
      const points = plan
        .flatMap((node) =>
          node.steps.flatMap((step) => {
            if (!step.enabled) return [];
            const curves = Object.entries(processingScalars(step.processor)).filter(
              ([, value]) => typeof value !== "number",
            );
            if (curves.length)
              return curves.flatMap(
                ([slot, value]) => program(step, node.target, slot, value)?.boundaries ?? [],
              );
            return step.window ? (program(step, node.target, "window", 1)?.boundaries ?? []) : [];
          }),
        )
        .sort(compare);
      return points.filter((at, index) => index === 0 || compare(at, points[index - 1]!) !== 0);
    },
  };
}
