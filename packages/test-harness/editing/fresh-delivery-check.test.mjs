import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyFreshDelivery } from "../../../skills/yap/scripts/fresh-delivery-check.mjs";

async function runFixture() {
  const root = await mkdtemp(join(tmpdir(), "yap-fresh-delivery-"));
  const clean = join(root, "clean");
  const relocated = join(root, "relocated");
  await mkdir(join(clean, "managed"), { recursive: true });
  await mkdir(join(relocated, "managed"), { recursive: true });
  const brief = "A complete question ends the teaser before its answer.\n";
  const source = Buffer.from("source-camera-bytes\n");
  const output = Buffer.from("checked-delivery-bytes\n");
  const files = {
    cleanBrief: join(clean, "brief.md"),
    relocatedBrief: join(relocated, "brief.md"),
    cleanSource: join(clean, "camera.mov"),
    relocatedSource: join(relocated, "camera.mov"),
    cleanOutput: join(clean, "managed", "teaser.mp4"),
    relocatedOutput: join(relocated, "managed", "teaser.mp4"),
  };
  await Promise.all([
    writeFile(files.cleanBrief, brief),
    writeFile(files.relocatedBrief, brief),
    writeFile(files.cleanSource, source),
    writeFile(files.relocatedSource, source),
    writeFile(files.cleanOutput, output),
    writeFile(files.relocatedOutput, output),
  ]);
  const request = {
    version: 1,
    useCase: "teaser",
    runs: [
      {
        state: "clean",
        root: clean,
        brief: { path: files.cleanBrief },
        sources: [{ key: "camera", path: files.cleanSource }],
        selection: { clip: "camera", range: [0, 1_000_000] },
        recipe: { ending: "complete-question", answer: "withheld" },
        delivery: { path: files.cleanOutput, parity: "byte-exact" },
      },
      {
        state: "relocated",
        root: relocated,
        brief: { path: files.relocatedBrief },
        sources: [{ key: "camera", path: files.relocatedSource }],
        selection: { clip: "camera", range: [0, 1_000_000] },
        recipe: { ending: "complete-question", answer: "withheld" },
        delivery: { path: files.relocatedOutput, parity: "byte-exact" },
      },
    ],
    coverage: {
      capabilityRouting: "verified",
      sourceIdentity: "verified",
      deliveryIdentity: "verified",
      native: "unverified",
      visual: "unverified",
      audio: "unverified",
      humanQaRequired: false,
    },
  };
  return { root, request };
}

test("verifies clean and relocated delivery identities without claiming native QA", async () => {
  const { root, request } = await runFixture();
  try {
    const result = await verifyFreshDelivery(request);
    assert.equal(result.version, 1);
    assert.equal(result.scope, "fresh-agent delivery identity and replay");
    assert.equal(result.useCase, "teaser");
    assert.equal(result.comparison.sourceIdentity, true);
    assert.equal(result.comparison.deliveryIdentity, true);
    assert.equal(result.coverage.native, "unverified");
    assert.equal(result.coverage.visual, "unverified");
    assert.equal(result.coverage.audio, "unverified");
    assert.match(result.provenance.focusedReference.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.runs[0].sources[0].sha256, result.runs[1].sources[0].sha256);
    assert.equal(result.runs[0].delivery.sha256, result.runs[1].delivery.sha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses a replay whose delivered bytes differ", async () => {
  const { root, request } = await runFixture();
  try {
    await writeFile(request.runs[1].delivery.path, "changed-delivery-bytes\n");
    await assert.rejects(() => verifyFreshDelivery(request), { code: "REPLAY_MISMATCH" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses native or visual claims outside this identity gate", async () => {
  const { root, request } = await runFixture();
  try {
    request.coverage.visual = "verified";
    await assert.rejects(() => verifyFreshDelivery(request), { code: "COVERAGE_OVERCLAIM" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
