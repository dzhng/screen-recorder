import { authorAcceptedRetime } from "../../../../packages/test-harness/editing/accepted-retime-fixture.mjs";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import {
  JourneyService,
  hash,
  poll,
  root,
} from "../../../../packages/test-harness/editing/source-evidence-fixture.mjs";
import { createDenoiseReference } from "../../../../packages/test-harness/editing/denoise-reference.mjs";
import { readAudioWaveFile } from "../../../../packages/core/dist/audio-wave.js";

const { values } = parseArgs({
  options: { out: { type: "string" }, reference: { type: "string" } },
});
assert(values.out && values.reference && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const home = await mkdtemp("/tmp/screenrec-post-retime-familiar-");
const input = join(
  root,
  "specs/agent-editing/assets/13a-corrected-selections/internal-slower-0.8x.wav",
);
const original = await readFile(input),
  info = readAudioWaveFile(input);
assert.equal(hash(original), "53da1582ea82e3d6bb4ba16d9f7c75f978f838d28dd1f1e05b501bb0a5aeccc7");
assert.equal(info.sampleRate, 48000);
assert.equal(info.channels, 1);
const mono = original.subarray(info.dataOffset, info.dataOffset + info.dataBytes),
  stereo = Buffer.alloc(mono.length * 2);
for (let i = 0; i < info.frames; i++)
  for (let c = 0; c < 2; c++) mono.copy(stereo, i * 8 + c * 4, i * 4, i * 4 + 4);
const accepted = join(root, "specs/agent-editing/assets/13a-corrected-selections");
const source = join(accepted, "original.wav");
const frozen = JSON.parse(await readFile(join(accepted, "report.json"), "utf8"));
assert.equal(hash(await readFile(source)), frozen.sourceSha256);
const candidate = frozen.results.find((v) => v.path === "internal-slower-0.8x.wav");
const report = {
  passed: false,
  listening: "pending",
  trace: [],
  exchanges: [],
  receipts: {},
  scope:
    "Original familiar source through the accepted public retime edits, then whole-output RNNoise only. No listening, gain, normalization, fades, additional trims or playback.",
  transcript: "Okay, so this is the recorder workbench.",
  acceptedReference: {
    path: input,
    sha256: hash(original),
    pcmSha256: hash(mono),
    sampleRate: 48000,
    channels: 1,
    frames: info.frames,
  },
  workerSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  referenceSha256: hash(await readFile(values.reference)),
  assemblerSha256: hash(await readFile(import.meta.filename)),
  authoringOwnerSha256: hash(
    await readFile(join(root, "packages/test-harness/editing/accepted-retime-fixture.mjs")),
  ),
};
const service = new JourneyService(home, report),
  call = service.call.bind(service);
async function audio(selection, name) {
  const ready = await poll(
    () => call("audio.get", selection),
    (v) => v.state === "ready",
    name,
  );
  const path = join(out, name + ".wav");
  await call("audio.get", selection, { output: path });
  const bytes = await readFile(path),
    h = readAudioWaveFile(path),
    pcm = bytes.subarray(h.dataOffset, h.dataOffset + h.dataBytes);
  assert.equal(h.frames, info.frames);
  assert.equal(h.sampleRate, 48000);
  assert.equal(h.channels, 2);
  const mcp = await service.mcp.callTool({ name: "audio.get", arguments: selection });
  assert.equal(mcp.structuredContent.ok, true);
  assert.deepEqual(Buffer.from(mcp.content.find((v) => v.type === "audio").data, "base64"), bytes);
  report.receipts[name] = {
    selection,
    ready,
    sha256: hash(bytes),
    pcmSha256: hash(pcm),
    frames: h.frames,
    channels: 2,
    mcpMatchesCLI: true,
  };
  return pcm;
}
try {
  await service.start();
  const admission = await call("asset.import", { path: source, requestId: randomUUID() });
  await poll(
    () => call("job.get", { jobId: admission.jobId }),
    (v) => v.state === "ready",
    "source import",
  );
  const asset = await call("asset.get", { assetId: frozen.sourceSha256 });
  report.asset = asset;
  const made = await call("project.create", {
    requestId: randomUUID(),
    canvas: {
      width: 16,
      height: 16,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const projectId = made.project.projectId;
  let revision = made.revision;
  const edit = async (id, operations, transport = "cli") => {
    const result = await call(
      "edit.apply",
      { projectId, expectedRevisionId: revision.id, requestId: id, operations },
      { transport },
    );
    revision = result.revision;
    return result;
  };
  const authored = await authorAcceptedRetime({
    edit,
    asset,
    streamId: asset.streams.find((s) => s.kind === "audio").id,
    candidate,
  });
  const selection = { projectId, revisionId: revision.id };
  assert.deepEqual(
    (
      await call("processing.get", {
        ...selection,
        target: { kind: "clip", id: authored.selected.id },
      })
    ).steps,
    [],
  );
  assert.deepEqual(
    await audio(selection, "dry"),
    stereo,
    "Dry project must duplicate every accepted mono sample exactly",
  );
  const denoise = createDenoiseReference(resolve(values.reference), home),
    expected = denoise("whole-accepted-A", stereo, 2);
  const changed = await call(
    "edit.apply",
    {
      projectId,
      expectedRevisionId: selection.revisionId,
      requestId: randomUUID(),
      operations: [
        {
          operation: "processing.set",
          target: { kind: "output" },
          steps: [{ processor: { type: "rnnoise" } }],
        },
      ],
    },
    { transport: "mcp" },
  );
  const processedSelection = { projectId, revisionId: changed.revision.id };
  report.processing = await call("processing.get", {
    ...processedSelection,
    target: { kind: "output" },
  });
  assert.deepEqual(
    await audio(processedSelection, "candidate"),
    expected,
    "Processed output must match frozen independent C RNNoise",
  );
  assert.equal(hash(await readFile(input)), report.acceptedReference.sha256);
  assert.equal(hash(await readFile(source)), frozen.sourceSha256);
  report.sourceSha256 = frozen.sourceSha256;
  report.dryStereoDuplicationExact = true;
  report.processedCReferenceExact = true;
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await rm(home, { recursive: true, force: true });
}
