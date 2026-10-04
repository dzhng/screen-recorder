import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { frameworkIdentity } from "./framework.mjs";

test("framework provenance rejects executable links to bytes outside its tree", () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-framework-links-"));
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
