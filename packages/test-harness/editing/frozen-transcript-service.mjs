import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Models, parakeetModel } from "../../../packages/core/dist/models.js";

// Frozen ASR fixtures declare readiness; they do not prepare or run a model.
// Keep registered pins/digest intact so real transcript ingestion validates the frozen receipt.
const transcription = Models.prototype.transcription;
const fixture = JSON.parse(await readFile(process.argv[3], "utf8"));
const status = Models.prototype.status;
const declaredState = () => fixture.modelState ?? { state: "ready" };
Models.prototype.status = function (modelId) {
  return modelId === "parakeet" ? Promise.resolve(declaredState()) : status.call(this, modelId);
};
Models.prototype.transcription = function (modelId) {
  assert.equal(modelId, "parakeet");
  const registered = transcription.call(this, modelId);
  assert.equal(registered.modelDigest, fixture.engine.modelDigest);
  for (const [key, value] of Object.entries(registered.pins))
    assert.equal(fixture.engine[key], value);
  return {
    ...registered,
    status: declaredState,
    nativeRequest: async () => {
      const directory = join(
        process.argv[2],
        "library/models",
        parakeetModel.name,
        parakeetModel.revision,
        parakeetModel.folderName,
      );
      await mkdir(directory, { recursive: true });
      return { directory, files: parakeetModel.files };
    },
  };
};
await import("./evidence-service.mjs");
