import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { withReleaseIdentity, signReleaseTree } from "./release-signing.mjs";

test("the release signing setup carries certificate DER as binary and removes its private scratch inputs", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-signing-input-"));
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

async function headlessFixture(
  action,
  {
    partitionFailure = false,
    signingFailure = "",
    password = "fixture-private-secret",
    secret = "fixture-update-secret",
  } = {},
) {
  const scratch = mkdtempSync(join(tmpdir(), "yap-headless-signing-"));
  const previousPath = process.env.PATH;
  const searchList = join(scratch, "search-list.json");
  writeFileSync(
    searchList,
    JSON.stringify(["/fixture/login.keychain-db", "/fixture/custom.keychain-db"]),
  );
  const der = Buffer.from([0x30, 0xff, 0, 0x80, 0x7f]);
  try {
    writeFileSync(
      join(scratch, "openssl"),
      `#!${process.execPath}
if(process.argv[2]==='pkcs12')console.log('fixture certificate');else process.stdout.write(Buffer.from(${JSON.stringify([...der])}));
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(scratch, "security"),
      `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);const path=args.at(-1);
const searchList=${JSON.stringify(searchList)};
if(args[0]==='list-keychains') {
 if(args.includes('-s'))fs.writeFileSync(searchList,JSON.stringify(args.slice(args.indexOf('-s')+1)));
 else for(const name of JSON.parse(fs.readFileSync(searchList)))console.log(JSON.stringify(name));
}
if(args[0]==='create-keychain') { fs.writeFileSync(path,JSON.stringify({password:args[2]}));fs.writeFileSync(${JSON.stringify(join(scratch, "created-keychain-path"))},path);fs.writeFileSync(searchList,JSON.stringify([path,...JSON.parse(fs.readFileSync(searchList))])); }
if(args[0]==='import') { const file=args[args.indexOf('-k')+1];const key=JSON.parse(fs.readFileSync(file));key.imported=args.includes('-T')&&args.includes('/usr/bin/codesign');fs.writeFileSync(file,JSON.stringify(key)); }
if(args[0]==='set-key-partition-list') {
 if(${partitionFailure}) { console.error('fixture-private-secret');process.exit(51); }
 const key=JSON.parse(fs.readFileSync(path));
 key.allowed=key.imported&&args[args.indexOf('-S')+1]==='apple-tool:,apple:,codesign:'&&args.includes('-s')&&args[args.indexOf('-k')+1]===key.password;
 fs.writeFileSync(path,JSON.stringify(key));
}
if(args[0]==='delete-keychain')fs.unlinkSync(path);
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(scratch, "codesign"),
      `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);
if(args.includes('--sign')) {
 const key=JSON.parse(fs.readFileSync(args[args.indexOf('--keychain')+1]));
 const searchable=JSON.parse(fs.readFileSync(${JSON.stringify(searchList)})).includes(args[args.indexOf('--keychain')+1]);
 const error=${JSON.stringify(signingFailure)}||(!searchable?'no identity found':!key.allowed?'errSecInternalComponent fixture-private-secret':'');
 if(error) { console.error(error+' '+key.password);process.exit(1); }
 fs.writeFileSync(args.at(-1)+'.signed','signed');
}
`,
      { mode: 0o755 },
    );
    process.env.PATH = `${scratch}:${previousPath}`;
    const executable = join(scratch, "executable");
    writeFileSync(executable, Buffer.from("feedfacf00000000", "hex"));
    return await action({
      scratch,
      executable,
      inputs: {
        p12: Buffer.from("fixture-import"),
        password,
        sha1: createHash("sha1").update(der).digest("hex"),
        certificateSha256: createHash("sha256").update(der).digest("hex"),
        secret,
      },
    });
  } finally {
    process.env.PATH = previousPath;
    rmSync(scratch, { recursive: true, force: true });
  }
}

test("headless signing grants private-key partitions in only the owned keychain and cleans it afterward", async () => {
  await headlessFixture(async ({ inputs, executable }) => {
    let privateDirectory;
    await withReleaseIdentity(inputs, ({ keychain, identity }) => {
      privateDirectory = join(keychain, "..");
      signReleaseTree(executable, identity, keychain);
      assert.equal(readFileSync(executable + ".signed", "utf8"), "signed");
    });
    assert.equal(existsSync(privateDirectory), false);
  });
});

test("a denied partition grant aborts before signing and retains no imported private files", async () => {
  await headlessFixture(
    async ({ inputs, scratch }) => {
      let reached = false;
      await assert.rejects(
        withReleaseIdentity(inputs, () => {
          reached = true;
        }),
        {
          message: "security set-key-partition-list failed",
        },
      );
      assert.equal(reached, false);
      assert.equal(
        existsSync(join(readFileSync(join(scratch, "created-keychain-path"), "utf8"), "..")),
        false,
      );
    },
    { partitionFailure: true },
  );
});

test("codesign failure preserves known diagnostics while redacting supplied credential values", async () => {
  await headlessFixture(
    async ({ inputs, executable }) => {
      await assert.rejects(
        withReleaseIdentity(inputs, ({ keychain, identity }) => {
          signReleaseTree(executable, identity, keychain);
        }),
        (error) => {
          assert.match(error.message, /codesign --force failed/);
          assert.match(error.message, /errSecInternalComponent/);
          assert.equal(error.message.includes("fixture-private-secret"), false);
          return true;
        },
      );
    },
    { signingFailure: "errSecInternalComponent fixture-private-secret" },
  );
});

test("unknown codesign failures identify the owned relative path and bounded escaped stderr without credential values", async () => {
  await headlessFixture(
    async ({ inputs, executable, scratch }) => {
      const app = join(scratch, "Owned.app");
      const worker = join(app, "Contents/MacOS/Worker");
      mkdirSync(join(app, "Contents/MacOS"), { recursive: true });
      writeFileSync(worker, readFileSync(executable));
      let ephemeralPassword;
      await assert.rejects(
        withReleaseIdentity(inputs, ({ keychain, identity }) => {
          ephemeralPassword = JSON.parse(readFileSync(keychain, "utf8")).password;
          signReleaseTree(app, identity, keychain);
        }),
        (error) => {
          assert.match(error.message, /Contents\/MacOS\/Worker/);
          assert.match(error.message, /resource fork, Finder information/);
          assert.match(error.message, /"status":1/);
          assert.equal(error.message.includes("fixture-private-secret"), false);
          assert.equal(error.message.includes(ephemeralPassword), false);
          assert.equal(error.message.includes("fixture-update-secret"), false);
          assert.equal(
            error.message.includes(Buffer.from("fixture-import").toString("base64")),
            false,
          );
          assert.equal(error.message.includes("\n"), false);
          assert.ok(error.message.length < 4500);
          return true;
        },
      );
    },
    {
      signingFailure:
        "resource fork, Finder information, or similar detritus not allowed\nfixture-private-secret fixture-update-secret " +
        Buffer.from("fixture-import").toString("base64") +
        " " +
        "x".repeat(6000),
    },
  );
});

test("overlapping supplied private values are completely removed from the original diagnostic", async () => {
  for (const fixture of [
    {
      password: "fixture",
      secret: "fixture-update-secret",
      signingFailure: "fixture-update-secret",
    },
    { password: "abcd", secret: "cdef", signingFailure: "abcdef" },
  ]) {
    await headlessFixture(async ({ inputs, executable }) => {
      await assert.rejects(
        withReleaseIdentity(inputs, ({ keychain, identity }) => {
          signReleaseTree(executable, identity, keychain);
        }),
        (error) => {
          const diagnostic = JSON.parse(error.message.slice(error.message.indexOf("{")));
          assert.equal(diagnostic.stderr, "<redacted> <redacted>\n");
          return true;
        },
      );
    }, fixture);
  }
});

test("the owned signing keychain remains appended during the action and cleanup preserves concurrent unrelated entries", async () => {
  await headlessFixture(async ({ inputs, executable, scratch }) => {
    const list = join(scratch, "search-list.json");
    const original = JSON.parse(readFileSync(list));
    await withReleaseIdentity(inputs, ({ keychain, identity }) => {
      assert.deepEqual(JSON.parse(readFileSync(list)), [...original, keychain]);
      signReleaseTree(executable, identity, keychain);
      const concurrent = [...JSON.parse(readFileSync(list)), "/fixture/concurrent.keychain-db"];
      writeFileSync(list, JSON.stringify(concurrent));
    });
    assert.deepEqual(JSON.parse(readFileSync(list)), [
      ...original,
      "/fixture/concurrent.keychain-db",
    ]);
  });
});

test("already sealed media resources retain their bytes while enclosing bundles are signed and verified", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-sealed-signing-"));
  const previousPath = process.env.PATH;
  try {
    const app = join(scratch, "Media.app");
    const media = join(app, "Contents/Resources/ffmpeg/bin/ffmpeg");
    const worker = join(app, "Contents/MacOS/Worker");
    mkdirSync(join(media, ".."), { recursive: true });
    mkdirSync(join(worker, ".."), { recursive: true });
    const sealed = Buffer.from("feedfacf00000000", "hex");
    writeFileSync(media, sealed);
    writeFileSync(worker, sealed);
    writeFileSync(
      join(scratch, "codesign"),
      `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2),target=args.at(-1);
if(args.includes('--sign')&&fs.statSync(target).isFile())fs.appendFileSync(target,'signed');
if(args.includes('--verify')&&target===${JSON.stringify(media)}&&!fs.readFileSync(target).equals(Buffer.from(${JSON.stringify([...sealed])})))process.exit(61);
`,
      { mode: 0o755 },
    );
    process.env.PATH = `${scratch}:${previousPath}`;
    signReleaseTree(app, "fixture", undefined, { signedResources: [media] });
    assert.deepEqual(readFileSync(media), sealed);
    assert.equal(readFileSync(worker).subarray(sealed.length).toString(), "signed");
    writeFileSync(media, Buffer.concat([sealed, Buffer.from("altered")]));
    assert.throws(
      () => signReleaseTree(app, "fixture", undefined, { signedResources: [media] }),
      /codesign --verify failed/,
    );
  } finally {
    process.env.PATH = previousPath;
    rmSync(scratch, { recursive: true, force: true });
  }
});
