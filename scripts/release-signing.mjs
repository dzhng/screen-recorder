import { spawnSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const required = [
  "SCREENREC_RELEASE_IDENTITY_P12",
  "SCREENREC_RELEASE_IDENTITY_PASSWORD",
  "SCREENREC_RELEASE_IDENTITY_SHA1",
  "SCREENREC_RELEASE_CERTIFICATE_SHA256",
  "SCREENREC_SPARKLE_PRIVATE_KEY",
  "SCREENREC_SPARKLE_PUBLIC_KEY",
];
export function releaseSigningInputs(env = process.env) {
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing release signing inputs: ${missing.join(", ")}`);
  const sha1 = env.SCREENREC_RELEASE_IDENTITY_SHA1.toLowerCase();
  const certificateSha256 = env.SCREENREC_RELEASE_CERTIFICATE_SHA256.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha1) || !/^[0-9a-f]{64}$/.test(certificateSha256))
    throw new Error("Release certificate fingerprints must be SHA-1 and SHA-256 hex");
  const decode = (value, size, name) => {
    const bytes = Buffer.from(value, "base64");
    if (bytes.toString("base64") !== value || (size && bytes.length !== size))
      throw new Error(`Invalid ${name}`);
    return bytes;
  };
  const p12 = decode(env.SCREENREC_RELEASE_IDENTITY_P12, undefined, "release PKCS#12");
  const secret = decode(env.SCREENREC_SPARKLE_PRIVATE_KEY, 32, "Sparkle private seed");
  const publicKey = decode(env.SCREENREC_SPARKLE_PUBLIC_KEY, 32, "Sparkle public key");
  const privateKey = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      secret.subarray(0, 32),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const derived = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32);
  if (!derived.equals(publicKey))
    throw new Error("Sparkle public key does not match the supplied private seed");
  return {
    p12,
    password: env.SCREENREC_RELEASE_IDENTITY_PASSWORD,
    sha1,
    certificateSha256,
    secret: env.SCREENREC_SPARKLE_PRIVATE_KEY,
    publicKey: publicKey.toString("base64"),
  };
}

// Tool diagnostics can contain imported secrets. Never forward their output or arguments on failure.
function secureRun(command, args, options = {}) {
  const answer = spawnSync(command, args, { encoding: "utf8", timeout: 30_000, ...options });
  if (answer.error || answer.status !== 0) throw new Error(`${command} ${args[0]} failed`);
  return answer.stdout;
}
export async function withReleaseIdentity(inputs, action) {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "screenrec-release-signing-")));
  const keychain = join(scratch, "signing.keychain-db");
  const password = randomUUID();
  const searchList = () =>
    [...secureRun("security", ["list-keychains", "-d", "user"]).matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    );
  const removeOwnedSearchEntry = () => {
    const current = searchList();
    const remaining = current.filter((path) => path !== keychain);
    if (current.length !== remaining.length)
      secureRun("security", ["list-keychains", "-d", "user", "-s", ...remaining]);
  };
  const cleanup = () => {
    try {
      if (existsSync(keychain)) secureRun("security", ["delete-keychain", keychain]);
    } finally {
      try {
        removeOwnedSearchEntry();
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  };
  const interrupt = (status) => {
    try {
      cleanup();
    } catch {
      console.error("Release signing cleanup failed");
    }
    process.exit(status);
  };
  const sigint = () => interrupt(130),
    sigterm = () => interrupt(143);
  process.once("SIGINT", sigint);
  process.once("SIGTERM", sigterm);
  try {
    const p12 = join(scratch, "identity.p12");
    writeFileSync(p12, inputs.p12, { mode: 0o600 });
    const certificate = secureRun(
      "openssl",
      ["pkcs12", "-in", p12, "-clcerts", "-nokeys", "-passin", "stdin"],
      { input: inputs.password + "\n" },
    );
    const der = Buffer.from(
      secureRun("openssl", ["x509", "-outform", "DER"], { input: certificate, encoding: "buffer" }),
    );
    for (const [algorithm, expected] of [
      ["sha1", inputs.sha1],
      ["sha256", inputs.certificateSha256],
    ])
      if (createHash(algorithm).update(der).digest("hex") !== expected)
        throw new Error("Imported release certificate does not match its pinned fingerprint");
    secureRun("security", ["create-keychain", "-p", password, keychain]);
    removeOwnedSearchEntry();
    secureRun("security", ["unlock-keychain", "-p", password, keychain]);
    secureRun("security", [
      "import",
      p12,
      "-k",
      keychain,
      "-P",
      inputs.password,
      "-T",
      "/usr/bin/codesign",
    ]);
    const keyFile = join(scratch, "sparkle.key");
    writeFileSync(keyFile, inputs.secret + "\n", { mode: 0o600 });
    return await action({ keychain, keyFile, identity: inputs.sha1 });
  } finally {
    process.removeListener("SIGINT", sigint);
    process.removeListener("SIGTERM", sigterm);
    cleanup();
  }
}

export function signReleaseTree(app, identity, keychain) {
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
  for (const path of [...executables, ...bundles])
    secureRun("codesign", [
      "--force",
      "--sign",
      identity,
      ...(keychain ? ["--keychain", keychain] : []),
      "--timestamp=none",
      path,
    ]);
  for (const path of executables) secureRun("codesign", ["--verify", "--strict", path]);
  secureRun("codesign", ["--verify", "--deep", "--strict", app]);
}
