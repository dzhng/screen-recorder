import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const native =
  process.env.YAP_NATIVE ??
  fileURLToPath(new URL("../.build/debug/yap-native", import.meta.url));
function request(operation, params) {
  const result = spawnSync(native, [], {
    input: JSON.stringify({ id: "speaker", operation, params }) + "\n",
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}

test("private speaker PCM dispatch advertises its physical recipe and rejects unknown fields before source execution", () => {
  const capability = request("media.speakerCapabilities", {});
  assert.equal(capability.ok, true, JSON.stringify(capability));
  assert.equal(capability.data.recipe, "source-selected-span-avfoundation-f32-16k-v1");
  assert.match(capability.data.providerVersion, /Build/);
  assert.equal(
    request("media.speakerCapabilities", { source: "/tmp/unrequested" }).error.code,
    "INVALID_REQUEST",
  );
  const params = {
    source: {
      source: "/tmp/nonexistent-speaker-source",
      sourceOffsetUs: 0,
      available: [{ startUs: 0, endUs: 30000000 }],
    },
    range: { startUs: 0, endUs: 30000000 },
    channel: 0,
    output: "/tmp/unrequested-speaker-output",
    editorial: true,
  };
  assert.equal(request("media.sourceSpeakerPCM", params).error.code, "INVALID_REQUEST");
});
