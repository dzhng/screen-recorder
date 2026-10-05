import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "screenrec-sparkle-builder-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const tools = join(root, "tools");
  mkdirSync(source);
  mkdirSync(tools);
  const git = (...args) => {
    const result = spawnSync("git", ["-C", source, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git("init", "--quiet");
  writeFileSync(join(source, "original.txt"), "canonical\n");
  writeFileSync(join(source, "patched.txt"), "before\n");
  git("add", ".");
  git(
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  const commit = git("rev-parse", "HEAD").trim();
  writeFileSync(join(source, "patched.txt"), "after\n");
  const patch = git(
    "-c",
    "core.abbrev=7",
    "-c",
    "diff.noprefix=false",
    "diff",
    "HEAD",
    "--binary",
    "--no-ext-diff",
    "--no-textconv",
  );
  git("reset", "--hard", "--quiet", "HEAD");
  cpSync(join(here, "build.mjs"), join(tools, "build.mjs"));
  cpSync(join(here, "framework.mjs"), join(tools, "framework.mjs"));
  writeFileSync(join(tools, "screenrec.patch"), patch);
  writeFileSync(
    join(tools, "upstream.json"),
    JSON.stringify({
      repository: "fixture",
      version: "fixture",
      commit,
      patchSha256: createHash("sha256").update(patch).digest("hex"),
    }),
  );
  const run = (args = ["--check"], env = process.env) =>
    spawnSync(process.execPath, [join(tools, "build.mjs"), "--source", source, ...args], {
      encoding: "utf8",
      env,
    });
  return { root, source, tools, git, run, commit };
}

test("check rejects changed raw bytes concealed by a Git clean filter", (t) => {
  const { source, git, run } = fixture(t);
  writeFileSync(join(source, ".git/info/attributes"), "original.txt filter=fixture\n");
  git("config", "filter.fixture.clean", "printf 'canonical\\n'");
  writeFileSync(join(source, "original.txt"), "unapproved compiler input\n");
  assert.equal(git("diff", "HEAD"), "", "the exploit must conceal the edit from Git diff");
  const result = run();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Raw source input differs.*original\.txt/);
});

test("build rejects module drift instead of issuing a receipt for changed code", (t) => {
  const { root, tools, run } = fixture(t);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const fakeXcode = `#!${process.execPath}\nimport { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
if (args[0] === '-version') console.log('Xcode fixture');
else if (args[0] !== '-checkFirstLaunchStatus') {
  appendFileSync(${JSON.stringify(join(tools, "build.mjs"))}, '\\n// modified during compilation\\n');
  const derived = args[args.indexOf('-derivedDataPath') + 1];
  const framework = join(derived, 'Build/Products/Release/Sparkle.framework');
  mkdirSync(framework, { recursive: true });
  writeFileSync(join(framework, 'Sparkle'), 'fixture framework');
}\n`;
  writeFileSync(join(bin, "xcodebuild"), fakeXcode, { mode: 0o755 });
  const result = run(["--output", join(root, "output")], {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Build input module changed.*build\.mjs/);
  assert.throws(() => readFileSync(join(root, "output/build-receipt.json")), { code: "ENOENT" });
});

test("check rejects a replacement ref substituting the pinned source tree", (t) => {
  const { source, git, run, commit } = fixture(t);
  writeFileSync(join(source, "original.txt"), "substituted compiler input\n");
  git("add", "original.txt");
  git(
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "replacement",
  );
  const replacement = git("rev-parse", "HEAD").trim();
  git("replace", commit, replacement);
  git("reset", "--hard", "--quiet", commit);
  assert.equal(git("rev-parse", "HEAD").trim(), commit);
  assert.equal(git("diff", "HEAD"), "", "the replacement must conceal the different tree");
  const result = run();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Source has changes|Raw source input differs/);
});

test("prepare installs the exact patch and remains repeatable", (t) => {
  const { source, run } = fixture(t);
  for (const args of [["--check"], ["--prepare-only"], ["--prepare-only"], ["--check"]]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).patchApplicable, true);
  }
  assert.equal(readFileSync(join(source, "patched.txt"), "utf8"), "after\n");
});

test("check rejects extra build inputs even when staged in the user index", (t) => {
  const { source, git, run } = fixture(t);
  writeFileSync(join(source, "unapproved.xcconfig"), "OTHER_CFLAGS=unapproved\n");
  git("add", "unapproved.xcconfig");
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Source has changes|unexpected.*inputs/i);
});

test("build refuses to certify source restored to pristine during compilation", (t) => {
  const { root, source, run } = fixture(t);
  const bin = join(root, "bin");
  mkdirSync(bin);
  const fakeXcode = `#!${process.execPath}\nimport { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
if (args[0] === '-version') console.log('Xcode fixture');
else if (args[0] !== '-checkFirstLaunchStatus') {
  const input = ${JSON.stringify(join(source, "patched.txt"))};
  writeFileSync(input, 'before\\n');
  const derived = args[args.indexOf('-derivedDataPath') + 1];
  const framework = join(derived, 'Build/Products/Release/Sparkle.framework');
  mkdirSync(framework, { recursive: true });
  writeFileSync(join(framework, 'Sparkle'), readFileSync(input));
}\n`;
  writeFileSync(join(bin, "xcodebuild"), fakeXcode, { mode: 0o755 });
  const result = run(["--output", join(root, "output")], {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
  });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Post-build source differs.*patched\.txt/);
  assert.throws(() => readFileSync(join(root, "output/build-receipt.json")), { code: "ENOENT" });
});
