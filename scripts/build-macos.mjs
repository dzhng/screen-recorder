import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "dist/ScreenRecorder.app");
const macOS = join(app, "Contents/MacOS");
mkdirSync(macOS, { recursive: true });
for (const [directory, executable] of [
  ["helpers/mac", "screenrec-native"],
  ["apps/macos", "ScreenRecorder"],
]) {
  const args = ["build", "--package-path", join(root, directory), "--configuration", "release"];
  execFileSync("swift", args, { stdio: "inherit" });
  const bin = execFileSync("swift", [...args, "--show-bin-path"], { encoding: "utf8" }).trim();
  copyFileSync(join(bin, executable), join(macOS, executable));
}
copyFileSync(join(root, "apps/macos/Info.plist"), join(app, "Contents/Info.plist"));
execFileSync("codesign", ["--force", "--sign", "-", app], { stdio: "inherit" });
console.error(`Built ${app}`);
