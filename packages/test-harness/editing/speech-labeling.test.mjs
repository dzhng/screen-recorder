import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";

test("original audio supports exact byte ranges for paused word-edge seeking", async () => {
  const out = await mkdtemp(join(tmpdir(), "screenrec-marking-test-"));
  const child = spawn(
    process.execPath,
    [new URL("./speech-labeling.mjs", import.meta.url).pathname, "--out", out],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const exited = once(child, "exit");
  const lines = createInterface({ input: child.stdout });
  try {
    const [line] = await once(lines, "line", { signal: AbortSignal.timeout(5000) });
    const { url } = JSON.parse(line);
    const original = await readFile(
      new URL(
        "../../../specs/agent-editing/assets/12d-complete-sentence/original.wav",
        import.meta.url,
      ),
    );
    for (const [range, start, end] of [
      ["bytes=0-4095", 0, 4095],
      ["bytes=4096-", 4096, original.length - 1],
      ["bytes=-16", original.length - 16, original.length - 1],
    ]) {
      const reply = await fetch(url + "/original.wav", { headers: { Range: range } });
      assert.equal(reply.status, 206);
      assert.equal(reply.headers.get("accept-ranges"), "bytes");
      assert.equal(reply.headers.get("content-range"), `bytes ${start}-${end}/${original.length}`);
      assert.deepEqual(Buffer.from(await reply.arrayBuffer()), original.subarray(start, end + 1));
    }
    const invalid = await fetch(url + "/original.wav", { headers: { Range: "bytes=9999999-" } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get("content-range"), `bytes */${original.length}`);
  } finally {
    lines.close();
    child.kill("SIGTERM");
    await exited;
    await rm(out, { recursive: true, force: true });
  }
});
