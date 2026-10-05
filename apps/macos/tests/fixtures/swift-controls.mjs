import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sources = fileURLToPath(new URL("../../Sources/", import.meta.url));

/** Builds the real controls module and links the named app sources and a check against it. */
export function compileControlsCheck(scratch, appSources, check, onCompile = () => {}) {
  const compile = (args) => {
    onCompile({ command: "swiftc", args, timeoutMs: 60000 });
    return execFileSync("swiftc", args, { timeout: 60_000, stdio: "pipe" });
  };
  const packagePath = fileURLToPath(new URL("../../", import.meta.url));
  const args = [
    "build",
    "--build-system",
    "native",
    "--package-path",
    packagePath,
    "--target",
    "ScreenRecorderControls",
    "--jobs",
    "2",
  ];
  onCompile({ command: "swift", args, timeoutMs: 60000 });
  execFileSync("swift", args, { timeout: 60000, stdio: "pipe" });
  const build = join(packagePath, ".build", "debug");
  const outputs = JSON.parse(
    readFileSync(join(build, "ScreenRecorderControls.build", "output-file-map.json"), "utf8"),
  );
  const objects = Object.values(outputs).flatMap((value) => (value.object ? [value.object] : []));
  const main = join(scratch, "Check.swift");
  writeFileSync(main, check);
  const executable = join(scratch, "check");
  compile([
    "-swift-version",
    "6",
    "-parse-as-library",
    "-I",
    join(build, "Modules"),
    ...objects,
    ...appSources.map((name) => join(sources, "ScreenRecorder", `${name}.swift`)),
    main,
    "-o",
    executable,
  ]);
  return executable;
}
