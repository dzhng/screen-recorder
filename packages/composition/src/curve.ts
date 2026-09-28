import { CompositionError } from "./errors.js";
import {
  resolvePlacement,
  sourceTime,
  projectTime,
  type ValidatedComposition,
  type ExactRange,
} from "./model.js";
import {
  compare,
  divide,
  fromTime,
  subtract,
  add,
  multiply,
  toFraction,
  type Rational,
} from "./rational.js";
import {
  anchorSchema,
  selectionRangeSchema,
  timeValueSchema,
  type TimeValue,
  scalarCurveSchema,
  type ScalarCurve,
  type ProcessingStep,
} from "./schema.js";

/** Extrema in value space do not depend on the monotone time handles. */
export function curveValuesWithin(curve: ScalarCurve, min: number, max: number): boolean {
  if (curve.keys.some((key) => key.value < min || key.value > max)) return false;
  for (let i = 0; i + 1 < curve.keys.length; i++) {
    const left = curve.keys[i]!,
      right = curve.keys[i + 1]!;
    if (typeof left.interpolation === "string") continue;
    const delta = right.value - left.value;
    const p = [
      left.value,
      left.value + delta * left.interpolation.cubic[1],
      left.value + delta * left.interpolation.cubic[3],
      right.value,
    ];
    if (p.some((value) => !Number.isFinite(value))) return false;
    const scale = Math.max(1, ...p.map(Math.abs));
    const [p0, p1, p2, p3] = p.map((value) => value / scale) as [number, number, number, number];
    const a = -p0 + 3 * p1 - 3 * p2 + p3,
      b = 2 * (p0 - 2 * p1 + p2),
      c = p1 - p0;
    const disc = b * b - 4 * a * c;
    const roots =
      a === 0
        ? b === 0
          ? []
          : [-c / b]
        : disc < 0
          ? []
          : [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)];
    for (const t of roots)
      if (t > 0 && t < 1) {
        const q = 1 - t;
        const value =
          q * q * q * p[0]! + 3 * q * q * t * p[1]! + 3 * q * t * t * p[2]! + t * t * t * p[3]!;
        if (!Number.isFinite(value) || value < min || value > max) return false;
      }
  }
  return true;
}

function ease(value: number, method: ScalarCurve["keys"][number]["interpolation"]): number {
  if (method === "hold") return 0;
  if (method === "linear") return value;
  const [x1, y1, x2, y2] = method.cubic;
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  // Monotone x handles make bisection bounded even where the derivative vanishes.
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const x = cubic(mid, x1, x2);
    if (x === value) return cubic(mid, y1, y2);
    if (x < value) lo = mid;
    else hi = mid;
  }
  return cubic((lo + hi) / 2, y1, y2);
}

export type CompiledScalarCurve = Readonly<{
  /** Active project fragments; unavailable-source gaps remain excluded. */
  available: readonly ExactRange[];
  boundaries: readonly Rational[];
  sample(atUs: TimeValue): number | null;
  restrict(range: unknown): CompiledScalarCurve;
}>;

/** Compile an anchored parameter while retaining its clock across restricted windows. */
export function compileScalarCurve(
  model: ValidatedComposition,
  input: unknown,
  anchorInput: unknown,
  evaluationRange?: ProcessingStep["evaluationRange"],
): CompiledScalarCurve {
  const anchor = anchorSchema.parse(anchorInput);
  const curve = scalarCurveSchema(anchor.kind).parse(input);
  let effective = anchor;
  let empty = false;
  if (evaluationRange && anchor.kind === "clip") {
    const start =
      compare(fromTime(anchor.start), fromTime(evaluationRange.start)) > 0
        ? anchor.start
        : evaluationRange.start;
    const end =
      compare(fromTime(anchor.end), fromTime(evaluationRange.end)) < 0
        ? anchor.end
        : evaluationRange.end;
    empty = compare(fromTime(start), fromTime(end)) >= 0;
    if (!empty) {
      const span = subtract(fromTime(evaluationRange.end), fromTime(evaluationRange.start));
      effective = {
        ...anchor,
        start: toFraction(divide(subtract(fromTime(start), fromTime(evaluationRange.start)), span)),
        end: toFraction(divide(subtract(fromTime(end), fromTime(evaluationRange.start)), span)),
      };
    }
  }
  const placement = resolvePlacement(
    model,
    empty && anchor.kind === "clip" ? anchor.clipId : effective,
  );
  const parent =
    anchor.kind === "project"
      ? undefined
      : model.clips.find((value) => value.clip.id === anchor.clipId)!;
  const keys = curve.keys.map((key) => ({ ...key, at: fromTime(key.at) }));
  const clipDomain = (at: Rational) =>
    divide(subtract(at, parent!.range.start), subtract(parent!.range.end, parent!.range.start));
  const atDomain = (at: Rational) => {
    if (anchor.kind === "project") return at;
    if (anchor.kind === "content") return sourceTime(parent!, at);
    const fraction = clipDomain(at);
    return evaluationRange
      ? add(
          fromTime(evaluationRange.start),
          multiply(
            fraction,
            subtract(fromTime(evaluationRange.end), fromTime(evaluationRange.start)),
          ),
        )
      : fraction;
  };
  const atProject = (at: Rational) => {
    if (anchor.kind === "project") return at;
    if (anchor.kind === "content") return projectTime(parent!, at);
    const fraction = evaluationRange
      ? divide(
          subtract(at, fromTime(evaluationRange.start)),
          subtract(fromTime(evaluationRange.end), fromTime(evaluationRange.start)),
        )
      : at;
    return add(
      parent!.range.start,
      multiply(fraction, subtract(parent!.range.end, parent!.range.start)),
    );
  };
  function window(available: readonly ExactRange[]): CompiledScalarCurve {
    const points = [
      ...available.flatMap((range) => [range.start, range.end]),
      ...keys
        .map((key) => atProject(key.at))
        .filter((at) =>
          available.some((range) => compare(at, range.start) >= 0 && compare(at, range.end) <= 0),
        ),
    ].sort(compare);
    return Object.freeze({
      boundaries: Object.freeze(
        points.filter((at, index) => index === 0 || compare(at, points[index - 1]!) !== 0),
      ),
      available: Object.freeze(available.map((range) => Object.freeze({ ...range }))),
      sample(atUs: TimeValue) {
        const at = fromTime(timeValueSchema.parse(atUs));
        if (!available.some((range) => compare(at, range.start) >= 0 && compare(at, range.end) < 0))
          return null;
        const time = atDomain(at);
        let lo = 0,
          hi = keys.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (compare(keys[mid]!.at, time) <= 0) lo = mid + 1;
          else hi = mid;
        }
        if (lo === 0) return keys[0]!.value;
        const left = keys[lo - 1]!;
        if (lo === keys.length || compare(left.at, time) === 0) return left.value;
        const right = keys[lo]!;
        const ratio = divide(subtract(time, left.at), subtract(right.at, left.at));
        const progress = Number(ratio.numerator) / Number(ratio.denominator);
        const amount = ease(progress, left.interpolation);
        const result = (1 - amount) * left.value + amount * right.value;
        if (!Number.isFinite(result))
          throw new CompositionError(
            "INVALID_COMPOSITION",
            "Curve evaluation exceeds finite scalar precision",
          );
        return result;
      },
      restrict(input: unknown) {
        const range = selectionRangeSchema.parse(input);
        const start = fromTime(range.startUs),
          end = fromTime(range.endUs);
        return window(
          available.flatMap((part) => {
            const a = compare(part.start, start) > 0 ? part.start : start;
            const b = compare(part.end, end) < 0 ? part.end : end;
            return compare(a, b) < 0 ? [{ start: a, end: b }] : [];
          }),
        );
      },
    });
  }
  return window(empty ? [] : placement.available);
}
