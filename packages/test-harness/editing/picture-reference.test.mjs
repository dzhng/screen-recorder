import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { run, root } from "./source-evidence-fixture.mjs";

// Native reference checks: run on macOS with selected fixture media fetched.
async function reference(t, movie, timesUs) {
  const home = await mkdtemp(join(tmpdir(), "yap-picture-reference-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const executable = join(home, "reference");
  await run(
    "swiftc",
    [
      "-parse-as-library",
      join(root, "packages/test-harness/editing/FrameColorReference.swift"),
      "-o",
      executable,
    ],
    { timeout: 120000 },
  );
  const output = join(home, "pictures");
  await mkdir(output);
  const request = join(home, "request.json");
  await writeFile(request, JSON.stringify({ movie: join(root, movie), output, timesUs }));
  return JSON.parse((await run(executable, [request], { timeout: 30000 })).stdout);
}

test("player reference records every request and continues after unavailable pictures", async (t) => {
  const receipt = await reference(
    t,
    "fixtures/video-editing-feedback/graham-picture.mov",
    [0, 4000000, 500000],
  );
  assert.deepEqual(
    receipt.map(({ index, requestedUs, status }) => ({ index, requestedUs, status })),
    [
      { index: 0, requestedUs: 0, status: "available" },
      { index: 1, requestedUs: 4000000, status: "failed" },
      { index: 2, requestedUs: 500000, status: "available" },
    ],
  );
  assert.ok(receipt[1].error.length > 0);
  assert.equal(receipt[1].file, undefined);
  assert.equal(
    BigInt(receipt[2].actualValue) * 1000000n,
    500000n * BigInt(receipt[2].actualTimescale),
  );
});

test("player reference retains actual fractional frame time and unnamed generated profile", async (t) => {
  const camera = await reference(
    t,
    "fixtures/video-editing-feedback/graham-picture.mov",
    [2958334],
  );
  assert.equal(camera[0].status, "available");
  assert.equal(camera[0].requestedUs, 2958334);
  assert.equal(BigInt(camera[0].actualValue) * 24n, 71n * BigInt(camera[0].actualTimescale));
  const chart = await reference(t, "specs/done/agent-editing/assets/00-corpus/a.mov", [0]);
  assert.equal(chart[0].status, "available");
  assert.equal(chart[0].sourceProfile, "unnamed ICC");
  assert.match(chart[0].sourceProfileSHA256, /^[a-f0-9]{64}$/);
  assert.equal(chart[0].outputProfile, "kCGColorSpaceSRGB");
});

test("player reference reports the profile carried by its encoded PNG", async (t) => {
  const [receipt] = await reference(t, "fixtures/video-editing-feedback/graham-picture.mov", [0]);
  const tool = join(dirname(receipt.file), "pixels");
  await run(
    "swiftc",
    [
      "-parse-as-library",
      join(root, "packages/test-harness/editing/FrameImagePixels.swift"),
      "-o",
      tool,
    ],
    { timeout: 120000 },
  );
  const profile = JSON.parse((await run(tool, [receipt.file, receipt.file + ".rgba"])).stdout);
  assert.equal(receipt.outputProfile, profile.sourceProfile);
  assert.equal(receipt.outputProfileSHA256, profile.sourceProfileSHA256);
});
