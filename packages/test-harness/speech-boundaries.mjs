// Draws the narration around the transcript's own phrase boundaries, so a person can mark where
// each one really is and this can say how far the engine was.
//
//   node packages/test-harness/speech-boundaries.mjs [--fixture <directory>]
//     [--transcript <transcript.json>] [--out <directory>] [--panels <count>]
//   node packages/test-harness/speech-boundaries.mjs --score            # after the marks are in
//
// The reference is a person's eye, not a detector. A narration recorded while somebody clicks,
// types and moves a mouse has plenty of sound that is not speech, and every threshold that tells
// the two apart is a guess this measurement would then be measuring instead of the engine. So
// this draws each boundary at one millisecond per pixel with a ruler, someone writes down where
// the speech actually starts or stops relative to the line, and `--score` reads those marks.
//
// Only phrase edges are drawn — the start of a run of words with silence before it, the end of one
// with silence after. A boundary inside connected speech has no moment anybody can point at, by
// eye or by ear, so nothing here pretends to measure one.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    fixture: { type: "string", default: join(root, "fixtures/narrated-workbench") },
    transcript: {
      type: "string",
      default: join(root, "specs/recording-for-ai/assets/personal-journey/transcript.json"),
    },
    out: { type: "string", default: join(root, "specs/recording-for-ai/assets/speech/boundaries") },
    panels: { type: "string", default: "16" },
    /** How much time a panel shows, in milliseconds. Its width is fixed, so this is also its scale. */
    window: { type: "string", default: "900" },
    score: { type: "boolean", default: false },
  },
});

const rate = 16_000;
const width = 900;
/** At the default window one pixel is one millisecond, so a mark reads off the picture directly. */
const usPerPixel = (Number(values.window) * 1_000) / width;
const rowHeight = 280;
const gap = 14;
const perSheet = 2;
/**
 * The pause that ends a phrase. A boundary is only worth drawing when there is real silence beside
 * it, and a gap this long in the transcript is one: shorter gaps are the ordinary spaces inside
 * connected speech, where nobody — by eye or by ear — can say where one word stopped.
 */
const clearUs = 400_000;
const marksPath = join(values.out, "marks.json");

// ---- the transcript's phrase edges ----------------------------------------------------------

const rows = JSON.parse(readFileSync(values.transcript, "utf8"));
const words = rows.filter((row) => row.type === "word" && !row.partial);
const phrases = [];
for (const word of words) {
  const open = phrases.at(-1);
  if (open && word.sourceRange.startUs - open.endUs < clearUs) {
    open.endUs = word.sourceRange.endUs;
    open.last = word;
  } else
    phrases.push({
      startUs: word.sourceRange.startUs,
      endUs: word.sourceRange.endUs,
      first: word,
      last: word,
    });
}

const count = Number(values.panels);
const boundaries = [];
for (const [side, key, which] of [
  ["start", "startUs", "first"],
  ["end", "endUs", "last"],
]) {
  // Evenly through the take rather than its first minute, so the sample is not one stretch of one
  // person's speech at one energy.
  const stride = Math.max(1, Math.floor(phrases.length / (count / 2)));
  for (let index = 0; index < phrases.length && boundaries.length < count; index += stride) {
    const phrase = phrases[index];
    boundaries.push({
      id: phrase[which].id,
      text: phrase[which].text,
      side,
      reportedUs: phrase[key],
      phrase: index,
    });
  }
}
boundaries.sort((a, b) => a.reportedUs - b.reportedUs || a.side.localeCompare(b.side));

// ---- scoring, once the marks are written ----------------------------------------------------

if (values.score) {
  const marks = JSON.parse(readFileSync(marksPath, "utf8"));
  const marked = marks.boundaries.filter((row) => typeof row.markedOffsetMs === "number");
  if (!marked.length) throw new Error(`no boundary in ${marksPath} has been marked yet`);
  const errors = marked.map((row) => Math.abs(row.markedOffsetMs)).sort((a, b) => a - b);
  const at = (share) => errors[Math.min(errors.length - 1, Math.floor(errors.length * share))];
  const side = (which) => {
    const only = marked.filter((row) => row.side === which).map((row) => row.markedOffsetMs);
    only.sort((a, b) => a - b);
    return { n: only.length, medianMs: only[only.length >> 1], minMs: only[0], maxMs: only.at(-1) };
  };
  const result = {
    narration: marks.narration,
    transcript: marks.transcript,
    marked: marked.length,
    drawn: marks.boundaries.length,
    medianErrorMs: at(0.5),
    p95ErrorMs: at(0.95),
    worstErrorMs: errors.at(-1),
    // Which way the engine is wrong matters as much as how far: a boundary outside the speech
    // leaves a cut's neighbours whole, and one inside them clips a word.
    start: side("start"),
    end: side("end"),
    targets: { medianErrorMs: 100, p95ErrorMs: 250 },
    meetsMedian: at(0.5) <= 100,
    meetsP95: at(0.95) <= 250,
  };
  writeFileSync(join(values.out, "scored.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// ---- the narration, as samples ---------------------------------------------------------------

const journal = readFileSync(join(values.fixture, "capture.journal.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const started = journal.find(
  (row) => row.event === "trackStarted" && row.data.role === "narration",
);
if (!started) throw new Error("this fixture has no narration track");
// A word's time is a source time and the file starts wherever acquisition did, so the mapping is
// one subtraction — but only while the acquired samples run unbroken. A gap is a hard stop here
// rather than a quiet shift of every boundary after it.
const acquired = journal.filter(
  (row) => row.event === "audioSamples" && row.data.role === "narration",
);
for (const [index, row] of acquired.slice(1).entries()) {
  const gapUs = row.data.startUs - acquired[index].data.endUs;
  if (gapUs > 2_000) throw new Error(`narration has a ${gapUs}µs gap at ${row.data.startUs}µs`);
}
const originUs = started.data.firstSourceUs;

const scratch = mkdtempSync("/tmp/scr-boundaries-");
let samples;
try {
  const decoded = join(scratch, "narration.raw");
  execFileSync(
    "ffmpeg",
    // Mono at the rate the engine itself hears, so this is drawn from what it was given.
    // prettier-ignore
    ["-v", "error", "-i", join(values.fixture, "narration.mov"), "-ac", "1", "-ar", String(rate),
      "-f", "s16le", "-y", decoded],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  samples = new Int16Array(readFileSync(decoded).buffer);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ---- drawing ---------------------------------------------------------------------------------

/**
 * One column of the picture: how much sound there is at each pitch, at one moment.
 *
 * A waveform cannot show where a word begins in a room with a fan and a mouse in it — speech and
 * noise are the same height there. Pitch separates them: a voice fills the bands it has harmonics
 * in, and this room's noise does not. So every column here is a small Fourier transform, and the
 * word is the dark band that appears and disappears.
 */
const size = 256;
const bins = 44;
/** Below this the picture is the room's own rumble, which no voice's boundary lives in. */
const lowest = 3;
const cosines = Float64Array.from({ length: size / 2 }, (_, k) =>
  Math.cos((-2 * Math.PI * k) / size),
);
const sines = Float64Array.from({ length: size / 2 }, (_, k) =>
  Math.sin((-2 * Math.PI * k) / size),
);
const hann = Float64Array.from(
  { length: size },
  (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1)),
);

function spectrum(at) {
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let n = 0; n < size; n++) real[n] = ((samples[at + n] ?? 0) / 32_768) * hann[n];
  // Iterative radix-2: reverse the order first, then combine pairs, then pairs of pairs.
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let span = 2; span <= size; span <<= 1) {
    const step = size / span;
    for (let start = 0; start < size; start += span)
      for (let k = 0; k < span / 2; k++) {
        const c = cosines[k * step];
        const s = sines[k * step];
        const a = start + k;
        const b = a + span / 2;
        const tr = real[b] * c - imaginary[b] * s;
        const ti = real[b] * s + imaginary[b] * c;
        real[b] = real[a] - tr;
        imaginary[b] = imaginary[a] - ti;
        real[a] += tr;
        imaginary[a] += ti;
      }
  }
  const magnitudes = new Float64Array(bins - lowest);
  for (let k = lowest; k < bins; k++)
    magnitudes[k - lowest] = Math.sqrt(real[k] * real[k] + imaginary[k] * imaginary[k]);
  return magnitudes;
}

const table = Int32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value;
});
function crc32(buffer) {
  let value = ~0;
  for (const byte of buffer) value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
  return ~value;
}

/** A PNG, written here rather than drawn by a dependency this repository does not have. */
function png(pixels, height) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++)
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sheets = Math.ceil(boundaries.length / perSheet);
mkdirSync(values.out, { recursive: true });

for (let sheet = 0; sheet < sheets; sheet++) {
  const drawn = boundaries.slice(sheet * perSheet, (sheet + 1) * perSheet);
  const height = drawn.length * (rowHeight + gap);
  const pixels = Buffer.alloc(width * height * 3, 0xff);
  const set = (x, y, colour) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    pixels.set(colour, ((y | 0) * width + (x | 0)) * 3);
  };
  drawn.forEach((boundary, row) => {
    const top = row * (rowHeight + gap);
    const fromUs = boundary.reportedUs - (width / 2) * usPerPixel;
    const shown = bins - lowest;
    const loudness = new Float64Array(width * shown);
    for (let x = 0; x < width; x++) {
      const at = Math.round(((fromUs + x * usPerPixel - originUs) / 1_000_000) * rate) - size / 2;
      const magnitudes = spectrum(at);
      // Decibels, because the difference between a room and a voice is a ratio, not a distance.
      for (let k = 0; k < shown; k++)
        loudness[x * shown + k] = 20 * Math.log10(Math.max(magnitudes[k], 1e-9));
    }
    // Each panel against its own loudest moment: one click in a two-minute narration is louder
    // than any of the speech, and a scale set by it would leave every panel here blank. Forty
    // decibels below that is black, which puts a room's noise at the pale end and a voice at the
    // dark one.
    // Not the loudest moment but a loud one: a single click is louder than any speech in the
    // panel, and a scale set by it leaves the words too pale to mark.
    const ranked = Float64Array.from(loudness).sort();
    const peak = ranked[Math.floor(ranked.length * 0.995)];
    const range = 32;
    const area = rowHeight - 34;
    for (let x = 0; x < width; x++)
      for (let k = 0; k < shown; k++) {
        const share = Math.min(1, Math.max(0, (loudness[x * shown + k] - (peak - range)) / range));
        const shade = Math.round(255 - share * 255);
        // Low pitch at the bottom, as every other picture of sound draws it.
        const from = top + 17 + Math.round(((shown - 1 - k) * area) / shown);
        for (let y = from; y < from + Math.ceil(area / shown); y++)
          set(x, y, [shade, shade, shade]);
      }
    // A ruler along both edges, in the boundary's own units: a short tick every 50 ms, a long one
    // every 100. It stays out of the middle so it cannot be mistaken for the sound.
    const tick = 50_000 / usPerPixel;
    for (let x = (width / 2) % tick; x < width; x += tick) {
      const long = Math.round((x - width / 2) / tick) % 2 === 0;
      for (let step = 0; step < (long ? 14 : 7); step++) {
        set(x, top + 2 + step, [0x99, 0x99, 0x99]);
        set(x, top + rowHeight - 3 - step, [0x99, 0x99, 0x99]);
      }
      // Every hundred milliseconds also crosses the picture, faintly, so a mark can be counted
      // off the grid instead of guessed at from the edges.
      if (long)
        for (let y = top + 17; y < top + rowHeight - 17; y += 3) set(x, y, [0xc8, 0x9a, 0x9a]);
    }
    // The transcript's own boundary. Marking is reading off how far the speech is from this line.
    for (let y = top + 2; y < top + rowHeight - 2; y++) set(width / 2, y, [0x1d, 0x4e, 0xd8]);
    for (let y = top + 2; y < top + rowHeight - 2; y += 2) {
      set(width / 2 - 1, y, [0x9a, 0xb4, 0xf2]);
      set(width / 2 + 1, y, [0x9a, 0xb4, 0xf2]);
    }
    for (let x = 0; x < width; x++) set(x, top + rowHeight + gap / 2, [0xdd, 0xdd, 0xdd]);
  });
  writeFileSync(join(values.out, `sheet-${sheet}.png`), png(pixels, height));
}

// A mark is a millisecond offset from the blue line: negative when the speech begins or ends
// before the transcript says, positive when it does so after. `null` is "not marked yet".
const previous = existsSync(marksPath) ? JSON.parse(readFileSync(marksPath, "utf8")) : undefined;
const kept = new Map(
  previous?.boundaries?.map((row) => [`${row.id}:${row.side}`, row.markedOffsetMs]) ?? [],
);
writeFileSync(
  marksPath,
  JSON.stringify(
    {
      narration: join(values.fixture, "narration.mov"),
      transcript: values.transcript,
      usPerPixel,
      windowMs: Number(values.window),
      sheets,
      perSheet,
      phrases: phrases.length,
      words: words.length,
      boundaries: boundaries.map((boundary, index) => ({
        sheet: Math.floor(index / perSheet),
        row: index % perSheet,
        ...boundary,
        markedOffsetMs: kept.get(`${boundary.id}:${boundary.side}`) ?? null,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    { words: words.length, phrases: phrases.length, drawn: boundaries.length, sheets },
    null,
    2,
  ),
);
