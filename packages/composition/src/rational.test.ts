import { expect, test } from "vitest";
import { fromTime, rational, round, subtract, toSignedTime, toTime } from "./rational.js";
import {
  signedTimeValueSchema,
  selectionRangeSchema,
  timeValueSchema,
  fractionSchema,
} from "./schema.js";

test("signed physical time survives exact arithmetic and canonical serialization", () => {
  const result = toSignedTime(subtract(fromTime(1), rational(4n, 3n)));
  expect(result).toEqual({ numerator: -1, denominator: 3 });
  expect(signedTimeValueSchema.parse(result)).toEqual(result);
});

test("wire values are canonical, safe and domain restricted", () => {
  for (const value of [
    0,
    1,
    -1,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    { numerator: 1, denominator: 3 },
    { numerator: -1, denominator: 3 },
  ]) {
    expect(toSignedTime(fromTime(signedTimeValueSchema.parse(value)))).toEqual(value);
  }
  for (const value of [
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
    { numerator: 2, denominator: 6 },
    { numerator: -2, denominator: 6 },
    { numerator: 0, denominator: 2 },
    { numerator: 1, denominator: 1 },
    { numerator: 1, denominator: 0 },
    { numerator: 1, denominator: -3 },
    { numerator: 1, denominator: Number.MAX_SAFE_INTEGER + 1 },
    { numerator: -1, denominator: 3, extra: 1 },
  ]) {
    expect(signedTimeValueSchema.safeParse(value).success).toBe(false);
  }
  for (const value of [-1, { numerator: -1, denominator: 3 }]) {
    expect(timeValueSchema.safeParse(value).success).toBe(false);
    expect(selectionRangeSchema.safeParse({ startUs: value, endUs: 1 }).success).toBe(false);
    expect(() => toTime(fromTime(value))).toThrow();
  }
  expect(fractionSchema.parse({ numerator: 0, denominator: 1 })).toEqual({
    numerator: 0,
    denominator: 1,
  });
  for (const value of [
    rational(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    rational(BigInt(Number.MIN_SAFE_INTEGER) - 1n),
    rational(1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n),
  ]) {
    expect(() => toSignedTime(value)).toThrow();
  }
});

test("observation labels round exact signed halves away from zero", () => {
  expect([-3n, -1n, 0n, 1n, 3n].map((n) => round(rational(n, 2n)))).toEqual([-2, -1, 0, 1, 2]);
  expect(round(rational(-1n, 3n))).toBe(0);
  expect(round(rational(1n, 3n))).toBe(0);
  expect(() => round(rational(BigInt(Number.MAX_SAFE_INTEGER) * 2n + 1n, 2n))).toThrow(/precision/);
});
