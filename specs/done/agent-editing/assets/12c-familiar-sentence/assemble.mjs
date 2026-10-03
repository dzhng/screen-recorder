import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { JourneyService } from "../../../../packages/test-harness/editing/source-evidence-fixture.mjs";
import { waveHeader } from "../../../../packages/test-harness/editing/audio-project-fixture.mjs";
assert(process.argv[2], "Provide a new output directory");
const out = resolve(process.argv[2]);
await mkdir(out);
const source = fileURLToPath(new URL("../18-voice/reference.wav", import.meta.url));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const report = {
  purpose: "Complete familiar sentence for optional future listening, not quality acceptance",
  text: "Okay, so this is the recorder workbench.",
  textAuthority: "Inherited ASR, not independently auditioned",
  source,
  sourceSha256: hash(await readFile(source)),
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  trace: [],
  receipts: [],
  files: [],
  listeningAcceptance: false,
};
const service = new JourneyService(out + "/home", report);
const call = (...args) => service.call(...args);
async function ready(jobId) {
  const start = performance.now();
  for (;;) {
    const j = await call("job.get", { jobId }, { transport: "mcp" });
    if (j.state === "ready") return j;
    assert(!["failed", "canceled", "unavailable"].includes(j.state), JSON.stringify(j));
    assert(performance.now() - start < 60000);
    await new Promise((r) => setTimeout(r, 100));
  }
}
try {
  await service.start();
  const job = await ready(
    (await call("asset.import", { requestId: "sentence", path: source })).jobId,
  );
  const asset = await call("asset.get", { assetId: job.result.assetId });
  const created = await call("project.create", {
    requestId: "sentence-project",
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = created.project.projectId;
  let revision = (
    await call("edit.apply", {
      projectId,
      expectedRevisionId: created.revision.id,
      requestId: "sentence-place",
      operations: [
        { operation: "track.add", label: "voice", track: { kind: "audio", order: 0 } },
        {
          operation: "place",
          clip: {
            trackId: { label: "voice" },
            assetId: asset.id,
            streamId: asset.streams[0].id,
            source: { kind: "range", range: { startUs: 0, endUs: 5000000 } },
            placement: { kind: "project", range: { startUs: 0, endUs: 5000000 } },
          },
        },
      ],
    })
  ).revision;
  for (const mode of ["original", "learned"]) {
    if (mode === "learned")
      revision = (
        await call(
          "edit.apply",
          {
            projectId,
            expectedRevisionId: revision.id,
            requestId: "sentence-denoise",
            operations: [
              {
                operation: "processing.set",
                target: { kind: "output" },
                steps: [{ processor: { type: "rnnoise" } }],
              },
            ],
          },
          { transport: "mcp" },
        )
      ).revision;
    const selection = { projectId, revisionId: revision.id };
    const submission = await call("audio.prepare", selection);
    if (submission.state !== "ready") await ready(submission.jobId);
    const prepared = await call("audio.prepare", selection);
    assert.equal(prepared.state, "ready");
    report.receipts.push(prepared);
    const result = await call("asset.get", { assetId: prepared.published.audio.assetId });
    const query = {
      assetId: result.id,
      streamId: result.streams[0].id,
      range: { startUs: 0, endUs: 5000000 },
    };
    const readingAt = performance.now();
    for (;;) {
      assert(performance.now() - readingAt < 60000, "Audio delivery did not finish");
      const r = await call("audio.get", query);
      if (r.state === "ready") break;
      assert(!["failed", "unavailable"].includes(r.state), JSON.stringify(r));
      await new Promise((r) => setTimeout(r, 100));
    }
    const path = out + "/" + mode + ".wav";
    await call("audio.get", query, { output: path });
    const b = await readFile(path),
      h = waveHeader(b, b.length);
    assert.equal(h.frames, 240000);
    let peak = 0,
      sum = 0;
    for (let i = h.offset; i < b.length; i += 4) {
      const v = b.readFloatLE(i);
      assert(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    report.files.push({
      mode,
      path,
      bytes: b.length,
      sha256: hash(b),
      header: h,
      peak,
      rms: Math.sqrt(sum / ((b.length - h.offset) / 4)),
    });
  }
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2));
}
