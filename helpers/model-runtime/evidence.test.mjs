import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
const verifier = fileURLToPath(
  new URL(
    "../../specs/done/ffmpeg-parity/evidence/speaker-runtime/verify-retained.mjs",
    import.meta.url,
  ),
);
test("changed speaker runtime inventory cannot borrow a frozen preservation pass", () => {
  const scratch = mkdtempSync(join(tmpdir(), "runtime-evidence-"));
  try {
    const changed = JSON.stringify({
      entries: [],
      digest: createHash("sha256").update("[]").digest("hex"),
    });
    const artifact = join(scratch, "changed.json");
    writeFileSync(artifact, changed);
    const out = join(scratch, "retained");
    const result = spawnSync(
      process.execPath,
      [verifier, "--runtime-artifact", artifact, "--out", out],
      {
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.notEqual(result.status, 0, "changed inventory accepted");
    assert.match(result.stderr, /Frozen runtime inventory changed/);
    assert.equal(
      gunzipSync(readFileSync(join(out, "runtime-artifact.json.gz"))).toString(),
      changed,
    );
    assert.equal(JSON.parse(readFileSync(join(out, "verification.json"))).verified, false);
  } catch (error) {
    console.error("Unverified evidence control retained at", scratch);
    throw error;
  }
  if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
});
