import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const replay = new URL(
  "../../../specs/done/video-editing-feedback/assets/31-speaker-replication/nemotron3-closure/replay.mjs",
  import.meta.url,
).pathname;

test("replays the Nemotron-3 closure refusal without inference", async () => {
  const { stdout } = await run(process.execPath, [replay], { maxBuffer: 1024 * 1024 });
  const result = JSON.parse(stdout);
  assert.deepEqual(result, {
    ok: true,
    status: "acquisition-reproducibility-refused",
    relocation: "passed-with-donor-clone",
    cleanMaterialization: "not-run",
    quality: {
      shortGate: "not-rerun",
      longForm: "blocked",
      promotion: false,
      priorShortRefusal: "../nemotron3-admission-short-gate/protocol.json",
    },
  });
});
