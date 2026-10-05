import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { withReleaseIdentity } from "./release-signing.mjs";

test("the release signing setup carries certificate DER as binary and removes its private scratch inputs", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-signing-input-"));
  const previousPath = process.env.PATH;
  let privateDirectory;
  try {
    const der = Buffer.from([0x30, 0xff, 0, 0x80, 0x7f]);
    writeFileSync(
      join(scratch, "openssl"),
      `#!${process.execPath}\nif(process.argv[2]==='pkcs12')console.log('fixture PEM certificate');else process.stdout.write(Buffer.from(${JSON.stringify([...der])}));\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(scratch, "security"),
      `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);if(args[0]==='create-keychain')fs.writeFileSync(args.at(-1),'scratch');if(args[0]==='delete-keychain')fs.unlinkSync(args.at(-1));\n`,
      { mode: 0o755 },
    );
    process.env.PATH = `${scratch}:${previousPath}`;
    const result = await withReleaseIdentity(
      {
        p12: Buffer.from("fixture-import-bytes"),
        password: "fixture-secret-not-logged",
        sha1: createHash("sha1").update(der).digest("hex"),
        certificateSha256: createHash("sha256").update(der).digest("hex"),
        secret: "fixture-update-secret-not-logged",
      },
      ({ keychain, keyFile, identity }) => {
        privateDirectory = join(keychain, "..");
        assert.equal(readFileSync(keyFile, "utf8"), "fixture-update-secret-not-logged\n");
        assert.equal(identity, createHash("sha1").update(der).digest("hex"));
        return "signed-input-ready";
      },
    );
    assert.equal(result, "signed-input-ready");
    assert.equal(existsSync(privateDirectory), false);
  } finally {
    process.env.PATH = previousPath;
    rmSync(scratch, { recursive: true, force: true });
  }
});
