import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Models, parakeetModel } from "../../../packages/core/dist/models.js";

// Both fixture modes declare scratch readiness; neither adopts files into a model owner.
// Actual mode names already verified files; native checks their bytes before inference.
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
      if (fixture.existingModels) {
        assert.deepEqual(fixture.existingModels.files, parakeetModel.files);
        return fixture.existingModels;
      }
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
