import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { frameworkIdentity } from "./framework.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const pin = JSON.parse(readFileSync(join(directory, "upstream.json"), "utf8"));
const patchPath = join(directory, "screenrec.patch");
const patch = readFileSync(patchPath);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inputFiles = new Map(
  ["build.mjs", "framework.mjs", "upstream.json", "screenrec.patch"].map((name) => [
    name,
    sha256(readFileSync(join(directory, name))),
  ]),
);

function verifyInputFiles() {
  for (const [name, hash] of inputFiles) {
    if (sha256(readFileSync(join(directory, name))) !== hash) {
      throw new Error(`Build input module changed during compilation: ${name}`);
    }
  }
}

function git(source, args, env = process.env) {
  const result = spawnSync("git", ["-C", source, ...args], {
    encoding: "utf8",
    env: { ...env, GIT_NO_REPLACE_OBJECTS: "1" },
    timeout: 20_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr || `git ${args[0]} failed`);
  }
  return result.stdout;
}

function rawInputMismatch(source, patched) {
  const temporary = mkdtempSync(join(tmpdir(), "screenrec-sparkle-inputs-"));
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
  try {
    git(source, ["read-tree", pin.commit], env);
    if (patched) git(source, ["apply", "--cached", patchPath], env);
    for (const entry of git(source, ["ls-files", "--stage", "-z"], env).split("\0")) {
      if (!entry) continue;
      const [metadata, path] = entry.split("\t");
      const [mode, expectedHash] = metadata.split(" ");
      const input = join(source, path);
      let stat;
      try {
        stat = lstatSync(input);
      } catch (error) {
        if (error.code === "ENOENT") return path;
        throw error;
      }
      const actualMode = stat.isSymbolicLink()
        ? "120000"
        : stat.isFile()
          ? stat.mode & 0o100
            ? "100755"
            : "100644"
          : "unsupported";
      if (actualMode === "unsupported") return path;
      const bytes = stat.isSymbolicLink()
        ? readlinkSync(input, { encoding: "buffer" })
        : readFileSync(input);
      const hash = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      if (actualMode !== mode || hash !== expectedHash) return path;
    }
    const unexpected =
      git(source, ["ls-files", "--others", "--exclude-standard"], env) +
      git(source, ["ls-files", "--others", "--ignored", "--exclude-standard"], env);
    return unexpected ? `unexpected source inputs: ${unexpected.trim()}` : null;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function prepare(source, checkOnly) {
  if (sha256(patch) !== pin.patchSha256) throw new Error("Maintained patch does not match its pin");
  if (git(source, ["rev-parse", "HEAD"]).trim() !== pin.commit) {
    throw new Error(`Source must be checked out at ${pin.commit}`);
  }
  const pristineMismatch = rawInputMismatch(source, false);
  if (pristineMismatch) {
    const patchedMismatch = rawInputMismatch(source, true);
    if (patchedMismatch)
      throw new Error(
        `Raw source input differs from pinned trees (pristine: ${pristineMismatch}; patched: ${patchedMismatch})`,
      );
  } else {
    git(source, ["apply", "--check", patchPath]);
    if (!checkOnly) {
      git(source, ["apply", patchPath]);
      const mismatch = rawInputMismatch(source, true);
      if (mismatch)
        throw new Error(`Raw source input differs after patch preparation: ${mismatch}`);
    }
  }
  return {
    repository: pin.repository,
    version: pin.version,
    commit: pin.commit,
    tree: git(source, ["rev-parse", "HEAD^{tree}"]).trim(),
    patchSha256: pin.patchSha256,
  };
}

async function build(args) {
  const child = spawn("xcodebuild", args, { detached: true, stdio: "inherit" });
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    if (child.pid) {
      // Build subprocesses are disposable; stop the entire owned group, including
      // compilers that ignore graceful signals. This never targets installed apps.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH")
          console.error(`Cannot stop owned build group: ${error.message}`);
      }
    }
  };
  const timer = setTimeout(stop, 20 * 60_000);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await new Promise((accept, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0 && !interrupted) accept();
        else reject(new Error(`xcodebuild stopped (${signal ?? code})`));
      });
    });
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      output: { type: "string" },
      check: { type: "boolean" },
      "prepare-only": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node scripts/sparkle/build.mjs --source CHECKOUT [--check | --prepare-only | --output NEW_DIRECTORY]",
    );
    return;
  }
  if (
    !values.source ||
    !(values.check || values["prepare-only"] || values.output) ||
    (values.check && values["prepare-only"]) ||
    ((values.check || values["prepare-only"]) && values.output)
  ) {
    throw new Error("Select a source and exactly one of --check, --prepare-only, or --output");
  }
  const source = realpathSync(values.source);
  if (values.output && process.env.XCODE_XCCONFIG_FILE !== undefined) {
    throw new Error(
      "Unset XCODE_XCCONFIG_FILE; external Xcode configuration is not a pinned build input",
    );
  }
  const inputs = prepare(source, Boolean(values.check));
  if (values.check || values["prepare-only"]) {
    console.log(JSON.stringify({ source, inputs, patchApplicable: true, nativeVerified: false }));
    return;
  }
  const output = join(
    realpathSync(dirname(resolve(values.output))),
    basename(resolve(values.output)),
  );
  if (!relative(source, output).startsWith("..") || !relative(output, source).startsWith("..")) {
    throw new Error("Source and output directories must be separate");
  }
  mkdirSync(output);
  const version = spawnSync("xcodebuild", ["-version"], { encoding: "utf8", timeout: 20_000 });
  if (version.error || version.status !== 0) {
    throw version.error ?? new Error(version.stderr || "Full Xcode is required");
  }
  const firstLaunch = spawnSync("xcodebuild", ["-checkFirstLaunchStatus"], {
    encoding: "utf8",
    timeout: 20_000,
  });
  if (firstLaunch.error || firstLaunch.status !== 0) {
    throw (
      firstLaunch.error ??
      new Error(firstLaunch.stderr || "Complete Xcode first launch before building")
    );
  }
  const args = [
    "-project",
    join(source, "Sparkle.xcodeproj"),
    "-scheme",
    "Sparkle",
    "-configuration",
    "Release",
    "-sdk",
    "macosx",
    "-derivedDataPath",
    join(output, "derived-data"),
    "ARCHS=arm64",
    "ONLY_ACTIVE_ARCH=YES",
    "CODE_SIGNING_ALLOWED=NO",
    "CODE_SIGNING_REQUIRED=NO",
    "build",
  ];
  writeFileSync(
    join(output, "build-inputs.json"),
    JSON.stringify({ inputs, xcode: version.stdout.trim(), args }, null, 2) + "\n",
  );
  await build(args);
  verifyInputFiles();
  prepare(source, true);
  const sourceMismatch = rawInputMismatch(source, true);
  if (sourceMismatch)
    throw new Error(`Post-build source differs from the required patched tree: ${sourceMismatch}`);
  const framework = join(output, "Sparkle.framework");
  cpSync(join(output, "derived-data/Build/Products/Release/Sparkle.framework"), framework, {
    recursive: true,
    verbatimSymlinks: true,
    errorOnExist: true,
    force: false,
  });
  const receipt = {
    engine: "screenrec-sparkle-source",
    inputs,
    builderSha256: inputFiles.get("build.mjs"),
    identityUtilitySha256: inputFiles.get("framework.mjs"),
    platform: { os: process.platform, arch: process.arch },
    xcode: version.stdout.trim(),
    args,
    signing: "disabled-by-build",
    framework: frameworkIdentity(framework),
    acceptance: "built-only-native-runtime-unverified",
  };
  writeFileSync(join(output, "build-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify({ framework, receipt: join(output, "build-receipt.json"), ...receipt }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
