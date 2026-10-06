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
const buildEnvironment = {
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LC_ALL: "C",
  CC: "/usr/bin/clang",
  CXX: "/usr/bin/clang++",
  MACOSX_DEPLOYMENT_TARGET: provenance.minimumMacOS,
};
function run(command, args, cwd, capture = false, env = buildEnvironment) {
  return execFileSync(command, args, {
    cwd,
    env,
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
  for (const dependency of provenance.dependencies ?? []) {
    const archive = `sources/${dependency.archive}`;
    const notice = `sources/${dependency.name}-${dependency.licenseFile}`;
    if (receipt.files[archive] !== dependency.sourceSha256 || !receipt.files[notice])
      throw new Error(`Missing pinned dependency source/notice: ${dependency.name}`);
    if (dependency.role === "runtime" && !receipt.files[`lib/${dependency.build.library}`])
      throw new Error(`Missing pinned runtime library: ${dependency.name}`);
  }
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
async function acquire(cache, source = { archive: archiveName, ...provenance }) {
  mkdirSync(cache, { recursive: true });
  const archive = join(cache, source.archive);
  if (existsSync(archive)) {
    await checksum(archive, source.sourceSha256);
    return archive;
  }
  const temporary = `${archive}.part-${process.pid}`;
  try {
    const answer = await fetch(source.sourceUrl, { signal: AbortSignal.timeout(300_000) });
    if (!answer.ok) throw new Error(`FFmpeg source download failed (${answer.status})`);
    await pipeline(answer.body, createWriteStream(temporary, { flags: "wx" }));
    await checksum(temporary, source.sourceSha256);
    renameSync(temporary, archive);
    return archive;
  } finally {
    rmSync(temporary, { force: true });
  }
}
function buildDependencies(scratch, archives, jobs) {
  const prefix = join(scratch, "dependencies");
  const tools = join(scratch, "build-tools");
  for (const dependency of provenance.dependencies ?? [])
    run("/usr/bin/tar", ["-xf", archives.get(dependency.name), "-C", scratch]);
  const zimg = provenance.dependencies?.find((value) => value.name === "zimg");
  const pkgconf = provenance.dependencies?.find((value) => value.name === "pkgconf");
  if (!zimg || !pkgconf)
    throw new Error("Frozen FFmpeg recipe requires zimg and build-only pkgconf");
  const zimgSource = join(scratch, zimg.directory);
  const upstream = readFileSync(join(zimgSource, zimg.build.sourceManifest), "utf8");
  const [scalarSection, armSection] = zimg.build.sourceSections;
  const scalar = upstream
    .split(`${scalarSection} =`)[1]
    ?.split(scalarSection.replace(/SOURCES$/, "CPPFLAGS"))[0];
  const arm = upstream.split(`if ${armSection}`)[1]?.split(`endif # ${armSection}`)[0];
  if (!scalar || !arm) throw new Error("Pinned zimg source manifest sections are unavailable");
  const sources = [...new Set((scalar + arm).match(/src\/zimg\/[\w/]+\.cpp/g))];
  if (!sources.length) throw new Error("Pinned zimg source manifest has no build operands");
  mkdirSync(join(prefix, "lib/pkgconfig"), { recursive: true });
  mkdirSync(join(prefix, "include"));
  const compiler = [
    ...zimg.build.flags,
    `-I${join(zimgSource, "src/zimg")}`,
    ...sources.map((file) => join(zimgSource, file)),
    "-o",
    join(prefix, "lib", zimg.build.library),
  ];
  run(zimg.build.compiler, compiler, zimgSource);
  // FFmpeg's pkg-config check links the unversioned development name; runtime uses @rpath.
  copyFileSync(join(prefix, "lib", zimg.build.library), join(prefix, "lib/libzimg.dylib"));
  for (const header of ["zimg.h", "zimg++.hpp"])
    copyFileSync(join(zimgSource, "src/zimg/api", header), join(prefix, "include", header));
  writeFileSync(
    join(prefix, "lib/pkgconfig/zimg.pc"),
    `prefix=${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include
Name: zimg
Description: pinned color conversion dependency
Version: ${zimg.version}
Libs: -L\${libdir} -lzimg
Cflags: -I\${includedir}
`,
  );
  const pkgSource = join(scratch, pkgconf.directory);
  const toolFlags = [`--prefix=${tools}`, ...pkgconf.build.configure];
  run(join(pkgSource, "configure"), toolFlags, pkgSource, false, {
    ...buildEnvironment,
    CFLAGS: `-mmacosx-version-min=${provenance.minimumMacOS}`,
    LDFLAGS: `-mmacosx-version-min=${provenance.minimumMacOS}`,
  });
  run("/usr/bin/make", [`-j${jobs}`], pkgSource);
  run("/usr/bin/make", ["install"], pkgSource);
  return {
    prefix,
    tools,
    zimg,
    commands: {
      zimg: { compiler: zimg.build.compiler, args: compiler },
      pkgconf: { configure: toolFlags },
    },
  };
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
  const dependencyArchives = new Map();
  for (const dependency of provenance.dependencies ?? [])
    dependencyArchives.set(dependency.name, await acquire(cache, dependency));
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw new Error("FFmpeg preparation requires an Apple Silicon Mac");
  mkdirSync(dirname(output), { recursive: true });
  // Upstream configure/pkg-config split dependency paths. Keep compilation in a
  // whitespace-free private directory; publication still commits beside output.
  const scratch = mkdtempSync("/tmp/yap-ffmpeg-prepare-");
  let publication;
  try {
    publication = mkdtempSync(join(dirname(output), ".ffmpeg-publish-"));
    run("/usr/bin/tar", ["-xJf", archive, "-C", scratch]);
    const source = join(scratch, `ffmpeg-${provenance.version}`);
    const staged = join(scratch, "distribution");
    const dependencies = buildDependencies(scratch, dependencyArchives, jobs);
    const configure = provenance.configure.map((flag) =>
      flag.startsWith("--extra-cflags=")
        ? `${flag} -I${join(dependencies.prefix, "include")}`
        : flag.startsWith("--extra-ldflags=")
          ? `${flag} -L${join(dependencies.prefix, "lib")}`
          : flag,
    );
    configure.push(`--pkg-config=${join(dependencies.tools, "bin/pkgconf")}`);
    const env = {
      ...buildEnvironment,
      PKG_CONFIG_LIBDIR: join(dependencies.prefix, "lib/pkgconfig"),
      PKG_CONFIG_PATH: "",
    };
    console.log(`Configuring FFmpeg ${provenance.version} (${recipeSha256})`);
    run(join(source, "configure"), configure, source, false, env);
    console.log(`Building FFmpeg with ${jobs} jobs`);
    run("/usr/bin/make", [`-j${jobs}`], source);
    run("/usr/bin/make", [`DESTDIR=${staged}`, "install"], source);
    // Headers and development metadata are available in matching sources, not the runtime bundle.
    rmSync(join(staged, "include"), { recursive: true, force: true });
    rmSync(join(staged, "lib/pkgconfig"), { recursive: true, force: true });
    rmSync(join(staged, "share"), { recursive: true, force: true });
    copyFileSync(
      join(dependencies.prefix, "lib", dependencies.zimg.build.library),
      join(staged, "lib", dependencies.zimg.build.library),
    );
    const inventory = inspect(staged);
    const thirdParty = join(staged, "sources");
    mkdirSync(thirdParty);
    copyFileSync(archive, join(thirdParty, archiveName));
    copyFileSync(join(source, "COPYING.LGPLv2.1"), join(thirdParty, "COPYING.LGPLv2.1"));
    copyFileSync(join(source, "LICENSE.md"), join(thirdParty, "LICENSE.md"));
    copyFileSync(join(owner, "provenance.json"), join(thirdParty, "provenance.json"));
    copyFileSync(join(owner, "prepare.mjs"), join(thirdParty, "prepare.mjs"));
    for (const dependency of provenance.dependencies ?? []) {
      copyFileSync(dependencyArchives.get(dependency.name), join(thirdParty, dependency.archive));
      copyFileSync(
        join(scratch, dependency.directory, dependency.licenseFile),
        join(thirdParty, `${dependency.name}-${dependency.licenseFile}`),
      );
    }
    writeFileSync(
      join(thirdParty, "build.json"),
      JSON.stringify(
        { configure, environment: env, dependencies: dependencies.commands },
        null,
        2,
      ) + "\n",
    );
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
      dependencies: provenance.dependencies.map(({ build: _build, ...source }) => source),
      files: identities,
    };
    writeFileSync(join(staged, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
    await verifyFFmpeg(staged);
    const ready = join(publication, "distribution");
    try {
      renameSync(staged, ready);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      cpSync(staged, ready, { recursive: true, verbatimSymlinks: true });
      await verifyFFmpeg(ready);
    }
    renameSync(ready, output);
    return receipt;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    if (publication) rmSync(publication, { recursive: true, force: true });
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
