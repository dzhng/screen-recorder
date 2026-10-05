import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";

// Draw and drive the production view. Facts are synthetic; no device/service/permission access.
const output = resolve(process.env.SHOTS ?? "specs/capture-menu/evidence/01-capture/candidate");
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "screenrec-capture-view-"));
try {
  writeFileSync(
    join(output, "source-revision.json"),
    JSON.stringify(
      {
        revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        productionViewSha256: createHash("sha256")
          .update(
            readFileSync(new URL("../Sources/ScreenRecorder/CaptureView.swift", import.meta.url)),
          )
          .digest("hex"),
        fixtureSha256: createHash("sha256")
          .update(readFileSync(new URL("./fixtures/capture-view.swift", import.meta.url)))
          .digest("hex"),
        sourceFilesUncommittedAtCapture:
          execFileSync(
            "git",
            [
              "status",
              "--porcelain",
              "--",
              "apps/macos/Sources/ScreenRecorder/CaptureView.swift",
              "apps/macos/tests/fixtures/capture-view.swift",
            ],
            { encoding: "utf8" },
          ).trim().length > 0,
      },
      null,
      2,
    ) + "\n",
  );
  const executable = compileControlsCheck(
    scratch,
    ["CaptureView"],
    readFileSync(new URL("./fixtures/capture-view.swift", import.meta.url), "utf8"),
  );
  execFileSync(executable, [output], { timeout: 20_000, stdio: "inherit" });
  console.log(output);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
