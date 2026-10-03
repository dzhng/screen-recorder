import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    const context = await (await fetch(url + "/context.json")).json();
    assert.deepEqual(context.targets, [
      {
        id: "opening-um",
        text: "um",
        kind: "filler",
        inventoryId: "filler-um-clip-start",
        hint: "at the beginning",
      },
      {
        id: "w117",
        text: "uh",
        kind: "filler",
        inventoryId: "filler-uh-54s",
        hint: "after paragraph",
      },
      { id: "w116", text: "paragraph" },
      { id: "w118", text: "this" },
      {
        id: "sentence",
        text: "Whole sentence",
        hint: "So … recording fixture; leave out the opening um",
      },
    ]);
    const original = await readFile(
      new URL(
        "../../../specs/done/agent-editing/assets/12d-complete-sentence/original.wav",
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

test("explicit packet targets own the word export without inventing default neighbors", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "screenrec-target-packet-"));
  const packet = join(scratch, "packet"),
    out = join(scratch, "marks");
  await mkdir(packet);
  const frozen = new URL(
    "../../../specs/done/agent-editing/assets/12d-complete-sentence/",
    import.meta.url,
  );
  for (const name of ["manifest.json", "original.wav"])
    await copyFile(new URL(name, frozen), join(packet, name));
  const annotations = JSON.parse(await readFile(new URL("annotations.json", frozen)));
  const targets = [{ id: "w6", text: "workbench", hint: "in the opening sentence" }];
  annotations.targets = targets;
  await writeFile(join(packet, "annotations.json"), JSON.stringify(annotations));
  const child = spawn(
    process.execPath,
    [new URL("./speech-labeling.mjs", import.meta.url).pathname, "--packet", packet, "--out", out],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  const lines = createInterface({ input: child.stdout });
  try {
    const [line] = await once(lines, "line", { signal: AbortSignal.timeout(5000) });
    const { url } = JSON.parse(line);
    const context = await (await fetch(url + "/context.json")).json();
    assert.deepEqual(context.targets, targets);
    const original = await readFile(join(packet, "original.wav"));
    assert.deepEqual(
      Buffer.from(await (await fetch(url + "/original.wav")).arrayBuffer()),
      original,
    );
    const saved = await fetch(url + "/save", {
      method: "POST",
      headers: { Origin: url, "Content-Type": "application/json" },
      body: JSON.stringify({
        binding: context.binding,
        confirmed: true,
        notes: "Synthetic test positions only; not human listening evidence",
        marks: [{ id: "w6", startSeconds: 0.125, endSeconds: 0.25 }],
      }),
    });
    assert.equal(saved.status, 200);
    const result = await saved.json();
    const range = {
      startUs: context.binding.sourceRange.startUs + 125000,
      endUs: context.binding.sourceRange.startUs + 250000,
    };
    assert.deepEqual(result.record.marks[0].sourceRange, range);
    assert.deepEqual(result.record.independentAnnotations.protectedNeighbors, [
      { wordId: "w6", text: "workbench", independentRange: range },
    ]);
    assert.equal(result.record.independentAnnotations.independentSentenceRange, null);
    assert.equal(result.record.independentAnnotations.independentFillerInventory, null);
    assert.equal(result.record.independentAnnotations.independentRepetitionIntent, null);
    assert.deepEqual(JSON.parse(await readFile(result.savedPath)), result.record);
  } finally {
    lines.close();
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
    await rm(scratch, { recursive: true, force: true });
  }
});
