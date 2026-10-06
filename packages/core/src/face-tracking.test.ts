import { expect, test } from "vitest";
import { trackFaceObservations } from "./face-tracking.js";

const observation = (faces: Array<{ x: number; y: number; width: number; height: number }>) => ({
  recipe: "vision-face-rectangles-v1" as const,
  coordinateSpace: "delivered-top-left-pixels" as const,
  width: 100,
  height: 100,
  status: faces.length ? ("available" as const) : ("no_face" as const),
  faces: faces.map((boundingBox, index) => ({
    id: `face-${index}`,
    boundingBox,
    confidence: 0.9,
  })),
  ...(faces.length ? {} : { reason: "no_face" as const }),
});

test("face tracks preserve movement and explicit no-face gaps", () => {
  const tracks = trackFaceObservations([
    { atUs: 0, observations: observation([{ x: 10, y: 10, width: 20, height: 20 }]) },
    { atUs: 1000, observations: observation([]) },
    { atUs: 2000, observations: observation([{ x: 12, y: 10, width: 20, height: 20 }]) },
  ]);
  expect(tracks).toHaveLength(1);
  expect(tracks[0]!.samples.map((sample) => sample.status)).toEqual([
    "observed",
    "gap",
    "observed",
  ]);
});

test("ambiguous adjacent candidates are retained as ambiguity instead of silently selecting identity", () => {
  const tracks = trackFaceObservations([
    { atUs: 0, observations: observation([{ x: 10, y: 10, width: 20, height: 20 }]) },
    {
      atUs: 1000,
      observations: observation([
        { x: 10, y: 10, width: 20, height: 20 },
        { x: 10, y: 10, width: 20, height: 20 },
      ]),
    },
  ]);
  expect(tracks[0]!.ambiguous).toBe(true);
  expect(tracks).toHaveLength(2);
});
