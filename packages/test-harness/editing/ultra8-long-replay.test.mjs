import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("replays the retained Ultra-8 long continuity audit without promoting it", async () => {
  const { runUltra8LongReplay } = await import("./ultra8-long-replay.mjs");
  const result = await runUltra8LongReplay();
  assert.equal(result.kind, "ultra8-long-continuity-audit");
  assert.equal(result.status, "exploratory");
  assert.equal(result.cases.length, 2);
  assert.equal(result.cases[0].id, "bspxd-unedited336");
  assert.equal(result.cases[0].passed, true);
  assert.equal(result.cases[1].id, "four-speaker600");
  assert.equal(result.cases[1].passed, false);
  assert.equal(result.promotion, false);
});

test("refuses a changed retained Ultra-8 long operand before scoring", async () => {
  const { runUltra8LongReplay } = await import("./ultra8-long-replay.mjs");
  const source = new URL(
    "../../../specs/video-editing-feedback/assets/31-speaker-replication/",
    import.meta.url,
  ).pathname;
  const scratch = await mkdtemp(join(tmpdir(), "yap-ultra8-long-replay-"));
  try {
    await cp(source, scratch, { recursive: true });
    const path = join(scratch, "ultra8-evidence", "long-observations", "four-speaker600.json.gz");
    const bytes = await readFile(path);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path, bytes);
    await assert.rejects(
      () => runUltra8LongReplay({ assetsDirectory: join(scratch, "ultra8-evidence") }),
      /retained operand changed/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
