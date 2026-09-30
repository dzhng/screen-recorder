import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
const run = promisify(execFile);
const root = resolve(
  process.env.SCREENREC_RUNTIME_ROOT ?? new URL("../../../../", import.meta.url).pathname,
);
const out = resolve(process.argv[2]);
await mkdir(out, { recursive: true });
const scratch = await mkdtemp("/tmp/sr-03d-authority-");
const { JourneyService, poll } = await import(
  pathToFileURL(join(root, "packages/test-harness/editing/source-evidence-fixture.mjs"))
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
function wave(bytes) {
  let rate, channels, pcm;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4),
      kind = bytes.toString("ascii", at, at + 4);
    if (kind === "fmt ") {
      assert.equal(bytes.readUInt16LE(at + 8), 3);
      assert.equal(bytes.readUInt16LE(at + 22), 32);
      channels = bytes.readUInt16LE(at + 10);
      rate = bytes.readUInt32LE(at + 12);
    }
    if (kind === "data") pcm = bytes.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  assert(pcm && rate && channels);
  return { rate, channels, frames: pcm.length / channels / 4, pcm };
}
function fixture(frames) {
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(44100, 24);
  bytes.writeUInt32LE(176400, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) bytes.writeFloatLE((((i * 37) % 251) - 125) / 256, 44 + i * 4);
  bytes.writeFloatLE(0.8125, bytes.length - 4);
  return bytes;
}
const binary = join(scratch, "physical-probe");
await run("swiftc", [
  "-parse-as-library",
  new URL("./Probe.swift", import.meta.url).pathname,
  "-o",
  binary,
]);
const report = {
  passed: false,
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  runnerSha256: hash(await readFile(import.meta.filename)),
  physicalProbeSha256: hash(await readFile(new URL("./Probe.swift", import.meta.url))),
  runtimeHashes: {},
  trace: [],
  exchanges: [],
  cases: [],
};
assert.equal(
  report.nativeSha256,
  "0525dfb9641d5fc51e2434fcd8d36d84da59010a1357cbd6b87d4e8424aeef76",
);
for (const file of [
  "packages/core/dist/assets.js",
  "packages/core/dist/audio-inspection.js",
  "packages/core/dist/audio-extraction.js",
  "packages/core/dist/source-selection.js",
  "apps/service/dist/worker.js",
])
  report.runtimeHashes[file] = hash(await readFile(join(root, file)));
const service = new JourneyService(join(scratch, "home"), report, join(out, "native"));
try {
  await service.start();
  for (const [name, bytes] of [
    [
      "accepted-a",
      await readFile(
        join(root, "specs/agent-editing/assets/13a-corrected-selections/internal-slower-0.8x.wav"),
      ),
    ],
    ["44100-round-down", fixture(44117)],
    ["44100-round-up", fixture(44116)],
  ]) {
    const path = join(out, `${name}.wav`);
    await writeFile(path, bytes);
    if (name === "accepted-a")
      assert.equal(hash(bytes), "53da1582ea82e3d6bb4ba16d9f7c75f978f838d28dd1f1e05b501bb0a5aeccc7");
    const original = wave(bytes);
    const physical = JSON.parse((await run(binary, [path, join(out, `${name}.f32`)])).stdout);
    const decoded = await readFile(join(out, `${name}.f32`));
    assert.deepEqual(decoded, original.pcm, "complete AVFoundation PCM differs from original");
    assert.equal(physical.decodedFrames, original.frames);
    assert.equal(
      BigInt(physical.trackEnd.value) * BigInt(original.rate),
      BigInt(original.frames) * BigInt(physical.trackEnd.timescale),
    );
    assert.equal(physical.segments.length, 1);
    assert.equal(physical.segments[0].empty, false);
    for (const time of [
      physical.trackStart,
      physical.decodedFirst,
      physical.segments[0].targetStart,
    ])
      assert.equal(BigInt(time.value), 0n);
    for (const time of [physical.decodedEnd, physical.segments[0].targetEnd])
      assert.equal(
        BigInt(time.value) * BigInt(original.rate),
        BigInt(original.frames) * BigInt(time.timescale),
      );
    const imported = await service.call("asset.import", { path, requestId: name });
    const job = await poll(
      () => service.call("job.get", { jobId: imported.jobId }),
      (v) => v.state === "ready",
      "import",
    );
    const asset = await service.call("asset.get", { assetId: job.result.assetId });
    const selection = { assetId: asset.id, streamId: asset.streams[0].id };
    const audio = await poll(
      () => service.call("audio.get", selection),
      (v) => v.state === "ready",
      "raw audio",
    );
    const audioPath = join(out, `${name}-raw.wav`);
    await service.call("audio.get", selection, { output: audioPath });
    const raw = wave(await readFile(audioPath));
    const extraction = await poll(
      () =>
        service.call("audio.extract", {
          ...selection,
          rendition: { sampleRate: original.rate, channels: original.channels },
        }),
      (v) => v.state === "ready",
      "extraction",
    );
    const excerpt = extraction.published.excerpt;
    const extractedAsset = await service.call("asset.get", { assetId: excerpt.assetId });
    const extractedBytes = await readFile(
      join(service.home, "library/assets", extractedAsset.fileName),
    );
    const extracted = wave(extractedBytes);
    assert.deepEqual(extracted.pcm, original.pcm, "whole extraction must retain complete PCM");
    assert.deepEqual(
      raw.pcm,
      original.pcm.subarray(0, raw.pcm.length),
      "raw result must be an exact prefix",
    );
    const expectedRaw = name === "44100-round-up" ? original.frames : original.frames - 1;
    assert.equal(
      raw.frames,
      expectedRaw,
      "frozen red behavior changed; inspect before updating evidence",
    );
    report.cases.push({
      name,
      sha256: hash(bytes),
      rate: original.rate,
      frames: original.frames,
      completePCMHash: hash(original.pcm),
      tail: original.pcm.readFloatLE(original.pcm.length - 4),
      physical,
      admitted: asset,
      raw: { frames: raw.frames, pcmSha256: hash(raw.pcm), receipt: audio },
      extraction: { frames: extracted.frames, pcmSha256: hash(extracted.pcm), receipt: extraction },
      physicalEqualsCompletePCM: true,
      rawIsExactPrefix: true,
      extractionEqualsCompletePCM: true,
    });
    console.log(
      name,
      JSON.stringify({
        frames: original.frames,
        raw: raw.frames,
        extraction: extracted.frames,
        admittedEnd: asset.streams[0].endUs,
      }),
    );
  }
  report.passed = true;
} finally {
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(out, "service.log"), service.logs.join(""));
}
