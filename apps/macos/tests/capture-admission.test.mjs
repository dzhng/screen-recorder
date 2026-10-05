import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test(
  "native controller admits selected primary camera without activating inputs",
  { timeout: 150_000 },
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-admission-"));
    try {
      execFileSync(
        process.execPath,
        [
          join(root, "apps/macos/tests/build-controller-journey.mjs"),
          scratch,
          join(root, "apps/macos/tests/fixtures/capture-controller/Admission.swift"),
        ],
        { timeout: 120_000, stdio: "pipe" },
      );
      const result = spawnSync(
        join(scratch, "controller-journey"),
        [join(root, "packages/protocol/fixtures/capture-primary-camera.json")],
        {
          encoding: "utf8",
          timeout: 10_000,
        },
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /PASS camera-primary admission/);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
