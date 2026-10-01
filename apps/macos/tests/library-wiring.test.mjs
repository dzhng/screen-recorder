import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const sources = fileURLToPath(new URL("../Sources/", import.meta.url));
const native = fileURLToPath(new URL("../../../helpers/mac/Sources/", import.meta.url));
const swiftFiles = (folder) =>
  readdirSync(folder)
    .filter((name) => name.endsWith(".swift"))
    .sort()
    .map((name) => join(folder, name));

test(
  "concrete native library wiring compiles and all pure controls remain covered",
  { timeout: 120_000 },
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-library-wiring-"));
    try {
      for (const [name, folder] of [
        ["ScreenRecorderMedia", native],
        ["ScreenRecorderCapture", native],
        ["ScreenRecorderControls", sources],
      ]) {
        execFileSync(
          "swiftc",
          [
            "-swift-version",
            "6",
            "-package-name",
            "ScreenRecorderNative",
            "-emit-library",
            "-emit-module",
            "-module-name",
            name,
            "-emit-module-path",
            join(scratch, `${name}.swiftmodule`),
            "-I",
            scratch,
            "-L",
            scratch,
            ...(name === "ScreenRecorderCapture" ? ["-lScreenRecorderMedia"] : []),
            "-o",
            join(scratch, `lib${name}.dylib`),
            ...swiftFiles(join(folder, name)),
          ],
          { timeout: 60_000, stdio: "pipe" },
        );
      }
      // Compile the actual presenter, status item, capture controller and dispatch together; execute none of them.
      const app = join(scratch, "ScreenRecorder");
      execFileSync(
        "swiftc",
        [
          "-swift-version",
          "6",
          "-I",
          scratch,
          "-L",
          scratch,
          "-lScreenRecorderControls",
          "-lScreenRecorderCapture",
          "-lScreenRecorderMedia",
          ...swiftFiles(join(sources, "ScreenRecorder")),
          "-o",
          app,
        ],
        { timeout: 60_000, stdio: "pipe" },
      );
      const executable = join(scratch, "pure-controls");
      execFileSync(
        "swiftc",
        [
          "-I",
          scratch,
          "-L",
          scratch,
          "-lScreenRecorderControls",
          "-Xlinker",
          "-rpath",
          "-Xlinker",
          scratch,
          ...swiftFiles(fileURLToPath(new URL("./ScreenRecorderControlsTests/", import.meta.url))),
          "-o",
          executable,
        ],
        { timeout: 60_000, stdio: "pipe" },
      );
      const output = execFileSync(executable, { encoding: "utf8", timeout: 15_000 });
      assert.match(output, /PASS recording controls/);
      process.stdout.write(output);
      console.log(
        "PASS source-identical concrete native library wiring compiled without instantiation",
      );
      console.log(
        JSON.stringify({
          appBinarySha256: createHash("sha256").update(readFileSync(app)).digest("hex"),
        }),
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
);
