#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { frameworkIdentity } from "./sparkle/framework.mjs";

const { values } = parseArgs({
  options: {
    framework: { type: "string" },
    node: { type: "string", default: process.execPath },
    output: { type: "string" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "node scripts/signing-lab.mjs --framework <Sparkle.framework> --output <receipt.json> [--node <arm64-node>]\nScratch-only signatures. No permission checks, trust changes or release keys.",
  );
  process.exit(0);
}
assert.equal(process.platform, "darwin", "the signing proof requires macOS");
assert.ok(values.framework && values.output, "--framework and --output are required");
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "screenrec-signing-"));
chmodSync(scratch, 0o700);
const keychain = join(scratch, "scratch.keychain-db");
const restoredKeychain = join(scratch, "restored.keychain-db");
const password = randomUUID();
const id = `dev.screenrec.signing-lab.${randomUUID()}`;
const receipt = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  scope: "scratch-signature-boundary; not permission testing or production acceptance",
  platform: {},
  inputs: {},
  commands: [],
  cleanup: {},
};
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
let activeChild;
let interrupted;
let cleaning = false;
function stopOwnedChild() {
  if (!activeChild) return;
  try {
    process.kill(-activeChild.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (cleaning) return;
    interrupted = new Error(`Signing lab interrupted by ${signal}`);
    stopOwnedChild();
  });
async function invoke(command, args, required = true) {
  if (interrupted && !cleaning) throw interrupted;
  const child = spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  activeChild = child;
  let stdout = "",
    stderr = "";
  child.stdout.setEncoding("utf8").on("data", (bytes) => {
    stdout += bytes;
  });
  child.stderr.setEncoding("utf8").on("data", (bytes) => {
    stderr += bytes;
  });
  const timeout = setTimeout(stopOwnedChild, 30_000);
  const result = await new Promise((resolve) => {
    child.on("error", (error) => resolve({ status: null, error }));
    child.on("close", (status) => resolve({ status }));
  });
  clearTimeout(timeout);
  activeChild = undefined;
  const record = {
    command,
    args: args.map((arg) =>
      arg.replaceAll(password, "<scratch-password>").replaceAll(scratch, "<scratch>"),
    ),
    status: result.status,
    stdout: stdout.replaceAll(password, "<scratch-password>").replaceAll(scratch, "<scratch>"),
    stderr: stderr.replaceAll(password, "<scratch-password>").replaceAll(scratch, "<scratch>"),
  };
  receipt.commands.push(record);
  if (interrupted && !cleaning) throw interrupted;
  if (required && result.status !== 0)
    throw new Error(
      `${command} failed (${result.status}): ${record.stderr || result.error?.message}`,
    );
  return record;
}
const searchList = async () =>
  (await invoke("security", ["list-keychains", "-d", "user"])).stdout
    .match(/"([^"]+)"/g)
    ?.map((item) => item.slice(1, -1)) ?? [];
let originalSearch;
async function removeScratchSearchEntries() {
  const current = await searchList();
  const remaining = current.filter((path) => !path.startsWith("<scratch>/"));
  if (remaining.length !== current.length)
    await invoke("security", ["list-keychains", "-d", "user", "-s", ...remaining]);
}
let failure;
async function makeIdentity(label) {
  const prefix = join(scratch, label);
  writeFileSync(
    `${prefix}.cnf`,
    `[req]\ndistinguished_name=name\nx509_extensions=signing\nprompt=no\n[name]\nCN=Screenrec Scratch ${label} ${id.slice(-16)}\n[signing]\nbasicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,codeSigning\n`,
    { mode: 0o600 },
  );
  await invoke("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:3072",
    "-sha256",
    "-days",
    "2",
    "-nodes",
    "-keyout",
    `${prefix}.key`,
    "-out",
    `${prefix}.crt`,
    "-config",
    `${prefix}.cnf`,
  ]);
  await invoke("openssl", [
    "pkcs12",
    "-export",
    "-inkey",
    `${prefix}.key`,
    "-in",
    `${prefix}.crt`,
    "-out",
    `${prefix}.p12`,
    "-macalg",
    "sha1",
    "-keypbe",
    "PBE-SHA1-3DES",
    "-certpbe",
    "PBE-SHA1-3DES",
    "-passout",
    `pass:${password}`,
  ]);
  await invoke("security", [
    "import",
    `${prefix}.p12`,
    "-k",
    keychain,
    "-P",
    password,
    "-T",
    "/usr/bin/codesign",
  ]);
  const fingerprint = async (algorithm) =>
    (
      await invoke("openssl", [
        "x509",
        "-in",
        `${prefix}.crt`,
        "-noout",
        "-fingerprint",
        `-${algorithm}`,
      ])
    ).stdout
      .trim()
      .split("=")
      .at(-1)
      .replaceAll(":", "")
      .toLowerCase();
  return { sha1: await fingerprint("sha1"), sha256: await fingerprint("sha256") };
}
function codePaths(app) {
  const executables = [],
    bundles = [];
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name));
      if (/\.(app|xpc|framework)$/.test(path)) bundles.push(path);
    } else if (
      stat.isFile() &&
      /^(cafebabe|bebafeca|feedface|cefaedfe|feedfacf|cffaedfe)$/.test(
        readFileSync(path).subarray(0, 4).toString("hex"),
      )
    )
      executables.push(path);
  }
  visit(app);
  return { executables, bundles };
}
async function sign(app, identity, signingKeychain = keychain) {
  const { executables, bundles } = codePaths(app);
  for (const path of [...executables, ...bundles])
    await invoke("codesign", [
      "--force",
      "--sign",
      identity,
      "--keychain",
      signingKeychain,
      "--timestamp=none",
      path,
    ]);
  for (const path of executables) await invoke("codesign", ["--verify", "--strict", path]);
  return await invoke("codesign", ["--verify", "--deep", "--strict", app]);
}
const requirement = async (app) =>
  (await invoke("codesign", ["-d", "-r-", app])).stdout
    .trim()
    .replace(/^(?:# )?designated => /, "");
async function facts(app) {
  return {
    requirement: await requirement(app),
    executableSha256: sha(join(app, "Contents/MacOS/SigningProbe")),
    verify: await invoke("codesign", ["--verify", "--deep", "--strict", app]),
    runtime: JSON.parse((await invoke(join(app, "Contents/MacOS/SigningProbe"), [])).stdout),
  };
}
try {
  originalSearch = await searchList();
  receipt.platform.os = (await invoke("sw_vers", [])).stdout;
  receipt.platform.xcode = (await invoke("xcodebuild", ["-version"])).stdout;
  receipt.platform.architecture = (await invoke("uname", ["-m"])).stdout.trim();
  receipt.inputs.frameworkSha256 = frameworkIdentity(values.framework).sha256;
  receipt.inputs.frameworkVersion = (
    await invoke("/usr/libexec/PlistBuddy", [
      "-c",
      "Print :CFBundleShortVersionString",
      join(values.framework, "Resources/Info.plist"),
    ])
  ).stdout.trim();
  receipt.inputs.nodeSha256 = sha(values.node);
  receipt.inputs.nodeVersion = (await invoke(values.node, ["--version"])).stdout.trim();
  receipt.inputs.nodeArchitecture = (await invoke("lipo", ["-archs", values.node])).stdout.trim();
  assert.equal(receipt.inputs.nodeArchitecture, "arm64");
  receipt.inputs.sourceRevision = (
    await invoke("git", ["-C", sourceRoot, "rev-parse", "HEAD"])
  ).stdout.trim();
  receipt.inputs.runnerSha256 = sha(fileURLToPath(import.meta.url));
  receipt.inputs.nativeSourceSha256 = sha(join(sourceRoot, "scripts/signing-lab/main.m"));
  receipt.inputs.frameworkIdentitySourceSha256 = sha(
    join(sourceRoot, "scripts/sparkle/framework.mjs"),
  );
  await invoke("security", ["create-keychain", "-p", password, keychain]);
  // Creation may add the file-backed scratch keychain. Restore the account list immediately.
  await removeScratchSearchEntries();
  await invoke("security", ["unlock-keychain", "-p", password, keychain]);
  receipt.certificate = await makeIdentity("stable");
  receipt.otherCertificate = await makeIdentity("other");
  receipt.identityPolicy = await invoke("security", [
    "find-identity",
    "-p",
    "codesigning",
    keychain,
  ]);
  const app = join(scratch, "Signing Probe.app");
  mkdirSync(join(app, "Contents/MacOS"), { recursive: true });
  mkdirSync(join(app, "Contents/Frameworks"));
  mkdirSync(join(app, "Contents/Resources/node/bin"), { recursive: true });
  await invoke("ditto", [values.framework, join(app, "Contents/Frameworks/Sparkle.framework")]);
  copyFileSync(values.node, join(app, "Contents/Resources/node/bin/node"));
  const compile = async (optimization) =>
    await invoke("xcrun", [
      "clang",
      "-fobjc-arc",
      optimization,
      "-F",
      join(app, "Contents/Frameworks"),
      "-framework",
      "AppKit",
      "-framework",
      "AVFoundation",
      "-framework",
      "CoreGraphics",
      "-framework",
      "Sparkle",
      "-Wl,-rpath,@executable_path/../Frameworks",
      join(sourceRoot, "scripts/signing-lab/main.m"),
      "-o",
      join(app, "Contents/MacOS/SigningProbe"),
    ]);
  await compile("-O0");
  const info = (version) =>
    writeFileSync(
      join(app, "Contents/Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleExecutable</key><string>SigningProbe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>${version}</string><key>CFBundleShortVersionString</key><string>${version}</string><key>LSUIElement</key><true/></dict></plist>`,
    );
  info("1.0.0");
  await sign(app, "-");
  receipt.a = await facts(app);
  await sign(app, receipt.certificate.sha1);
  receipt.b = await facts(app);
  receipt.b.matchesARequirement = await invoke(
    "codesign",
    ["--verify", "--strict", "-R", `=${receipt.a.requirement}`, app],
    false,
  );
  await compile("-O2");
  info("1.0.1");
  await invoke("security", ["create-keychain", "-p", password, restoredKeychain]);
  await removeScratchSearchEntries();
  await invoke("security", ["unlock-keychain", "-p", password, restoredKeychain]);
  await invoke("security", [
    "import",
    join(scratch, "stable.p12"),
    "-k",
    restoredKeychain,
    "-P",
    password,
    "-T",
    "/usr/bin/codesign",
  ]);
  await sign(app, receipt.certificate.sha1, restoredKeychain);
  receipt.c = await facts(app);
  receipt.c.restoredFromEncryptedPKCS12 = true;
  receipt.c.nestedSignatures = [];
  for (const path of codePaths(app).executables)
    receipt.c.nestedSignatures.push({
      path: path.slice(app.length + 1),
      requirement: await requirement(path),
      sha256: sha(path),
    });
  receipt.c.matchesBRequirement = await invoke(
    "codesign",
    ["--verify", "--strict", "-R", `=${receipt.b.requirement}`, app],
    false,
  );
  const moved = join(scratch, "relocated", "Signing Probe.app");
  await invoke("ditto", [app, moved]);
  receipt.relocated = await facts(moved);
  receipt.relocated.nodeVersion = (
    await invoke(join(moved, "Contents/Resources/node/bin/node"), ["--version"])
  ).stdout.trim();
  receipt.signedFrameworkSha256 = frameworkIdentity(
    join(moved, "Contents/Frameworks/Sparkle.framework"),
  ).sha256;
  const other = join(scratch, "Other Probe.app");
  await invoke("ditto", [app, other]);
  await sign(other, receipt.otherCertificate.sha1);
  receipt.other = {
    requirement: await requirement(other),
    matchesBRequirement: await invoke(
      "codesign",
      ["--verify", "--strict", "-R", `=${receipt.b.requirement}`, other],
      false,
    ),
  };
  writeFileSync(join(app, "Contents/Resources/node/bin/node"), "tampered", { flag: "a" });
  receipt.tampered = {
    verify: await invoke("codesign", ["--verify", "--deep", "--strict", app], false),
  };
} catch (error) {
  failure = error;
  receipt.error = error.message;
} finally {
  cleaning = true;
  try {
    for (const path of [keychain, restoredKeychain])
      if (existsSync(path)) await invoke("security", ["delete-keychain", path], false);
    receipt.cleanup.keychainDeleted = !existsSync(keychain) && !existsSync(restoredKeychain);
    if (originalSearch) {
      await removeScratchSearchEntries();
      receipt.cleanup.searchListRestored =
        JSON.stringify(await searchList()) === JSON.stringify(originalSearch);
    }
  } catch (error) {
    receipt.cleanup.error = error.message;
    failure ??= error;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    receipt.cleanup.privateMaterialDeleted = !existsSync(scratch);
    writeFileSync(resolve(values.output), JSON.stringify(receipt, null, 2) + "\n");
  }
}
if (failure) throw failure;
