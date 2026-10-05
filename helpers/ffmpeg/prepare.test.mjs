import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
const sourceScript = fileURLToPath(new URL("prepare.mjs", import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
function fixture() {
  const scratch = mkdtempSync(join(tmpdir(), "screenrec-ffmpeg-"));
  const recipe = { version: "0.0.0", sourceSha256: hash("expected archive") };
  const script = join(scratch, "prepare.mjs");
  copyFileSync(sourceScript, script);
  writeFileSync(join(scratch, "provenance.json"), JSON.stringify(recipe));
  return { scratch, recipe, script };
}

test("corrupt cached source is refused before any output is prepared", () => {
  const { scratch, script } = fixture();
  try {
    const cache = join(scratch, "cache"),
      output = join(scratch, "prepared");
    mkdirSync(cache);
    writeFileSync(join(cache, "ffmpeg-0.0.0.tar.xz"), "not the frozen archive");
    const answer = spawnSync(
      process.execPath,
      [script, "prepare", "--cache", cache, "--output", output],
      {
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(answer.status, 1, answer.stdout + answer.stderr);
    assert.match(answer.stderr, /Checksum mismatch:.*ffmpeg-0\.0\.0\.tar\.xz/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("staging binds signed copies while retaining the verified build identity", async () => {
  const { scratch, script, recipe } = fixture();
  try {
    const output = join(scratch, "prepared"),
      destination = join(scratch, "app/tools");
    mkdirSync(join(output, "bin"), { recursive: true });
    for (const name of ["ffmpeg", "ffprobe"])
      writeFileSync(join(output, "bin", name), `frozen ${name}`);
    const receipt = {
      format: 1,
      recipeSha256: hash(JSON.stringify(recipe)),
      sourceSha256: recipe.sourceSha256,
      files: { "bin/ffmpeg": hash("frozen ffmpeg"), "bin/ffprobe": hash("frozen ffprobe") },
    };
    const bytes = JSON.stringify(receipt);
    writeFileSync(join(output, "receipt.json"), bytes);
    const owner = await import(pathToFileURL(script));
    const staged = await owner.stageFFmpeg({
      source: output,
      destination,
      sign: (file) => writeFileSync(file, "signed copy"),
    });
    assert.equal(staged.preparedReceiptSha256, hash(bytes));
    assert.equal(staged.recipeSha256, receipt.recipeSha256);
    assert.equal(staged.files["bin/ffmpeg"], hash("signed copy"));
    assert.deepEqual(await owner.verifyFFmpeg(destination), staged);
    assert.deepEqual(await owner.verifyFFmpeg(output), receipt);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("verification rejects changed executable bytes without executing them", () => {
  const { scratch, script, recipe } = fixture();
  try {
    const output = join(scratch, "prepared");
    mkdirSync(join(output, "bin"), { recursive: true });
    writeFileSync(join(output, "bin/ffmpeg"), "tampered ffmpeg");
    writeFileSync(join(output, "bin/ffprobe"), "expected ffprobe");
    writeFileSync(
      join(output, "receipt.json"),
      JSON.stringify({
        format: 1,
        recipeSha256: hash(JSON.stringify(recipe)),
        sourceSha256: recipe.sourceSha256,
        files: { "bin/ffmpeg": hash("expected ffmpeg"), "bin/ffprobe": hash("expected ffprobe") },
      }),
    );
    const answer = spawnSync(process.execPath, [script, "verify", "--output", output], {
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(answer.status, 1, answer.stdout + answer.stderr);
    assert.match(answer.stderr, /Checksum mismatch:.*bin.ffmpeg/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("a complete verified output replays without acquiring or executing source", () => {
  const { scratch, script, recipe } = fixture();
  try {
    const output = join(scratch, "prepared");
    mkdirSync(join(output, "bin"), { recursive: true });
    writeFileSync(join(output, "bin/ffmpeg"), "frozen ffmpeg");
    writeFileSync(join(output, "bin/ffprobe"), "frozen ffprobe");
    const receipt = {
      format: 1,
      recipeSha256: hash(JSON.stringify(recipe)),
      sourceSha256: recipe.sourceSha256,
      files: { "bin/ffmpeg": hash("frozen ffmpeg"), "bin/ffprobe": hash("frozen ffprobe") },
    };
    writeFileSync(join(output, "receipt.json"), JSON.stringify(receipt));
    const cache = join(scratch, "unrequested-cache");
    const answer = spawnSync(
      process.execPath,
      [script, "prepare", "--cache", cache, "--output", output],
      {
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(answer.status, 0, answer.stdout + answer.stderr);
    assert.deepEqual(JSON.parse(answer.stdout), receipt);
    assert.equal(existsSync(cache), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
