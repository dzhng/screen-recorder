import assert from "node:assert/strict";
export const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !["id", "clipId", "trackId", "stepId"].includes(key))
            .map(([key, value]) => [key, canonical(value)]),
        )
      : value;

export function assertMatchedInputs(full, clipped) {
  for (const frame of clipped.frames) {
    const matching = full.frames.find((v) => v.sampleAtUs === frame.sampleAtUs);
    assert(matching);
    assert.deepEqual(canonical(frame.layers), canonical(matching.layers));
    assert.deepEqual(canonical(frame.visual), canonical(matching.visual));
  }
  const included = new Set(clipped.frames.map((frame) => frame.index));
  assert.deepEqual(
    canonical(clipped.pointers),
    canonical(full.pointers.filter((pointer) => included.has(pointer.frameIndex))),
    "Range pointer preparation differs from corresponding full frames",
  );
}
