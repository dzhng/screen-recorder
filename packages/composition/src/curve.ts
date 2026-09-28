import { z } from "zod";
import { CompositionError } from "./errors.js";
import {
  resolvePlacement,
  sourceTime,
  type ValidatedComposition,
  type ExactRange,
} from "./model.js";
import { compare, divide, fromTime, subtract, type Rational } from "./rational.js";
import {
  anchorSchema,
  fractionSchema,
  selectionRangeSchema,
  timeValueSchema,
  type Anchor,
  type TimeValue,
} from "./schema.js";

const finite = z.number().finite();
const handle = finite.min(0).max(1);
const interpolation = z.union([
  z.enum(["hold", "linear"]),
  z.object({ cubic: z.tuple([handle, finite, handle, finite]) }).strict(),
]);
/** Authoring key times use exactly the anchor's domain; evaluation may be fractional. */
export function scalarCurveSchema(domain: Anchor["kind"]) {
  const at =
    domain === "clip"
      ? fractionSchema.refine(
          (value) => value.numerator <= value.denominator,
          "Expected clip fraction within [0,1]",
        )
      : z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const keys = z.array(z.object({ at, value: finite, interpolation }).strict()).min(1);
  return z
    .object({ keys })
    .strict()
    .refine(
      (value) =>
        value.keys.every(
          (key, index) =>
            index === 0 || compare(fromTime(value.keys[index - 1]!.at), fromTime(key.at)) < 0,
        ),
      {
        message: "Expected strictly ordered curve keys",
        when: ({ value }) => z.object({ keys }).safeParse(value).success,
      },
    );
}
export type ScalarCurve = z.infer<ReturnType<typeof scalarCurveSchema>>;

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
  sample(atUs: TimeValue): number | null;
  restrict(range: unknown): CompiledScalarCurve;
}>;

/** Compile an anchored parameter while retaining its clock across restricted windows. */
export function compileScalarCurve(
  model: ValidatedComposition,
  input: unknown,
  anchorInput: unknown,
): CompiledScalarCurve {
  const anchor = anchorSchema.parse(anchorInput);
  const curve = scalarCurveSchema(anchor.kind).parse(input);
  const placement = resolvePlacement(model, anchor);
  const parent =
    anchor.kind === "project"
      ? undefined
      : model.clips.find((value) => value.clip.id === anchor.clipId)!;
  const keys = curve.keys.map((key) => ({ ...key, at: fromTime(key.at) }));
  const atDomain = (at: Rational) =>
    anchor.kind === "project"
      ? at
      : anchor.kind === "content"
        ? sourceTime(parent!, at)
        : divide(
            subtract(at, parent!.range.start),
            subtract(parent!.range.end, parent!.range.start),
          );
  function window(available: readonly ExactRange[]): CompiledScalarCurve {
    return Object.freeze({
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
  return window(placement.available);
}
