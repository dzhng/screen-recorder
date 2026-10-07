import { expect, test } from "vitest";
import { operationSchema } from "./operations.js";

test("face trajectory read pins the retained generation and source selection", () => {
  const parsed = operationSchema.parse({
    operation: "face.trajectory.get",
    params: {
      assetId: "asset-a",
      streamId: "track:1",
      generation: "generation-a",
      prediction: "none",
      limit: 10,
    },
  });
  expect(parsed).toMatchObject({ operation: "face.trajectory.get", params: { generation: "generation-a" } });
});

test("face trajectory continuation cannot omit its generation", () => {
  expect(() =>
    operationSchema.parse({
      operation: "face.trajectory.get",
      params: {
        assetId: "asset-a",
        streamId: "track:1",
        generation: "generation-a",
        cursor: { assetId: "asset-a", streamId: "track:1", afterOrdinal: 10 },
      },
    }),
  ).toThrow();
});
