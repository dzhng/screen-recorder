import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  chmodSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("archive smoke avoids production host/launcher execution and rejects changed files, modes or links", () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-smoke-contract-"));
  try {
    for (const path of [
      "scripts",
      "dist/release",
      "bin",
      "kit/Screen Recorder.app/Contents/MacOS",
      "kit/Screen Recorder.app/Contents/Resources/node/bin",
      "kit/Screen Recorder.app/Contents/Resources/cli",
    ])
      mkdirSync(join(scratch, path), { recursive: true });
    copyFileSync(
      new URL("release-smoke.mjs", import.meta.url),
      join(scratch, "scripts/release-smoke.mjs"),
    );
    const forbidden = join(scratch, "forbidden-execution");
    const trap = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(forbidden)},'forbidden');process.exit(79);\n`;
    const app = join(scratch, "kit/Screen Recorder.app");
    writeFileSync(join(app, "Contents/MacOS/ScreenRecorder"), trap, { mode: 0o755 });
    writeFileSync(join(scratch, "kit/screenrec"), trap, { mode: 0o755 });
    writeFileSync(
      join(app, "Contents/MacOS/screenrec-native"),
      `#!${process.execPath}\nconsole.log(JSON.stringify({id:'release-smoke',ok:true,data:{platform:'macos'}}));\n`,
      { mode: 0o755 },
    );
    symlinkSync(process.execPath, join(app, "Contents/Resources/node/bin/node"));
    writeFileSync(
      join(app, "Contents/Resources/cli/main.mjs"),
      `console.log(JSON.stringify({operations:[{name:'edit.apply'}]}));\n`,
    );
    symlinkSync("cli/main.mjs", join(app, "Contents/Resources/alias"));
    writeFileSync(join(scratch, "bin/codesign"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const release = join(scratch, "dist/release");
    writeFileSync(
      join(release, "release.json"),
      JSON.stringify({
        tag: "v0.1.3",
        nodeVersion: process.versions.node,
        updateArchive: { name: "update.zip" },
      }),
    );
    execFileSync("ditto", [
      "-c",
      "-k",
      join(scratch, "kit"),
      join(release, "ScreenRecorder-v0.1.3-macos-arm64.zip"),
    ]);
    const updateApp = join(scratch, "update/Screen Recorder.app");
    const packageUpdate = () =>
      execFileSync("ditto", ["-c", "-k", "--keepParent", updateApp, join(release, "update.zip")]);
    const run = () =>
      spawnSync(process.execPath, [join(scratch, "scripts/release-smoke.mjs")], {
        env: { ...process.env, PATH: join(scratch, "bin") + ":" + process.env.PATH },
        encoding: "utf8",
        timeout: 5000,
      });
    execFileSync("ditto", [app, updateApp]);
    packageUpdate();
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.equal(existsSync(forbidden), false);
    for (const mutation of ["bytes", "mode", "link"]) {
      rmSync(join(scratch, "update"), { recursive: true });
      execFileSync("ditto", [app, updateApp]);
      if (mutation === "bytes")
        writeFileSync(join(updateApp, "Contents/Resources/cli/main.mjs"), "changed");
      if (mutation === "mode") chmodSync(join(updateApp, "Contents/MacOS/ScreenRecorder"), 0o644);
      if (mutation === "link") {
        unlinkSync(join(updateApp, "Contents/Resources/alias"));
        symlinkSync("node/bin/node", join(updateApp, "Contents/Resources/alias"));
      }
      packageUpdate();
      const changed = run();
      assert.equal(changed.status, 1, changed.stdout + changed.stderr);
      assert.match(changed.stderr, /same files, modes and links/);
      assert.equal(existsSync(forbidden), false);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
