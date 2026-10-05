import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("relocated media verification reports service startup refusal without running the production app or launcher", () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-media-smoke-contract-"));
  try {
    for (const directory of [
      "scripts",
      "dist/release",
      "bin",
      "packages/test-harness/editing",
      "kit/Screen Recorder.app/Contents/MacOS",
      "kit/Screen Recorder.app/Contents/Resources/node/bin",
      "kit/Screen Recorder.app/Contents/Resources/service",
    ])
      mkdirSync(join(scratch, directory), { recursive: true });
    copyFileSync(
      new URL("release-media-smoke.mjs", import.meta.url),
      join(scratch, "scripts/release-media-smoke.mjs"),
    );
    writeFileSync(
      join(scratch, "packages/test-harness/editing/hevc-delivery.mjs"),
      "export function verifyVideoDelivery(){throw Error('unexpected media execution')}\n",
    );
    const app = join(scratch, "kit/Screen Recorder.app");
    const forbidden = join(scratch, "forbidden");
    const trap = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(forbidden)},'unexpected');process.exit(79);\n`;
    writeFileSync(join(app, "Contents/MacOS/ScreenRecorder"), trap, { mode: 0o755 });
    writeFileSync(join(scratch, "kit/screenrec"), trap, { mode: 0o755 });
    symlinkSync(process.execPath, join(app, "Contents/Resources/node/bin/node"));
    writeFileSync(
      join(app, "Contents/Resources/service/main.mjs"),
      "console.log(JSON.stringify({event:'failed',error:{code:'FIXTURE_REFUSAL',message:'fixture-startup-refusal'}}));process.exitCode=1;\n",
    );
    writeFileSync(
      join(app, "Contents/Resources/service/runtime.json"),
      JSON.stringify({ ffmpegDirectory: "../ffmpeg", ffmpegReceiptSha256: "fixture" }),
    );
    writeFileSync(join(scratch, "bin/codesign"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(scratch, "dist/release/release.json"), JSON.stringify({ tag: "v0.1.3" }));
    execFileSync("ditto", [
      "-c",
      "-k",
      join(scratch, "kit"),
      join(scratch, "dist/release/ScreenRecorder-v0.1.3-macos-arm64.zip"),
    ]);
    const result = spawnSync(process.execPath, [join(scratch, "scripts/release-media-smoke.mjs")], {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, PATH: join(scratch, "bin") + ":" + process.env.PATH },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /fixture-startup-refusal/);
    assert.equal(existsSync(forbidden), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
