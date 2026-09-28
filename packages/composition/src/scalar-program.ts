import { CompositionError } from "./errors.js";
import { add, compare, divide, multiply, rational, subtract, type Rational } from "./rational.js";
import type { ScalarCurve } from "./schema.js";

type Polynomial = readonly [number, number, number];
export type ScalarKernel =
  | { kind: "constant"; value: number }
  | { kind: "linear"; from: number; to: number }
  | {
      kind: "parametric";
      from: number;
      to: number;
      lower: number;
      upper: number;
      time: Polynomial;
      weight: Polynomial;
      weightOrigin: number;
      weightScale: number;
    };
export type ScalarPiece = Readonly<{
  start: Rational;
  end: Rational;
  origin: Rational;
  span: Rational;
  kernel: ScalarKernel;
}>;
export type ScalarProgram = Readonly<{
  first: Readonly<{ at: Rational; value: number }>;
  last: Readonly<{ at: Rational; value: number }>;
  pieces: readonly ScalarPiece[];
}>;

/** Round an exact ratio once, including subnormal values and large intermediate integers. */
export function scalarNumber(value: Rational): number {
  let n = value.numerator;
  if (n === 0n) return 0;
  const sign = n < 0n ? -1 : 1;
  if (n < 0n) n = -n;
  const d = value.denominator;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < d << BigInt(exponent) : n << BigInt(-exponent) < d) exponent--;
  const shift = Math.max(-1074, exponent - 52);
  const numerator = shift < 0 ? n << BigInt(-shift) : n;
  const denominator = shift > 0 ? d << BigInt(shift) : d;
  let q = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && q & 1n)) q++;
  return sign * Number(q) * 2 ** shift;
}

function exactNumber(value: number): Rational {
  if (value === 0) return rational(0n);
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  const bits = bytes.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n);
  const significand = (bits & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
  const power = (exponent || 1) - 1075;
  const sign = bits >> 63n ? -1n : 1n;
  return power < 0
    ? rational(sign * significand, 1n << BigInt(-power))
    : rational(sign * (significand << BigInt(power)));
}

const integer = (value: number) => rational(BigInt(value));
function polynomial(first: number, second: number, end = 1) {
  const a = exactNumber(first),
    b = exactNumber(second),
    z = exactNumber(end);
  return [
    add(subtract(z, multiply(integer(3), b)), multiply(integer(3), a)),
    subtract(multiply(integer(3), b), multiply(integer(6), a)),
    multiply(integer(3), a),
  ] as const;
}
function at(p: readonly Rational[], q: Rational): Rational {
  return multiply(add(multiply(add(multiply(p[0]!, q), p[1]!), q), p[2]!), q);
}
function shifted(p: readonly Rational[], origin: Rational): Polynomial {
  const a = p[0]!,
    b = add(p[1]!, multiply(integer(3), multiply(p[0]!, origin))),
    c = add(
      add(p[2]!, multiply(integer(2), multiply(p[1]!, origin))),
      multiply(integer(3), multiply(p[0]!, multiply(origin, origin))),
    );
  return [scalarNumber(a), scalarNumber(b), scalarNumber(c)];
}
const evaluatePolynomial = (p: Polynomial, q: number) => ((p[0] * q + p[1]) * q + p[2]) * q;

export function executeScalarKernel(kernel: ScalarKernel, phase: number): number {
  if (kernel.kind === "constant") return kernel.value;
  let weight = phase;
  if (kernel.kind === "parametric") {
    if (phase === 0 && kernel.lower === 0) return kernel.from;
    if (phase === 0 && kernel.upper === 0) return kernel.to;
    let lower = kernel.lower,
      upper = kernel.upper;
    // Binary64 has 1074 fractional exponent steps; adjacency ends ordinary cases sooner.
    for (let i = 0; i < 1076; i++) {
      const midpoint = (lower + upper) / 2;
      if (midpoint === lower || midpoint === upper) break;
      const value = evaluatePolynomial(kernel.time, midpoint);
      if (value === phase) {
        lower = midpoint;
        upper = midpoint;
        break;
      }
      if (value < phase) lower = midpoint;
      else upper = midpoint;
    }
    weight =
      (evaluatePolynomial(kernel.weight, (lower + upper) / 2) + kernel.weightOrigin) *
      kernel.weightScale;
  }
  const result = (1 - weight) * kernel.from + weight * kernel.to;
  if (!Number.isFinite(result))
    throw new CompositionError(
      "INVALID_COMPOSITION",
      "Curve evaluation exceeds finite scalar precision",
    );
  return result;
}

export function lowerScalarProgram(
  keys: readonly {
    at: Rational;
    value: number;
    interpolation: ScalarCurve["keys"][number]["interpolation"];
  }[],
): ScalarProgram {
  const pieces: ScalarPiece[] = [];
  for (let index = 0; index + 1 < keys.length; index++) {
    const left = keys[index]!,
      right = keys[index + 1]!;
    const span = subtract(right.at, left.at);
    const common = { start: left.at, end: right.at, origin: left.at, span };
    if (left.interpolation === "hold" || left.value === right.value) {
      pieces.push({ ...common, kernel: { kind: "constant", value: left.value } });
    } else if (left.interpolation === "linear") {
      pieces.push({ ...common, kernel: { kind: "linear", from: left.value, to: right.value } });
    } else {
      const [x1, y1, x2, y2] = left.interpolation.cubic;
      const time = polynomial(x1, x2);
      const scale = Math.max(1, Math.abs(y1), Math.abs(y2));
      const weight = polynomial(y1 / scale, y2 / scale, 1 / scale);
      for (const [lower, upper, center] of [
        [0, 0.25, 0],
        [0.25, 0.75, 0.5],
        [0.75, 1, 1],
      ] as const) {
        const origin = exactNumber(center);
        const project = (q: number) => add(left.at, multiply(span, at(time, exactNumber(q))));
        pieces.push({
          start: project(lower),
          end: project(upper),
          origin: project(center),
          span,
          kernel: {
            kind: "parametric",
            from: left.value,
            to: right.value,
            lower: lower - center,
            upper: upper - center,
            time: shifted(time, origin),
            weight: shifted(weight, origin),
            weightOrigin: scalarNumber(at(weight, origin)),
            weightScale: scale,
          },
        });
      }
    }
  }
  const first = keys[0]!,
    last = keys[keys.length - 1]!;
  return {
    first: { at: first.at, value: first.value },
    last: { at: last.at, value: last.value },
    pieces,
  };
}

export function sampleScalarProgram(program: ScalarProgram, time: Rational): number {
  if (compare(time, program.first.at) <= 0) return program.first.value;
  if (compare(time, program.last.at) >= 0) return program.last.value;
  let lower = 0,
    upper = program.pieces.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (compare(program.pieces[middle]!.end, time) <= 0) lower = middle + 1;
    else upper = middle;
  }
  const piece = program.pieces[lower]!;
  return executeScalarKernel(
    piece.kernel,
    scalarNumber(divide(subtract(time, piece.origin), piece.span)),
  );
}

export type SampleScalarPiece = Readonly<{
  start: number;
  end: number;
  origin: number;
  offset: number;
  slope: number;
  kernel: ScalarKernel;
}>;
export type SampleScalarProgram = Readonly<{ pieces: readonly SampleScalarPiece[] }>;

/** Specialize only the coordinate map; coefficient execution is shared with exact-time sampling. */
export function lowerSampleScalarProgram(
  program: ScalarProgram,
  sampleRate: number,
): SampleScalarProgram {
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0)
    throw new CompositionError("INVALID_TIME", "Expected a positive integer sample rate");
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  const interval = rational(1000000n, BigInt(sampleRate));
  const clamp = (value: bigint) => (value < 0n ? 0n : value > limit ? limit : value);
  const ceil = (value: Rational) =>
    clamp(
      value.numerator / value.denominator +
        (value.numerator > 0n && value.numerator % value.denominator ? 1n : 0n),
    );
  const sample = (time: Rational) => divide(time, interval);
  const pieces: SampleScalarPiece[] = [];
  function append(start: bigint, end: bigint, kernel: ScalarKernel, piece?: ScalarPiece) {
    if (start >= end) return;
    let origin = 0n,
      offset = 0,
      slope = 0;
    if (piece && kernel.kind !== "constant") {
      const exact = sample(piece.origin);
      let nearest = exact.numerator / exact.denominator;
      if (exact.numerator < 0n && exact.numerator % exact.denominator) nearest--;
      if ((exact.numerator - nearest * exact.denominator) * 2n >= exact.denominator) nearest++;
      origin = clamp(nearest);
      offset = scalarNumber(
        divide(subtract(multiply(rational(origin), interval), piece.origin), piece.span),
      );
      slope = scalarNumber(divide(interval, piece.span));
    }
    pieces.push({
      start: Number(start),
      end: Number(end),
      origin: Number(origin),
      offset,
      slope,
      kernel,
    });
  }
  append(0n, ceil(sample(program.first.at)), {
    kind: "constant",
    value: program.first.value,
  });
  for (const piece of program.pieces)
    append(ceil(sample(piece.start)), ceil(sample(piece.end)), piece.kernel, piece);
  const last = program.last;
  append(ceil(sample(last.at)), limit, { kind: "constant", value: last.value });
  return { pieces };
}

export function sampleScalarSamples(program: SampleScalarProgram, frame: number): number {
  let lower = 0,
    upper = program.pieces.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (program.pieces[middle]!.end <= frame) lower = middle + 1;
    else upper = middle;
  }
  const piece = program.pieces[lower]!;
  return executeScalarKernel(piece.kernel, piece.offset + (frame - piece.origin) * piece.slope);
}
