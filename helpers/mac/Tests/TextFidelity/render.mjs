import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createOriginalRevision, renderPlan } from "../../../../packages/core/dist/timeline.js";
const [directory, label, native] = process.argv.slice(2);
assert.ok(directory && label && native);
const out = join(directory, label);
mkdirSync(out, { recursive: false });
const sourceFrames = join(directory, "source");
mkdirSync(sourceFrames, { recursive: true });
const captures = JSON.parse(readFileSync(join(directory, "capture.json"))),
  results = [];
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function run(command, args, input) {
  const child = spawn(command, args, { detached: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "",
    stderr = "",
    failure;
  const kill = () => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") failure ??= error;
    }
  };
  const timer = setTimeout(() => {
    failure = new Error("Owned media process exceeded 120 seconds");
    kill();
  }, 120000);
  for (const [stream, append] of [
    [
      child.stdout,
      (text) => {
        stdout += text;
      },
    ],
    [
      child.stderr,
      (text) => {
        stderr += text;
      },
    ],
  ])
    stream.on("data", (data) => {
      append(data.toString());
      if (stdout.length + stderr.length > 4 * 1024 * 1024) {
        failure = new Error("Owned media process exceeded output bound");
        kill();
      }
    });
  child.stdin.on("error", () => {});
  const status = await new Promise((resolve) => {
    child.once("error", (error) => {
      failure = error;
    });
    child.once("close", resolve);
    child.stdin.end(input);
  });
  clearTimeout(timer);
  assert.equal(failure, undefined);
  assert.equal(status, 0, stderr);
  return { stdout, stderr };
}
async function frame(source, output, atSourceUs, durationUs) {
  const r = JSON.parse(
    (
      await run(
        native,
        [],
        JSON.stringify({
          id: "frame",
          operation: "media.frame",
          params: {
            source,
            output,
            atSourceUs,
            kept: { startUs: 0, endUs: durationUs },
            maxLongEdge: 8192,
          },
        }) + "\n",
      )
    ).stdout,
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.data;
}
for (const capture of captures) {
  const source = join(directory, capture.name + ".mov"),
    output = join(out, capture.name + ".mp4"),
    before = sha(source),
    durationUs = 4_000_000,
    plan = renderPlan(createOriginalRevision(durationUs));
  const started = Date.now(),
    runResult = await run(
      "/usr/bin/time",
      ["-l", native],
      JSON.stringify({
        id: "render",
        operation: "media.renderVideo",
        params: { source, output, plan },
      }) + "\n",
    ),
    elapsedMs = Date.now() - started;
  const result = JSON.parse(runResult.stdout);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.durationUs, durationUs);
  assert.equal(sha(source), before);
  const states = [];
  for (const [state, at] of [
    ["top", 600000],
    ["scrolling", 1350000],
    ["details", 2300000],
    ["dark", 3600000],
  ]) {
    assert.ok(at < durationUs);
    const id = capture.name + "-" + state;
    const ref = join(sourceFrames, id + ".png"),
      refReceipt = join(sourceFrames, id + ".json");
    if (!existsSync(ref)) {
      const receipt = await frame(source, ref, at, durationUs);
      writeFileSync(refReceipt, JSON.stringify(receipt, null, 2));
    }
    const sourceReceipt = JSON.parse(readFileSync(refReceipt)),
      rendered = await frame(
        output,
        join(out, id + ".png"),
        sourceReceipt.actualSourceUs,
        durationUs,
      );
    assert.equal(rendered.width, sourceReceipt.width);
    assert.equal(rendered.height, sourceReceipt.height);
    assert.ok(Math.abs(rendered.actualSourceUs - sourceReceipt.actualSourceUs) <= 1);
    states.push({
      state,
      sourceUs: sourceReceipt.actualSourceUs,
      renderedUs: rendered.actualSourceUs,
      width: rendered.width,
      height: rendered.height,
    });
  }
  const metadata = JSON.parse(
    (
      await run("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size,bit_rate:stream=width,height,profile,codec_name,bit_rate,color_space,color_transfer,color_primaries",
        "-of",
        "json",
        output,
      ])
    ).stdout,
  );
  assert.equal(Number(metadata.format.duration) * 1_000_000, durationUs);
  assert.equal(metadata.streams[0].width, result.data.width);
  assert.equal(metadata.streams[0].height, result.data.height);
  results.push({
    capture,
    sourceSHA256: before,
    outputSHA256: sha(output),
    receipt: { ...result.data, file: capture.name + ".mp4" },
    elapsedMs,
    maxRSS: Number(runResult.stderr.match(/(\d+)\s+maximum resident set size/)[1]),
    metadata,
    states,
  });
}
writeFileSync(
  join(out, "report.json"),
  JSON.stringify({ label, binarySHA256: sha(native), results }, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => ({
      capture: r.capture.name,
      bytes: r.receipt.bytes,
      elapsedMs: r.elapsedMs,
      maxRSS: r.maxRSS,
    })),
  ),
);
