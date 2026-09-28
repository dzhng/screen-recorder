import { compileScalarCurve, type CompiledScalarCurve } from "./curve.js";
import { compare, fromTime, toTime, type Rational } from "./rational.js";
import type { ValidatedComposition } from "./model.js";
import type { ProcessingInstruction } from "./processing-plan.js";
import type { Anchor, ProcessingStep, ProcessingTarget } from "./schema.js";

/** Timing is compiled once per step; picture workers receive only resolved opacity. */
export function temporalProcessing(model: ValidatedComposition) {
  const clips = new Map(model.clips.map((value) => [value.clip.id, value]));
  const programs = new Map<string, CompiledScalarCurve | null>();
  function program(step: ProcessingStep, target: ProcessingTarget) {
    if (programs.has(step.id)) return programs.get(step.id)!;
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
    const value = step.processor.type === "opacity" ? step.processor.opacity : 1;
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
    programs.set(step.id, compiled);
    return compiled;
  }
  return {
    opacity(step: ProcessingStep, target: ProcessingTarget, at: number) {
      if (step.processor.type !== "opacity") return null;
      if (typeof step.processor.opacity === "number" && !step.window) return step.processor.opacity;
      return program(step, target)?.sample(at) ?? null;
    },
    boundaries(plan: readonly ProcessingInstruction[]): Rational[] {
      const points = plan
        .flatMap((node) =>
          node.steps.flatMap((step) =>
            step.enabled &&
            step.processor.type === "opacity" &&
            (step.window || typeof step.processor.opacity !== "number")
              ? (program(step, node.target)?.boundaries ?? [])
              : [],
          ),
        )
        .sort(compare);
      return points.filter((at, index) => index === 0 || compare(at, points[index - 1]!) !== 0);
    },
  };
}
