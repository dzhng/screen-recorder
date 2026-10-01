import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

// Inspect prepared files without constructing Models: its constructor mutates its staging root.
export async function existingSpeechModelSnapshot(directory, files) {
  assert.ok((await lstat(directory)).isDirectory(), "Existing model must be a plain directory");
  const present = [];
  async function walk(relative) {
    for (const name of (await readdir(join(directory, relative))).sort()) {
      const path = join(relative, name),
        stat = await lstat(join(directory, path));
      if (stat.isDirectory()) await walk(path);
      else {
        assert.ok(stat.isFile(), "Existing model entries must be regular files");
        present.push(path);
      }
    }
  }
  await walk("");
  assert.deepEqual(present.sort(), files.map((file) => file.path).sort());
  const pinned = [];
  for (const file of files) {
    const path = join(directory, file.path),
      stat = await lstat(path, { bigint: true });
    assert.equal(stat.size, BigInt(file.bytes));
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(path)) hash.update(bytes);
    const sha256 = hash.digest("hex");
    assert.equal(sha256, file.sha256);
    pinned.push({ ...file, inode: String(stat.ino), modifiedNs: String(stat.mtimeNs) });
  }
  const receiptPath = join(dirname(directory), "receipt.json");
  const stat = await lstat(receiptPath, { bigint: true });
  assert.ok(stat.isFile(), "Prepared receipt must be a regular file");
  const bytes = await readFile(receiptPath);
  return {
    directory,
    files: pinned,
    receipt: {
      path: receiptPath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      inode: String(stat.ino),
      modifiedNs: String(stat.mtimeNs),
      contents: JSON.parse(bytes),
    },
  };
}
