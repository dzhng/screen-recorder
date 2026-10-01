import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readAudioWaveFile } from "../../core/dist/audio-wave.js";
import { buildAnnotationRecord } from "./speech/annotation-time.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    port: { type: "string", default: "0" },
    packet: { type: "string" },
  },
});
assert(values.out, "Pass a separate output directory for human marks");
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const packet = values.packet
  ? resolve(values.packet)
  : join(root, "specs/agent-editing/assets/12d-complete-sentence");
const manifestBytes = await readFile(join(packet, "manifest.json"));
const manifest = JSON.parse(manifestBytes);
const annotationsBytes = await readFile(join(packet, "annotations.json"));
const annotations = JSON.parse(annotationsBytes);
const original = await readFile(join(packet, "original.wav"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = manifest.artifacts.find((value) => value.file === "original.wav");
assert.equal(hash(original), expected.sha256, "Original clip differs from frozen evidence");
const info = readAudioWaveFile(join(packet, "original.wav"));
assert.equal(info.channels, 1);
assert.equal(info.frames, expected.frames);
assert.equal(info.sampleRate, manifest.sampleRate);
assert.equal(
  manifest.context.endUs - manifest.context.startUs,
  (info.frames * 1000000) / info.sampleRate,
);
assert.equal(hash(await readFile(join(root, manifest.source.path))), manifest.source.sha256);

let peak = 0;
const bins = [];
for (let start = 0; start < info.frames; start += 256) {
  const end = Math.min(start + 256, info.frames);
  let min = 0,
    max = 0;
  for (let frame = start; frame < end; frame++) {
    const sample = original.readFloatLE(info.dataOffset + frame * 4);
    assert(Number.isFinite(sample));
    min = Math.min(min, sample);
    max = Math.max(max, sample);
  }
  peak = Math.max(peak, -min, max);
  bins.push({ startSeconds: start / info.sampleRate, endSeconds: end / info.sampleRate, min, max });
}
const context = {
  binding: {
    clipSha256: expected.sha256,
    sourceSha256: manifest.source.sha256,
    sourceOriginUs: manifest.source.trackOriginUsFromInheritedLabels,
    sourceRange: manifest.context,
    sampleRate: info.sampleRate,
    frames: info.frames,
    packetSha256: hash(annotationsBytes),
  },
  text: annotations.originalText,
  durationSeconds: info.frames / info.sampleRate,
  targets: annotations.targets ?? [
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
    ...["w116", "w118"].map((id) => ({
      id,
      text: annotations.words.find((word) => word.id === id).text.replace(/[,.]$/u, ""),
    })),
    {
      id: "sentence",
      text: "Whole sentence",
      hint: "So … recording fixture; leave out the opening um",
    },
  ],
  waveform: { peak, bins },
};
const staticFiles = new Map([
  ["/", [join(root, "packages/test-harness/editing/speech/annotation-page.html"), "text/html"]],
  [
    "/annotation-page.mjs",
    [join(root, "packages/test-harness/editing/speech/annotation-page.mjs"), "text/javascript"],
  ],
  [
    "/annotation-time.mjs",
    [join(root, "packages/test-harness/editing/speech/annotation-time.mjs"), "text/javascript"],
  ],
]);
let origin;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, origin).pathname;
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET") {
      if (path === "/context.json") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(context));
      } else if (path === "/original.wav") {
        response.setHeader("Content-Type", "audio/wav");
        response.setHeader("Accept-Ranges", "bytes");
        let start = 0,
          end = original.length - 1;
        if (request.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
          if (match && (match[1] || match[2])) {
            start = match[1] ? Number(match[1]) : Math.max(0, original.length - Number(match[2]));
            end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
          } else start = original.length;
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start < 0
          ) {
            response.writeHead(416, { "Content-Range": `bytes */${original.length}` }).end();
            return;
          }
          response.setHeader("Content-Range", `bytes ${start}-${end}/${original.length}`);
          response.statusCode = 206;
        }
        response.setHeader("Content-Length", end - start + 1);
        response.end(original.subarray(start, end + 1));
      } else if (staticFiles.has(path)) {
        const [file, type] = staticFiles.get(path);
        response.setHeader("Content-Type", type);
        response.end(await readFile(file));
      } else {
        response.writeHead(404).end();
      }
      return;
    }
    if (request.method !== "POST" || path !== "/save") {
      response.writeHead(404).end();
      return;
    }
    if (request.headers.origin !== origin) throw new Error("Save marks from this local page");
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 32768) throw new Error("Mark export is too large");
      chunks.push(chunk);
    }
    const record = buildAnnotationRecord(context, JSON.parse(Buffer.concat(chunks)));
    const savedPath = join(out, `marks-${randomUUID()}.json`);
    await writeFile(savedPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ savedPath, record }));
  } catch (error) {
    response
      .writeHead(400, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: error.message }));
  }
});
await new Promise((done) => server.listen(Number(values.port), "127.0.0.1", done));
origin = `http://127.0.0.1:${server.address().port}`;
console.log(
  JSON.stringify({
    url: origin,
    outputDirectory: out,
    clipSha256: context.binding.clipSha256,
    sourceRange: context.binding.sourceRange,
  }),
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
