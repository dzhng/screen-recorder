import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileControlsCheck } from "./fixtures/swift-controls.mjs";

// Library presentation only: synthetic observations, native controls, no service or activation.
const output = resolve(process.env.SHOTS ?? "/tmp/screenrec-library-view-shots");
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "screenrec-library-view-"));
try {
  writeFileSync(
    join(output, "source-revision.json"),
    JSON.stringify(
      {
        revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        hashes: Object.fromEntries(
          [
            "Sources/ScreenRecorder/LibraryView.swift",
            "Sources/ScreenRecorderControls/LibraryPresentation.swift",
            "Sources/ScreenRecorderControls/ExportPresentation.swift",
            "Sources/ScreenRecorderControls/SavedItem.swift",
            "tests/fixtures/library-view.swift",
          ].map((path) => [
            path,
            createHash("sha256")
              .update(readFileSync(new URL("../" + path, import.meta.url)))
              .digest("hex"),
          ]),
        ),
        facts: "synthetic; no service/device/permission reads or activation",
      },
      null,
      2,
    ) + "\n",
  );
  const executable = compileControlsCheck(
    scratch,
    ["LibraryView"],
    readFileSync(new URL("./fixtures/library-view.swift", import.meta.url), "utf8"),
  );
  execFileSync(executable, [output], { timeout: 20_000, stdio: "inherit" });
  console.log(output);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
