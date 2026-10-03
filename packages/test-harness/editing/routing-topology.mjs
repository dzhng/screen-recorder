import assert from "node:assert/strict";

/** Shared deep/wide routing fixture, including ordered reciprocal gain stacks. */
export function routingTopology(depth, width) {
  const topology = [];
  for (let i = 0; i < depth; i++)
    topology.push({
      operation: "group.add",
      label: `g${i}`,
      group: { kind: "audio", order: 0, ...(i ? { parentId: { label: `g${i - 1}` } } : {}) },
    });
  for (let i = 0; i < width; i++)
    topology.push(
      {
        operation: "group.add",
        label: `leaf${i}`,
        group: { kind: "audio", order: i, parentId: { label: `g${depth - 1}` } },
      },
      {
        operation: "track.add",
        label: `t${i}`,
        track: { kind: "audio", order: 0, parentId: { label: `leaf${i}` } },
      },
      {
        operation: "processing.set",
        target: { kind: "track", id: { label: `t${i}` } },
        steps: [{ processor: { type: "gain", gain: 1 / width } }],
      },
    );
  for (let i = 0; i < depth; i++)
    topology.push({
      operation: "processing.set",
      target: { kind: "group", id: { label: `g${i}` } },
      steps: Array.from({ length: i === 0 ? 128 : 2 }, (_, j) => ({
        processor: { type: "gain", gain: j % 2 ? 2 : 0.5 },
      })),
    });
  return topology;
}

/** Authored long-project layout: sequential clips, then one overlapping clip per lane. */
export function longRoutingPlacements(seconds, occurrences, width) {
  const durationUs = seconds * 1e6, sequential = occurrences - width, tailUs = durationUs - 1e6;
  assert(seconds > 1 && sequential > 0);
  return Array.from({ length: occurrences }, (_, i) => ({
    lane: i < sequential ? i % width : i - sequential,
    startUs: i < sequential ? Math.floor(i * tailUs / sequential) : tailUs,
    endUs: i < sequential ? Math.floor((i + 1) * tailUs / sequential) : durationUs,
  }));
}
