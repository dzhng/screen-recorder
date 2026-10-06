import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { frameworkIdentity } from "./framework.mjs";

test("framework provenance rejects executable links to bytes outside its tree", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-framework-links-"));
  try {
    const framework = join(scratch, "Sparkle.framework");
    mkdirSync(framework);
    writeFileSync(join(scratch, "unbound-executable"), "outside the framework");
    symlinkSync("../unbound-executable", join(framework, "Sparkle"));
    assert.throws(() => frameworkIdentity(framework), /outside the framework/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("framework provenance changes when its enclosing directory loses recipient access", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-framework-mode-"));
  try {
    const framework = join(scratch, "Sparkle.framework");
    mkdirSync(framework, { mode: 0o755 });
    writeFileSync(join(framework, "Sparkle"), "framework bytes");
    const accessible = frameworkIdentity(framework).sha256;
    chmodSync(framework, 0o700);
    assert.notEqual(frameworkIdentity(framework).sha256, accessible);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
