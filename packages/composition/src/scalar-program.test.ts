import { expect, test } from "vitest";
import { rational } from "./rational.js";
import { scalarNumber } from "./scalar-program.js";

test("numerical lowering rounds exact ratios once without overflowing their intermediate integers", () => {
  expect(scalarNumber(rational(1n << 2048n, 1n << 2049n))).toBe(0.5);
  expect(scalarNumber(rational(1n, 1n << 1074n))).toBe(Number.MIN_VALUE);
  expect(scalarNumber(rational(3n, 1n << 1075n))).toBe(Number.MIN_VALUE * 2);
  expect(scalarNumber(rational(1n, 1n << 1075n))).toBe(0);
  expect(scalarNumber(rational((1n << 53n) + 1n, 1n << 53n))).toBe(1);
  expect(scalarNumber(rational((1n << 53n) + 3n, 1n << 53n))).toBe(1 + Number.EPSILON * 2);
});
