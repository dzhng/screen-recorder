import { CompositionError } from "./errors.js";
import type { Rational } from "./rational.js";

/** Project time owns output placement, including the retained resampling origin. */
export function sampleAt(at: Rational, sampleRate: number): number {
  const value = (at.numerator * BigInt(sampleRate)) / (at.denominator * 1000000n);
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CompositionError("INVALID_TIME", "Compiled clock exceeds safe-integer precision");
  return Number(value);
}
