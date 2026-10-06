import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("reinstalling a personal app retains the installed bundle and a working launcher", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-personal-install-"));
  try {
    mkdirSync(join(scratch, "scripts"));
    copyFileSync(
      new URL("./install-personal.mjs", import.meta.url),
      join(scratch, "scripts/install-personal.mjs"),
    );
    const built = join(scratch, "dist/Yap.app/Contents");
    mkdirSync(join(built, "MacOS"), { recursive: true });
    mkdirSync(join(built, "Resources/cli"), { recursive: true });
    mkdirSync(join(built, "Resources/service"), { recursive: true });
    writeFileSync(
      join(built, "Info.plist"),
      `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.yap.install-test</string><key>CFBundleExecutable</key><string>Yap</string></dict></plist>`,
    );
    writeFileSync(join(built, "MacOS/Yap"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(built, "Resources/cli/main.mjs"), 'console.log("installed-cli");\n');
    writeFileSync(
      join(built, "Resources/service/runtime.json"),
      JSON.stringify({ nodePath: process.execPath }),
    );
    execFileSync("codesign", ["--force", "--sign", "-", join(scratch, "dist/Yap.app")]);
    const app = join(scratch, "Applications/Yap.app");
    const bin = join(scratch, "bin");
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(
        process.execPath,
        [join(scratch, "scripts/install-personal.mjs"), "--app", app, "--bin", bin],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        readFileSync(join(app, "Contents/Resources/cli/main.mjs"), "utf8"),
        'console.log("installed-cli");\n',
      );
      assert.equal(
        execFileSync(join(bin, "yap"), [], { encoding: "utf8" }).trim(),
        "installed-cli",
      );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
