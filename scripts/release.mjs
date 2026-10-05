import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  renameSync,
  globSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "apps/macos/package.json")));
const { node } = JSON.parse(readFileSync(join(root, "scripts/release-inputs.json")));
node.version = readFileSync(join(root, ".node-version"), "utf8").trim();
node.archive = `node-v${node.version}-darwin-arm64.tar.gz`;
const denoise = JSON.parse(readFileSync(join(root, "helpers/denoise/provenance.json")));
const inputs = join(root, "dist/release-inputs");
const modelName = `rnnoise_data-${denoise.modelArchiveSha256}.tar.gz`;
const run = (command, args) => execFileSync(command, args, { stdio: "inherit" });
const sha = async (file) => {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
};
async function verified(file, expected) {
  if ((await sha(file)) !== expected) throw new Error(`Checksum mismatch: ${file}`);
}
async function download(url, file, expected) {
  if (existsSync(file)) {
    await verified(file, expected);
    return;
  }
  const temporary = `${file}.part-${process.pid}`;
  try {
    const answer = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!answer.ok) throw new Error(`Download failed: ${url} (${answer.status})`);
    await pipeline(answer.body, createWriteStream(temporary, { flags: "wx" }));
    await verified(temporary, expected);
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}
function validate(tag) {
  if (tag !== `v${version}` || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? ""))
    throw new Error(`Tag ${JSON.stringify(tag)} does not match app version v${version}`);
}
async function prepare() {
  mkdirSync(inputs, { recursive: true });
  await download(
    `https://nodejs.org/dist/v${node.version}/${node.archive}`,
    join(inputs, node.archive),
    node.sha256,
  );
  await download(
    `https://media.xiph.org/rnnoise/models/${modelName}`,
    join(inputs, modelName),
    denoise.modelArchiveSha256,
  );
  run(process.execPath, [join(root, "helpers/denoise/prepare.mjs"), join(inputs, modelName)]);
  run(process.execPath, [join(root, "helpers/ffmpeg/prepare.mjs"), "prepare", "--cache", inputs]);
}
async function packageRelease(tag) {
  validate(tag);
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw new Error("Release packaging requires an Apple Silicon Mac.");
  const dirty = execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (dirty) throw new Error("Commit source changes before packaging a release.");
  await verified(join(inputs, node.archive), node.sha256);
  const built = join(root, "dist/ScreenRecorder.app");
  const builtVersion = execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :CFBundleShortVersionString", join(built, "Contents/Info.plist")],
    { encoding: "utf8" },
  ).trim();
  if (builtVersion !== version)
    throw new Error(`Built app version ${builtVersion} does not match ${tag}`);
  const minimumMacOS = execFileSync(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :LSMinimumSystemVersion", join(built, "Contents/Info.plist")],
    { encoding: "utf8" },
  ).trim();
  const out = join(root, "dist/release");
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(out, "package-"));
  const app = join(work, "Screen Recorder.app");
  const archive = join(out, `ScreenRecorder-${tag}-macos-arm64.zip`);
  const temporaryArchive = `${archive}.part-${process.pid}`;
  try {
    run("ditto", [built, app]);
    run("tar", ["-xzf", join(inputs, node.archive), "-C", work]);
    const distribution = join(work, `node-v${node.version}-darwin-arm64`);
    const resources = join(app, "Contents/Resources");
    const runtime = join(resources, "node/bin");
    mkdirSync(runtime, { recursive: true });
    copyFileSync(join(distribution, "bin/node"), join(runtime, "node"));
    const notices = join(resources, "ThirdParty");
    for (const [name, file] of [
      ["Node", join(distribution, "LICENSE")],
      ["FluidAudio", join(root, "helpers/mac/.build/checkouts/FluidAudio/LICENSE")],
      [
        "SignalsmithStretch",
        join(root, "helpers/stretch/Sources/CSignalsmith/vendor/LICENSE-stretch.txt"),
      ],
      [
        "SignalsmithLinear",
        join(root, "helpers/stretch/Sources/CSignalsmith/vendor/LICENSE-linear.txt"),
      ],
    ]) {
      mkdirSync(join(notices, name), { recursive: true });
      copyFileSync(file, join(notices, name, "LICENSE"));
    }
    for (const file of globSync(
      "node_modules/.bun/*/node_modules/{*,@*/*}/{LICENSE*,COPYING*,NOTICE*}",
      { cwd: root },
    )) {
      const destination = join(notices, "JavaScript", file.slice("node_modules/.bun/".length));
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(root, file), destination);
    }
    rmSync(distribution, { recursive: true });
    const manifestFile = join(resources, "service/runtime.json");
    const manifest = JSON.parse(readFileSync(manifestFile));
    manifest.nodePath = "../node/bin/node";
    const { stageFFmpeg } = await import("../helpers/ffmpeg/prepare.mjs");
    const tools = join(resources, "ffmpeg");
    rmSync(tools, { recursive: true, force: true });
    const ffmpeg = await stageFFmpeg({
      source: join(built, "Contents/Resources/ffmpeg"),
      destination: tools,
      sign: (file) => {
        const arch = execFileSync("lipo", ["-archs", file], { encoding: "utf8" }).trim();
        if (arch !== "arm64") throw new Error(`Expected arm64 FFmpeg resource: ${file} (${arch})`);
        run("codesign", ["--force", "--sign", "-", file]);
      },
    });
    manifest.ffmpegDirectory = "../ffmpeg";
    manifest.ffmpegReceiptSha256 = await sha(join(tools, "receipt.json"));
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
    for (const executable of [
      join(runtime, "node"),
      join(app, "Contents/MacOS/screenrec-native"),
      join(app, "Contents/MacOS/ScreenRecorder"),
    ]) {
      const arch = execFileSync("lipo", ["-archs", executable], { encoding: "utf8" }).trim();
      if (arch !== "arm64") throw new Error(`Expected arm64 executable: ${executable} (${arch})`);
      run("codesign", ["--force", "--sign", "-", executable]);
    }
    run("codesign", ["--force", "--sign", "-", app]);
    run("codesign", ["--verify", "--deep", "--strict", app]);
    writeFileSync(
      join(work, "screenrec"),
      `#!/bin/sh
app=\${SCREENREC_APP:-"$HOME/Applications/Screen Recorder.app"}
export SCREENREC_APP="$app"
exec "$app/Contents/Resources/node/bin/node" "$app/Contents/Resources/cli/main.mjs" "$@"
`,
      { mode: 0o755 },
    );
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    writeFileSync(
      join(work, "release.json"),
      JSON.stringify(
        {
          version,
          tag,
          revision,
          platform: "macOS",
          minimumMacOS,
          architecture: "arm64",
          nodeVersion: node.version,
          ffmpeg: {
            version: ffmpeg.version,
            sourceSha256: ffmpeg.sourceSha256,
            recipeSha256: ffmpeg.recipeSha256,
            receiptSha256: manifest.ffmpegReceiptSha256,
          },
          signature: "ad-hoc",
          notarized: false,
        },
        null,
        2,
      ) + "\n",
    );
    run("ditto", ["-c", "-k", "--sequesterRsrc", work, temporaryArchive]);
    renameSync(temporaryArchive, archive);
    copyFileSync(join(work, "release.json"), join(out, "release.json"));
    writeFileSync(
      join(out, "SHA256SUMS"),
      `${await sha(archive)}  ${archive.split("/").at(-1)}\n${await sha(join(out, "release.json"))}  release.json\n`,
    );
    console.log(archive);
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(temporaryArchive, { force: true });
  }
}
try {
  const [command, tag, ...extra] = process.argv.slice(2);
  if (extra.length || (command === "prepare" && tag))
    throw new Error("Unexpected release arguments");
  if (command === "validate") {
    validate(tag);
    console.log(version);
  } else if (command === "prepare") await prepare();
  else if (command === "package") await packageRelease(tag);
  else throw new Error("Usage: node scripts/release.mjs validate TAG | prepare | package TAG");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
