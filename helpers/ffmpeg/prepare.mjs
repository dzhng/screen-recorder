import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  lstatSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  cpSync,
} from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const owner = dirname(fileURLToPath(import.meta.url));
const root = resolve(owner, "../..");
export const provenance = JSON.parse(readFileSync(join(owner, "provenance.json"), "utf8"));
const recipeSha256 = createHash("sha256").update(JSON.stringify(provenance)).digest("hex");
const archiveName = `ffmpeg-${provenance.version}.tar.xz`;
const defaultOutput = join(owner, ".build/distribution");
async function sha(file) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function checksum(file, expected) {
  if ((await sha(file)) !== expected) throw new Error(`Checksum mismatch: ${file}`);
}
function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    timeout: 1_800_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}
function contained(directory, file) {
  const path = relative(realpathSync(directory), realpathSync(join(directory, file)));
  if (path === ".." || path.startsWith(`..${sep}`) || path.startsWith(sep))
    throw new Error(`FFmpeg resource escapes distribution: ${file}`);
}
function files(directory, prefix = "") {
  return readdirSync(join(directory, prefix)).flatMap((name) => {
    const file = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(join(directory, file));
    return stat.isDirectory() ? files(directory, file) : [file];
  });
}
export async function verifyFFmpeg(directory) {
  directory = resolve(directory);
  const receipt = JSON.parse(readFileSync(join(directory, "receipt.json"), "utf8"));
  if (
    receipt.format !== 1 ||
    receipt.recipeSha256 !== recipeSha256 ||
    receipt.sourceSha256 !== provenance.sourceSha256
  )
    throw new Error("Prepared FFmpeg recipe differs; prepare into a new output directory");
  if (!receipt.files || !receipt.files["bin/ffmpeg"] || !receipt.files["bin/ffprobe"])
    throw new Error("Prepared FFmpeg receipt lacks executables");
  for (const [file, expected] of Object.entries(receipt.files)) {
    if (file.startsWith("/") || file.split("/").includes(".."))
      throw new Error(`Invalid FFmpeg receipt path: ${file}`);
    contained(directory, file);
    await checksum(join(directory, file), expected);
  }
  const actual = files(directory)
    .filter((file) => file !== "receipt.json")
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(receipt.files).sort()))
    throw new Error("Prepared FFmpeg distribution membership differs");
  return receipt;
}

/** Signing changes binary bytes. Verify first, sign a private copy, then bind those bytes. */
export async function stageFFmpeg({ source = defaultOutput, destination, sign }) {
  const receipt = await verifyFFmpeg(source);
  if (!destination || existsSync(destination) || typeof sign !== "function")
    throw new Error("FFmpeg staging requires a new destination and an explicit signer");
  const preparedReceiptSha256 = await sha(join(source, "receipt.json"));
  try {
    cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
    for (const file of Object.keys(receipt.files)) {
      if (
        (file.startsWith("bin/") || file.endsWith(".dylib")) &&
        lstatSync(join(destination, file)).isFile()
      )
        await sign(join(destination, file));
    }
    const identities = {};
    for (const file of Object.keys(receipt.files))
      identities[file] = await sha(join(destination, file));
    const signed = { ...receipt, preparedReceiptSha256, files: identities };
    writeFileSync(join(destination, "receipt.json"), JSON.stringify(signed, null, 2) + "\n");
    await verifyFFmpeg(destination);
    return signed;
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}
async function acquire(cache) {
  mkdirSync(cache, { recursive: true });
  const archive = join(cache, archiveName);
  if (existsSync(archive)) {
    await checksum(archive, provenance.sourceSha256);
    return archive;
  }
  const temporary = `${archive}.part-${process.pid}`;
  try {
    const answer = await fetch(provenance.sourceUrl, { signal: AbortSignal.timeout(300_000) });
    if (!answer.ok) throw new Error(`FFmpeg source download failed (${answer.status})`);
    await pipeline(answer.body, createWriteStream(temporary, { flags: "wx" }));
    await checksum(temporary, provenance.sourceSha256);
    renameSync(temporary, archive);
    return archive;
  } finally {
    rmSync(temporary, { force: true });
  }
}
function inspect(directory) {
  const ffmpeg = join(directory, "bin/ffmpeg"),
    ffprobe = join(directory, "bin/ffprobe");
  const version = run(ffmpeg, ["-version"], undefined, true);
  if (
    !version.startsWith(`ffmpeg version ${provenance.version} `) ||
    !version.includes("--disable-gpl") ||
    !version.includes("--disable-nonfree")
  )
    throw new Error("FFmpeg build version/license configuration differs");
  const license = run(ffmpeg, ["-L"], undefined, true);
  if (!license.includes("Lesser General Public License"))
    throw new Error("FFmpeg build does not report LGPL");
  const filters = run(ffmpeg, ["-hide_banner", "-filters"], undefined, true);
  const encoders = run(ffmpeg, ["-hide_banner", "-encoders"], undefined, true);
  for (const [inventory, names] of [
    [filters, provenance.requiredFilters],
    [encoders, provenance.requiredEncoders],
  ])
    for (const name of names)
      if (!inventory.split("\n").some((line) => line.trim().split(/\s+/)[1] === name))
        throw new Error(`Required FFmpeg capability absent: ${name}`);
  if (
    !run(ffprobe, ["-version"], undefined, true).startsWith(
      `ffprobe version ${provenance.version} `,
    )
  )
    throw new Error("ffprobe version differs");
  for (const file of files(directory).filter(
    (file) => file.startsWith("bin/") || file.endsWith(".dylib"),
  )) {
    contained(directory, file);
    const binary = join(directory, file);
    if (run("/usr/bin/lipo", ["-archs", binary], undefined, true).trim() !== "arm64")
      throw new Error(`FFmpeg architecture differs: ${file}`);
    const dependencies = run("/usr/bin/otool", ["-L", binary], undefined, true)
      .split("\n")
      .slice(1)
      .map((line) => line.trim().split(" ")[0])
      .filter(Boolean);
    for (const dependency of dependencies) {
      if (dependency.startsWith("/usr/lib/") || dependency.startsWith("/System/Library/")) continue;
      if (
        dependency.startsWith("@rpath/") &&
        existsSync(join(directory, "lib", dependency.slice(7)))
      )
        continue;
      throw new Error(`Unbundled FFmpeg dependency: ${file} -> ${dependency}`);
    }
  }
  return { version, filters, encoders };
}
export async function prepareFFmpeg({
  cache = join(root, "dist/release-inputs"),
  output = defaultOutput,
  jobs = 4,
} = {}) {
  cache = resolve(cache);
  output = resolve(output);
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 8)
    throw new Error("FFmpeg build jobs must be 1–8");
  if (existsSync(output)) return verifyFFmpeg(output);
  const archive = await acquire(cache);
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw new Error("FFmpeg preparation requires an Apple Silicon Mac");
  mkdirSync(dirname(output), { recursive: true });
  const scratch = mkdtempSync(join(dirname(output), ".ffmpeg-prepare-"));
  try {
    run("/usr/bin/tar", ["-xJf", archive, "-C", scratch]);
    const source = join(scratch, `ffmpeg-${provenance.version}`);
    const staged = join(scratch, "distribution");
    console.log(`Configuring FFmpeg ${provenance.version} (${recipeSha256})`);
    run(join(source, "configure"), provenance.configure, source);
    console.log(`Building FFmpeg with ${jobs} jobs`);
    run("/usr/bin/make", [`-j${jobs}`], source);
    run("/usr/bin/make", [`DESTDIR=${staged}`, "install"], source);
    // Headers and development metadata are available in matching sources, not the runtime bundle.
    rmSync(join(staged, "include"), { recursive: true, force: true });
    rmSync(join(staged, "lib/pkgconfig"), { recursive: true, force: true });
    rmSync(join(staged, "share"), { recursive: true, force: true });
    const inventory = inspect(staged);
    const thirdParty = join(staged, "sources");
    mkdirSync(thirdParty);
    copyFileSync(archive, join(thirdParty, archiveName));
    copyFileSync(join(source, "COPYING.LGPLv2.1"), join(thirdParty, "COPYING.LGPLv2.1"));
    copyFileSync(join(source, "LICENSE.md"), join(thirdParty, "LICENSE.md"));
    copyFileSync(join(owner, "provenance.json"), join(thirdParty, "provenance.json"));
    copyFileSync(join(owner, "prepare.mjs"), join(thirdParty, "prepare.mjs"));
    writeFileSync(join(staged, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
    const identities = {};
    for (const file of files(staged).sort()) {
      contained(staged, file);
      identities[file] = await sha(join(staged, file));
    }
    const receipt = {
      format: 1,
      version: provenance.version,
      architecture: provenance.architecture,
      minimumMacOS: provenance.minimumMacOS,
      license: provenance.license,
      sourceSha256: provenance.sourceSha256,
      recipeSha256,
      files: identities,
    };
    writeFileSync(join(staged, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
    await verifyFFmpeg(staged);
    renameSync(staged, output);
    return receipt;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    const [command, ...args] = process.argv.slice(2),
      options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      if (
        !["--cache", "--output", "--jobs"].includes(key) ||
        !args[i + 1] ||
        key.slice(2) in options
      )
        throw new Error("Invalid FFmpeg preparation arguments");
      options[key.slice(2)] = key === "--jobs" ? Number(args[i + 1]) : args[i + 1];
    }
    if (command === "prepare") console.log(JSON.stringify(await prepareFFmpeg(options)));
    else if (command === "verify" && !options.cache && !options.jobs)
      console.log(JSON.stringify(await verifyFFmpeg(options.output ?? defaultOutput)));
    else
      throw new Error(
        "Usage: node helpers/ffmpeg/prepare.mjs prepare [--cache DIR] [--output DIR] [--jobs 1..8] | verify [--output DIR]",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
