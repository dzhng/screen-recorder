import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

const acceptedStates = new Set([
  "recognition-parity-pass",
  "fixed-current",
  "picture-replication-pass",
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Certify that every retained real-media case has a scoped, replayable behavior
 * receipt in addition to the physical corpus proof. This deliberately reports
 * scoped evidence; it does not promote speaker, sync, or editorial quality.
 */
export async function certifyCorpusBehavior(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(Array.isArray(manifest.cases) && manifest.cases.length > 0, "Corpus has no cases");
  const manifestDirectory = dirname(resolve(manifestPath));
  const cases = [];
  for (const entry of manifest.cases) {
    const baseline = entry.baseline;
    assert(baseline && acceptedStates.has(baseline.state), `${entry.id}: behavior evidence is unverified`);
    assert.equal(entry.preservation?.status, "pass", `${entry.id}: physical preservation is not certified`);
    assert(typeof baseline.evidence === "string" && baseline.evidence.length > 0, `${entry.id}: behavior evidence is missing`);
    const evidencePath = isAbsolute(baseline.evidence)
      ? baseline.evidence
      : resolve(manifestDirectory, baseline.evidence);
    try {
      await access(evidencePath);
    } catch {
      throw new Error(`${entry.id}: behavior evidence file is missing (${baseline.evidence})`);
    }
    const evidenceBytes = await readFile(evidencePath);
    assert.match(
      baseline.evidenceSha256 ?? "",
      /^[0-9a-f]{64}$/,
      `${entry.id}: behavior evidence hash is missing`,
    );
    assert.equal(
      sha256(evidenceBytes),
      baseline.evidenceSha256,
      `${entry.id}: behavior evidence changed`,
    );
    const evidence = JSON.parse(evidenceBytes);
    if (baseline.state === "picture-replication-pass") {
      assert.equal(evidence.passed, true, `${entry.id}: picture evidence did not pass`);
      assert.equal(evidence.fullOrientedRaster, true, `${entry.id}: picture raster evidence is incomplete`);
      assert.equal(evidence.exactPhysicalClocks, true, `${entry.id}: picture clock evidence is incomplete`);
    }
    cases.push({
      id: entry.id,
      state: baseline.state,
      evidence: baseline.evidence,
      evidenceSha256: sha256(evidenceBytes),
    });
  }
  return {
    status: "passed",
    scope: "retained real-media cases have scoped replayable behavior evidence; this does not certify global sync, speaker continuity or editorial quality",
    cases,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const [manifestPath] = process.argv.slice(2);
    assert(manifestPath, "Usage: node corpus-behavior.mjs MANIFEST");
    console.log(JSON.stringify(await certifyCorpusBehavior(manifestPath), null, 2));
  } catch (error) {
    console.log(
      JSON.stringify({
        status: "refused",
        error: { code: error.code ?? "INVALID_CORPUS_BEHAVIOR", message: error.message },
      }),
    );
    process.exitCode = 1;
  }
}
