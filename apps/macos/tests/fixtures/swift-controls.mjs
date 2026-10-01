import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sources = fileURLToPath(new URL("../../Sources/", import.meta.url));

/** Builds the real controls module and links the named app sources and a check against it. */
export function compileControlsCheck(scratch, appSources, check) {
  const controls = join(sources, "ScreenRecorderControls");
  execFileSync(
    "swiftc",
    [
      "-emit-library",
      "-emit-module",
      "-module-name",
      "ScreenRecorderControls",
      "-emit-module-path",
      join(scratch, "ScreenRecorderControls.swiftmodule"),
      "-o",
      join(scratch, "libScreenRecorderControls.dylib"),
      ...readdirSync(controls)
        .filter((name) => name.endsWith(".swift"))
        .map((name) => join(controls, name)),
    ],
    { timeout: 60_000, stdio: "pipe" },
  );
  const main = join(scratch, "Check.swift");
  writeFileSync(main, check);
  const executable = join(scratch, "check");
  execFileSync(
    "swiftc",
    [
      "-swift-version",
      "6",
      "-parse-as-library",
      "-I",
      scratch,
      "-L",
      scratch,
      "-lScreenRecorderControls",
      "-Xlinker",
      "-rpath",
      "-Xlinker",
      scratch,
      ...appSources.map((name) => join(sources, "ScreenRecorder", `${name}.swift`)),
      main,
      "-o",
      executable,
    ],
    { timeout: 60_000, stdio: "pipe" },
  );
  return executable;
}
