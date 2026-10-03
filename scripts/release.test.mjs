import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("release.mjs", import.meta.url));

function fixture() {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-release-inputs-"));
  for (const folder of ["scripts", "apps/macos", "helpers/denoise", "dist/release-inputs"])
    mkdirSync(join(scratch, folder), { recursive: true });
  copyFileSync(script, join(scratch, "scripts/release.mjs"));
  writeFileSync(join(scratch, ".node-version"), "24.0.0\n");
  writeFileSync(join(scratch, "apps/macos/package.json"), JSON.stringify({ version: "0.0.0" }));
  writeFileSync(
    join(scratch, "scripts/release-inputs.json"),
    JSON.stringify({ node: { sha256: "0".repeat(64) } }),
  );
  writeFileSync(
    join(scratch, "helpers/denoise/provenance.json"),
    JSON.stringify({ modelArchiveSha256: "1".repeat(64) }),
  );
  return scratch;
}

test("a release tag cannot label a different app version", () => {
  const scratch = fixture();
  try {
    const answer = spawnSync(
      process.execPath,
      [join(scratch, "scripts/release.mjs"), "validate", "v999.0.0"],
      { encoding: "utf8" },
    );
    assert.equal(answer.status, 1);
    assert.match(answer.stderr, /does not match app version v0\.0\.0/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("preparation refuses a corrupt cached runtime before downloading or staging models", () => {
  const scratch = fixture();
  try {
    writeFileSync(
      join(scratch, "dist/release-inputs/node-v24.0.0-darwin-arm64.tar.gz"),
      "corrupt node",
    );
    writeFileSync(
      join(scratch, `dist/release-inputs/rnnoise_data-${"1".repeat(64)}.tar.gz`),
      "corrupt model",
    );
    const answer = spawnSync(process.execPath, [join(scratch, "scripts/release.mjs"), "prepare"], {
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(answer.status, 1, answer.stdout + answer.stderr);
    assert.match(answer.stderr, /Checksum mismatch:.*node-v24\.0\.0-darwin-arm64\.tar\.gz/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
