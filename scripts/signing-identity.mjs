// A stable local code-signing identity for this person's own builds.
//
// An ad-hoc signature changes with every build, and macOS keys screen and microphone access to the
// signature it saw, so each install asks for permissions again. One self-signed certificate, kept in
// the login keychain and never in this repository, gives every build the same identity instead.
//
//   node scripts/signing-identity.mjs            # create it if it is missing, then print its name
//   node scripts/signing-identity.mjs --find     # print the name only if it already exists
//
// The private key stays in the keychain. A certificate is a credential: committing one would let
// anyone sign builds this Mac then trusts as this app.
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export const identityName = "Yap Local";
const keychain = execFileSync("security", ["default-keychain"], { encoding: "utf8" })
  .trim()
  .replace(/^"|"$/g, "");

/** The identity's name when the keychain already holds one that can sign code. */
export function findIdentity() {
  const listed = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
  });
  return listed.includes(identityName) ? identityName : undefined;
}

function create() {
  const work = mkdtempSync("/tmp/yap-identity-");
  try {
    // Code signing needs the certificate to say it is for code signing, which `openssl req` only
    // writes from a config file.
    const config = join(work, "openssl.cnf");
    writeFileSync(
      config,
      `[req]
distinguished_name = name
x509_extensions = signing
prompt = no
[name]
CN = ${identityName}
[signing]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
`,
    );
    const key = join(work, "identity.key"),
      certificate = join(work, "identity.crt"),
      bundle = join(work, "identity.p12");
    run("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:3072",
      "-sha256",
      "-days",
      "3650",
      "-nodes",
      "-keyout",
      key,
      "-out",
      certificate,
      "-config",
      config,
    ]);
    // The keychain refuses a PKCS#12 bundle with no password, and reads only the older
    // algorithms, so the transfer carries a throwaway one that never leaves this function.
    const passphrase = randomUUID();
    run("openssl", [
      "pkcs12",
      "-export",
      "-inkey",
      key,
      "-in",
      certificate,
      "-out",
      bundle,
      "-name",
      identityName,
      "-macalg",
      "sha1",
      "-keypbe",
      "PBE-SHA1-3DES",
      "-certpbe",
      "PBE-SHA1-3DES",
      "-passout",
      `pass:${passphrase}`,
    ]);
    // `-T /usr/bin/codesign` is the whole access list this key gets: signing may use it without a
    // password prompt, and nothing else on this Mac may use it at all. `-A`, which would let any
    // program use it silently, is deliberately not passed — a local signing key is still a key in
    // this person's login keychain.
    run("security", [
      "import",
      bundle,
      "-k",
      keychain,
      "-P",
      passphrase,
      "-T",
      "/usr/bin/codesign",
    ]);
    // Signing checks the certificate chain, so this Mac must trust its own root for code signing.
    // This is the one step that asks the person for their password. If it fails — or they cancel
    // it — the half-made identity goes back out of their keychain, because an untrusted one is
    // found by nothing and would only be imported again beside itself on the next run.
    try {
      run("security", [
        "add-trusted-cert",
        "-r",
        "trustRoot",
        "-p",
        "codeSign",
        "-k",
        keychain,
        certificate,
      ]);
    } catch (error) {
      try {
        run("security", ["delete-identity", "-c", identityName, keychain]);
      } catch {
        // Nothing was left behind to remove, or it is already gone.
      }
      throw error;
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0)
    throw new Error(`${command} ${args[0]} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

if (process.argv[1]?.endsWith("signing-identity.mjs")) {
  // Only the command reads arguments: importers pass their own.
  const { values } = parseArgs({ options: { find: { type: "boolean", default: false } } });
  const existing = findIdentity();
  if (existing) console.log(existing);
  else if (values.find) process.exitCode = 1;
  else {
    create();
    const created = findIdentity();
    if (!created) {
      console.error(`Created a certificate, but ${identityName} cannot sign code yet.`);
      process.exitCode = 1;
    } else console.log(created);
  }
}
