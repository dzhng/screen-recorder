import { expect, test } from "vitest";
import { intervalIndex } from "./interval-index.js";
import { rational as r } from "./rational.js";

test("left-supported boundary lookup preserves exact membership and skips unrelated prefixes", () => {
  let reads = 0;
  const ranges = Array.from({ length: 16384 }, (_, n) => ({
    start: r(BigInt(n * 3)),
    end: r(BigInt(n * 3 + 2)),
  }));
  const index = intervalIndex(ranges, (value) => {
    reads++;
    return value;
  });
  reads = 0;
  const last = ranges.at(-1)!;
  expect(index.before(last.end)).toEqual([last]);
  expect(index(last.end)).toEqual([]);
  expect(index.before(last.start)).toEqual([]);
  expect(index(last.start)).toEqual([last]);
  expect(reads).toBeLessThan(250);
  const exact = intervalIndex([{ start: r(1n, 3n), end: r(2n, 3n) }], (v) => v);
  expect(exact.before(r(2n, 3n))).toHaveLength(1);
  expect(exact.before(r(1n, 3n))).toHaveLength(0);
  expect(exact.before(r(1n, 2n))).toHaveLength(1);
});
