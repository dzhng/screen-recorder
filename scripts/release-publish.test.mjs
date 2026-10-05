import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

for (const tag of ["v0.1.3", "v0.1.3-beta.1"])
  test(`publication ${tag} uploads every asset before publishing and follows stable tag policy`, () => {
    const scratch = mkdtempSync(join(tmpdir(), "screenrec-publication-"));
    try {
      const bin = join(scratch, "bin");
      mkdirSync(bin);
      const log = join(scratch, "calls.jsonl");
      writeFileSync(
        join(bin, "gh"),
        `#!${process.execPath}\nconst fs=require('node:fs');let args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');if(args[1]==='view')process.exit(1);\n`,
        { mode: 0o755 },
      );
      const kit = `ScreenRecorder-${tag}-macos-arm64.zip`;
      const sha = (name) =>
        createHash("sha256")
          .update(readFileSync(join(scratch, name)))
          .digest("hex");
      for (const name of [kit, "update.zip", "appcast.xml", "NOTES.md"])
        writeFileSync(join(scratch, name), name);
      writeFileSync(
        join(scratch, "release.json"),
        JSON.stringify({
          tag,
          revision: "a".repeat(40),
          updateArchive: { name: "update.zip", sha256: sha("update.zip") },
          appcast: { name: "appcast.xml", sha256: sha("appcast.xml") },
        }),
      );
      writeFileSync(
        join(scratch, "SHA256SUMS"),
        `${sha(kit)}  ${kit}\n${sha("release.json")}  release.json\n`,
      );
      const answer = spawnSync(
        process.execPath,
        ["scripts/release-publish.mjs", scratch, tag, "a".repeat(40)],
        { env: { ...process.env, PATH: bin + ":" + process.env.PATH }, encoding: "utf8" },
      );
      assert.equal(answer.status, 0, answer.stderr);
      const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
      const upload = calls.findIndex((args) => args[1] === "upload"),
        publish = calls.findIndex((args) => args[1] === "edit");
      assert.ok(upload >= 0 && publish > upload);
      assert.ok(calls[upload].includes("appcast.xml"));
      assert.ok(calls[upload].includes("update.zip"));
      assert.ok(calls[upload].includes(kit));
      assert.equal(calls[publish].includes("--latest=true"), !tag.includes("-"));
      assert.equal(calls[publish].includes("--prerelease=true"), tag.includes("-"));
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

test("published assets stay untouched, while an altered update fails before any GitHub call", () => {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-publication-"));
  try {
    const bin = join(scratch, "bin");
    mkdirSync(bin);
    const log = join(scratch, "calls.jsonl");
    writeFileSync(
      join(bin, "gh"),
      `#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify(process.argv.slice(2))+'\\n');console.log(JSON.stringify({isDraft:false}));`,
      { mode: 0o755 },
    );
    const tag = "v0.1.3",
      kit = `ScreenRecorder-${tag}-macos-arm64.zip`;
    const sha = (name) =>
      createHash("sha256")
        .update(readFileSync(join(scratch, name)))
        .digest("hex");
    for (const name of [kit, "update.zip", "appcast.xml"]) writeFileSync(join(scratch, name), name);
    writeFileSync(
      join(scratch, "release.json"),
      JSON.stringify({
        tag,
        revision: "a".repeat(40),
        updateArchive: { name: "update.zip", sha256: sha("update.zip") },
        appcast: { name: "appcast.xml", sha256: sha("appcast.xml") },
      }),
    );
    writeFileSync(
      join(scratch, "SHA256SUMS"),
      `${sha(kit)}  ${kit}\n${sha("release.json")}  release.json\n`,
    );
    const invoke = () =>
      spawnSync(process.execPath, ["scripts/release-publish.mjs", scratch, tag, "a".repeat(40)], {
        env: { ...process.env, PATH: bin + ":" + process.env.PATH },
        encoding: "utf8",
      });
    assert.equal(invoke().status, 0);
    assert.deepEqual(readFileSync(log, "utf8").trim().split("\n").map(JSON.parse), [
      ["release", "view", tag, "--json", "isDraft"],
    ]);
    writeFileSync(join(scratch, "update.zip"), "tampered");
    const changed = invoke();
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /differs from package receipt/);
    assert.equal(readFileSync(log, "utf8").trim().split("\n").length, 1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
