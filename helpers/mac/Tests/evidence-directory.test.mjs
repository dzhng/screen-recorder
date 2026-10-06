import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { withEvidenceDirectory } from "./fixtures/evidence-directory.mjs";

test("anonymous evidence is isolated and removed after success, native failure or signal", (t) => {
  const key = "YAP_TEST_EVIDENCE_DIRECTORY";
  for (const ending of ["", "process.exit(1)", "process.kill(process.pid, 'SIGKILL')"]) {
    let directory;
    const run = () =>
      withEvidenceDirectory(key, (env) => {
        directory = env[key];
        t.after(() => rmSync(directory, { recursive: true, force: true }));
        withEvidenceDirectory(key, (other) => {
          t.after(() => rmSync(other[key], { recursive: true, force: true }));
          assert.notEqual(other[key], directory);
          writeFileSync(join(directory, "keep"), "outer run");
          writeFileSync(join(other[key], "keep"), "inner run");
        });
        assert.equal(readFileSync(join(directory, "keep"), "utf8"), "outer run");
        execFileSync(process.execPath, ["-e", ending], { env, stdio: "pipe", timeout: 5000 });
      });
    if (ending) assert.throws(run);
    else run();
    assert.equal(existsSync(directory), false);
  }
});

test("an explicitly selected evidence directory remains caller-owned", (t) => {
  const key = "YAP_TEST_EVIDENCE_DIRECTORY";
  const directory = mkdtempSync(join(tmpdir(), "yap-explicit-evidence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  process.env[key] = directory;
  try {
    assert.throws(() =>
      withEvidenceDirectory(key, (env) => {
        writeFileSync(join(env[key], "retained"), "failure evidence");
        throw Error("native failure");
      }),
    );
    assert.equal(readFileSync(join(directory, "retained"), "utf8"), "failure evidence");
  } finally {
    delete process.env[key];
  }
});
