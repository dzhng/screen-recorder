import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
const base = process.argv[2];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const reportBytes = readFileSync(`${base}/runs/third/report.json`);
assert.equal(hash(reportBytes), "d30b2bf479a8782ba42e4b6cb3b3e1360c8eb21609bd86b4cd315e0b54997408");
const report = JSON.parse(reportBytes);
const outputs = new Map(
  JSON.parse(readFileSync(`${base}/pixels/outputs.json`)).map((row) => [row.original, row]),
);
const pictures = new Map(report.pictures.map((row) => [row.file, row]));
const sourcePins = JSON.parse(readFileSync(`${base}/producer/native-frame-authority/pins.json`));
const sources = Object.entries(sourcePins).map(([path, pin]) => {
  const bytes = readFileSync(`${base}/producer/native-frame-authority/${path.split("/").at(-1)}`);
  assert.equal(hash(bytes), pin.sha256);
  assert.equal(bytes.length, pin.bytes);
  return { path, ...pin };
});
const inputPins = [];
function samples(picture) {
  const bytes = readFileSync(picture.file);
  assert.equal(hash(bytes), picture.sha256);
  const chunks = [];
  const idat = [];
  for (let at = 8; at < bytes.length;) {
    const size = bytes.readUInt32BE(at),
      kind = bytes.toString("ascii", at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + size);
    chunks.push({ kind, bytes: size, ...(kind !== "IDAT" ? { hex: data.toString("hex") } : {}) });
    if (kind === "IDAT") idat.push(data);
    at += size + 12;
  }
  assert.equal(chunks[0].kind, "IHDR");
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  const depth = bytes[24],
    colorType = bytes[25],
    channels = colorType === 2 ? 3 : 4;
  assert.deepEqual([width, height, depth, bytes[28]], [3120, 1970, 8, 0]);
  assert([2, 6].includes(colorType));
  const filtered = inflateSync(Buffer.concat(idat)),
    stride = width * channels;
  assert.equal(filtered.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height),
    filters = [0, 0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    assert(filter <= 4);
    filters[filter]++;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x,
        left = x >= channels ? pixels[at - channels] : 0;
      const above = y ? pixels[at - stride] : 0,
        upperLeft = y && x >= channels ? pixels[at - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = above;
      if (filter === 3) predictor = (left + above) >> 1;
      if (filter === 4) {
        const p = left + above - upperLeft,
          a = Math.abs(p - left),
          b = Math.abs(p - above),
          c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? above : upperLeft;
      }
      pixels[at] = filtered[y * (stride + 1) + x + 1] + predictor;
    }
  }
  const saved = outputs.get(picture.rgba),
    normalized = readFileSync(`${base}/${saved.banked}`);
  assert.equal(hash(normalized), saved.sha256);
  const normalizedDifferences = [0, 0, 0, 0];
  for (let i = 0; i < width * height; i++)
    for (let c = 0; c < 4; c++) {
      const raw = c === 3 && channels === 3 ? 255 : pixels[i * channels + c];
      if (raw !== normalized[i * 4 + c]) normalizedDifferences[c]++;
    }
  inputPins.push({
    original: picture.file,
    sha256: picture.sha256,
    bytes: bytes.length,
    width,
    height,
    colorType,
    channels,
    filters,
    colorChunks: chunks.filter((row) => ["sRGB", "iCCP", "gAMA", "cHRM"].includes(row.kind)),
    encodedSamplesSHA256: hash(pixels),
    normalized: saved,
    normalizedDifferences,
    pixelReceipt: picture.pixelReceipt,
  });
  return { pixels, channels, normalized };
}
const pairs = [],
  seen = new Set();
for (const comparison of report.comparisons.filter((row) => row.kind === "project")) {
  const picture = pictures.get(comparison.file),
    reference = pictures.get(comparison.reference);
  const contentKey = `${picture.sha256}|${reference.sha256}`;
  if (seen.has(contentKey)) continue;
  seen.add(contentKey);
  const a = samples(reference),
    b = samples(picture);
  const encodedDifferences = [0, 0, 0, 0],
    normalizedDifferences = [0, 0, 0, 0],
    signs = {},
    bounds = [3120, 1970, -1, -1];
  let differentPixels = 0,
    borderPixels = 0,
    tupleConflicts = 0;
  const tuples = new Map();
  for (let i = 0; i < 3120 * 1970; i++) {
    let different = false;
    for (let c = 0; c < 4; c++) {
      const av = c === 3 && a.channels === 3 ? 255 : a.pixels[i * a.channels + c];
      const bv = c === 3 && b.channels === 3 ? 255 : b.pixels[i * b.channels + c];
      if (av !== bv) encodedDifferences[c]++;
      const delta = b.normalized[i * 4 + c] - a.normalized[i * 4 + c];
      if (delta) {
        normalizedDifferences[c]++;
        signs[delta] = (signs[delta] ?? 0) + 1;
        different = true;
      }
    }
    if (different) {
      const x = i % 3120,
        y = Math.floor(i / 3120);
      differentPixels++;
      if (x === 0 || x === 3119 || y === 0 || y === 1969) borderPixels++;
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
    }
    const rgb = a.normalized.readUIntBE(i * 4, 3),
      output = b.normalized.readUIntBE(i * 4, 3),
      prior = tuples.get(rgb);
    if (prior !== undefined && prior !== output) tupleConflicts++;
    else if (prior === undefined) tuples.set(rgb, output);
  }
  pairs.push({
    sample: comparison.sample,
    files: [reference.file, picture.file],
    encodedDifferences,
    normalizedDifferences,
    signs,
    differentPixels,
    borderPixels,
    bounds,
    tupleConflicts,
  });
}
console.log(
  JSON.stringify(
    {
      scope:
        "Read-only lossless PNG sample bytes versus already saved color-managed RGBA; no rendering/regeneration/native work",
      reportSHA256: hash(reportBytes),
      sources,
      inputPins,
      pairs,
    },
    null,
    2,
  ),
);
