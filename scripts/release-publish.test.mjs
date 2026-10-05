import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function fixture(tag, existing = "missing") {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-publication-"));
  const bin = join(scratch, "bin");
  mkdirSync(bin);
  const log = join(scratch, "calls.jsonl");
  writeFileSync(
    join(bin, "gh"),
    `#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2);
const input=args[0]==='api'?fs.readFileSync(0,'utf8'):'';
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,input,repo:process.env.GH_REPO})+'\\n');
if(args[0]==='release' && args[1]==='view') {
  if(args.at(-1)==='databaseId') console.log(JSON.stringify({databaseId:42}));
  else if(${JSON.stringify(existing)}==='missing') process.exit(1);
  else console.log(JSON.stringify({isDraft:${existing !== "published"}}));
}
`,
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
  return {
    scratch,
    kit,
    invoke: () =>
      spawnSync(process.execPath, ["scripts/release-publish.mjs", scratch, tag, "a".repeat(40)], {
        env: {
          ...process.env,
          GH_REPO: "fixture/screen-recorder",
          PATH: bin + ":" + process.env.PATH,
        },
        encoding: "utf8",
      }),
    calls: () => readFileSync(log, "utf8").trim().split("\n").map(JSON.parse),
    close: () => rmSync(scratch, { recursive: true, force: true }),
  };
}

// Tags newer and older than stable v0.2.0 must both delegate latest selection
// to GitHub. This checks the outgoing API contract without reimplementing its policy.
for (const [tag, existing] of [
  ["v0.3.0", "missing"],
  ["v0.1.3", "draft"],
  ["v0.3.0-beta.1", "missing"],
])
  test(`publication ${tag} uploads every asset before GitHub-owned latest selection`, () => {
    const release = fixture(tag, existing);
    try {
      const answer = release.invoke();
      assert.equal(answer.status, 0, answer.stderr);
      const calls = release.calls();
      const upload = calls.findIndex(({ args }) => args[1] === "upload");
      const publish = calls.findIndex(({ args }) => args[0] === "api");
      assert.ok(upload >= 0 && publish > upload, "Publication must use the API after asset upload");
      assert.deepEqual(calls[upload].args, [
        "release",
        "upload",
        tag,
        release.kit,
        "update.zip",
        "appcast.xml",
        "SHA256SUMS",
        "release.json",
        "--clobber",
      ]);
      assert.deepEqual(calls[publish - 1].args, ["release", "view", tag, "--json", "databaseId"]);
      assert.deepEqual(calls[publish].args, [
        "api",
        "--method",
        "PATCH",
        "repos/{owner}/{repo}/releases/42",
        "--input",
        "-",
      ]);
      assert.deepEqual(JSON.parse(calls[publish].input), {
        draft: false,
        prerelease: tag.includes("-"),
        make_latest: tag.includes("-") ? "false" : "legacy",
      });
      assert.equal(calls[publish].repo, "fixture/screen-recorder");
      assert.equal(
        calls.some(({ args }) => args[1] === "edit"),
        false,
      );
      assert.equal(
        calls.some(({ args }) => args[1] === "create"),
        existing === "missing",
      );
    } finally {
      release.close();
    }
  });

test("published assets stay untouched, while an altered update fails before any GitHub call", () => {
  const tag = "v0.1.3";
  const release = fixture(tag, "published");
  try {
    assert.equal(release.invoke().status, 0);
    assert.deepEqual(
      release.calls().map(({ args }) => args),
      [["release", "view", tag, "--json", "isDraft"]],
    );
    writeFileSync(join(release.scratch, "update.zip"), "tampered");
    const changed = release.invoke();
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /differs from package receipt/);
    assert.equal(release.calls().length, 1);
  } finally {
    release.close();
  }
});
