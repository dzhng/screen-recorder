import type { ExactRange } from "./model.js";
import { compare, type Rational } from "./rational.js";

/** Balanced interval index over the detached immutable revision; queries skip unrelated prefixes. */
export function intervalIndex<T>(
  clips: readonly T[],
  range: (item: T) => ExactRange,
  order?: (a: T, b: T) => number,
) {
  type Node = { clip: T; end: Rational; left?: Node; right?: Node };
  const sorted = [...clips].sort((a, b) => compare(range(a).start, range(b).start));
  function build(start: number, end: number): Node | undefined {
    if (start === end) return undefined;
    const middle = Math.floor((start + end) / 2);
    const left = build(start, middle),
      right = build(middle + 1, end);
    const clip = sorted[middle]!;
    let max = range(clip).end;
    for (const child of [left, right]) if (child && compare(child.end, max) > 0) max = child.end;
    return {
      clip,
      end: max,
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
    };
  }
  const root = build(0, sorted.length);
  return function query(start: Rational, end?: Rational): T[] {
    const result: T[] = [];
    const pending = root ? [root] : [];
    while (pending.length) {
      const node = pending.pop()!;
      if (compare(node.end, start) <= 0) continue;
      if (node.left) pending.push(node.left);
      const beforeEnd = end
        ? compare(range(node.clip).start, end) < 0
        : compare(range(node.clip).start, start) <= 0;
      if (!beforeEnd) continue;
      if (compare(range(node.clip).end, start) > 0) result.push(node.clip);
      if (node.right) pending.push(node.right);
    }
    return order ? result.sort(order) : result;
  };
}
