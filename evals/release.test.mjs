import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { verifyRelease } from "./release.mjs";

test("a corrupt published ZIP is rejected before its CLI can execute", () => {
  const original = Buffer.from("original archive");
  const receipt = Buffer.from(
    JSON.stringify({ tag: "v1.2.3", architecture: "arm64", platform: "macOS" }),
  );
  const sum = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const checksums = `${sum(original)}  ScreenRecorder-v1.2.3-macos-arm64.zip\n${sum(receipt)}  release.json\n`;
  assert.throws(
    () =>
      verifyRelease({
        archive: Buffer.from("corrupt archive"),
        receipt,
        checksums,
        archiveName: "ScreenRecorder-v1.2.3-macos-arm64.zip",
        tag: "v1.2.3",
      }),
    /Checksum mismatch/,
  );
});

test("a damaged cached CLI is rejected before fixture or agent execution", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { releaseCli } = await import("./release.mjs");
  const cache = await mkdtemp(join(tmpdir(), "eval-release-"));
  const originalFetch = globalThis.fetch;
  try {
    await mkdir(join(cache, "v1.2.3"));
    await writeFile(join(cache, "v1.2.3/main.mjs"), "damaged CLI");
    await writeFile(join(cache, "v1.2.3/release.json"), JSON.stringify({ tag: "v1.2.3" }));
    await writeFile(
      join(cache, "v1.2.3/main.sha256"),
      createHash("sha256").update("verified CLI").digest("hex"),
    );
    globalThis.fetch = async () => new Response(JSON.stringify({ tag_name: "v1.2.3", assets: [] }));
    await assert.rejects(releaseCli({ cache, image: "unused" }), /Cached CLI checksum mismatch/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(cache, { recursive: true, force: true });
  }
});
