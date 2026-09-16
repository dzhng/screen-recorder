import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const helper = join(root, "helpers/mac");
const fixtures = fileURLToPath(new URL("./fixtures/capture-controller/", import.meta.url));

test(
  "controller preserves interruptions through a successful or refused pending start",
  { timeout: 150_000 },
  () => {
    const temporary = mkdtempSync(join(tmpdir(), "screenrec-controller-start-"));
    try {
      execFileSync(
        "swift",
        ["build", "--package-path", helper, "--target", "ScreenRecorderCapture"],
        { stdio: "pipe", timeout: 60_000 },
      );
      const bin = execFileSync("swift", ["build", "--package-path", helper, "--show-bin-path"], {
        encoding: "utf8",
        timeout: 10_000,
      }).trim();
      const source = readFileSync(
        join(root, "apps/macos/Sources/ScreenRecorder/CaptureController.swift"),
        "utf8",
      );
      const binding = "private let capture = NativeCapture()";
      assert.equal(
        source.split(binding).length,
        2,
        "Update the fixture's native boundary binding when its declaration changes",
      );
      // Compile the actual controller body; only its external native device is scripted. The
      // product needs no debug operation, conditional branch or broader capture protocol for this test.
      writeFileSync(
        join(temporary, "CaptureController.swift"),
        source.replace(binding, "private let capture = ScriptedCapture()"),
      );
      for (const name of ["ScriptedCapture.swift", "main.swift"])
        copyFileSync(join(fixtures, name), join(temporary, name));
      const objects = ["ScreenRecorderCapture", "ScreenRecorderMediaTime"].flatMap((target) => {
        const directory = join(bin, `${target}.build`);
        return readdirSync(directory)
          .filter((name) => name.endsWith(".swift.o"))
          .map((name) => join(directory, name));
      });
      const executable = join(temporary, "controller-probe");
      execFileSync(
        "swiftc",
        [
          "-swift-version",
          "6",
          "-I",
          join(bin, "Modules"),
          join(temporary, "ScriptedCapture.swift"),
          join(temporary, "CaptureController.swift"),
          join(temporary, "main.swift"),
          ...objects,
          "-o",
          executable,
        ],
        { stdio: "pipe", timeout: 60_000 },
      );
      for (const args of [[], ["failed-start"]]) {
        const result = spawnSync(executable, args, { encoding: "utf8", timeout: 5_000 });
        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`);
        assert.match(result.stdout, /PASS/);
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  },
);
