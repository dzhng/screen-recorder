import assert from "node:assert/strict";
import test from "node:test";
import { captionProposals } from "../skills/yap/scripts/caption-proposals.mjs";

const word = (ordinal, text, startUs, endUs, extra = {}) => ({
  type: "word",
  id: `w${ordinal}`,
  ordinal,
  text,
  kind: "word",
  segment: 0,
  sourceRange: { startUs, endUs },
  partial: false,
  clipId: "take",
  trackId: "speech",
  assetId: "asset",
  streamId: "audio",
  generation: "generation",
  fragments: [{ source: { startUs, endUs }, project: { startUs, endUs } }],
  ...extra,
});
const rows = [
  word(0, "hello,", 0, 400000),
  word(1, "world!", 400000, 900000),
  word(2, "Again.", 1400000, 2000000),
];
const request = (records = rows) => ({
  entry: {
    identity: { projectId: "project", revisionId: "revision" },
    state: "ready",
    complete: true,
    rows: records,
  },
  rowIndexes: records.map((_, i) => i),
  corrections: [{ rowIndex: 0, text: "Hello," }],
  trackId: "captions",
  canvas: { width: 640, height: 360 },
  style: {
    font: { assetId: "font", postScriptName: "ArialMT" },
    width: 500,
    height: 90,
    size: 32,
    color: "#ffffffff",
    alignment: "center",
    wrap: true,
  },
  constraints: {
    widthGraphemes: 12,
    maxLines: 2,
    minDwellUs: 500000,
    maxDwellUs: 3000000,
    maxCps: 30,
    pauseUs: 400000,
    breakOnPunctuation: true,
    separator: " ",
    safeArea: { x: 20, y: 20, width: 600, height: 320 },
  },
});

test("explicit corrected caption drafts retain word truth, exact pins and separate punctuation/pause groups", () => {
  const input = request(),
    before = structuredClone(input);
  const output = captionProposals(input);
  assert.deepEqual(input, before);
  assert.deepEqual(output.identity, { projectId: "project", revisionId: "revision" });
  assert.deepEqual(
    output.proposals.map((p) => [p.rowIndexes, p.text, p.clip.placement]),
    [
      [
        [0, 1],
        "Hello,\nworld!",
        { kind: "content", clipId: "take", sourceRange: { startUs: 0, endUs: 900000 } },
      ],
      [
        [2],
        "Again.",
        { kind: "content", clipId: "take", sourceRange: { startUs: 1400000, endUs: 2000000 } },
      ],
    ],
  );
  assert.deepEqual(output.proposals[0].clip.seed.words, [
    { ordinal: 0, sourceRange: rows[0].sourceRange },
    { ordinal: 1, sourceRange: rows[1].sourceRange },
  ]);
  assert.deepEqual(output.proposals[0].words, rows.slice(0, 2));
  assert.equal(output.proposals[0].clip.source.text, "Hello,\nworld!");
  assert.equal(output.proposals[0].violations[0].code, "RENDERED_LAYOUT_UNVERIFIED");
  assert.equal(output.proposals[0].geometry.processor.rect.y, 250);
});

test("fractional retiming limits are exact and repeated/partial occurrences keep separate pins", () => {
  const records = [
    word(0, "one", 0, 1000000, {
      fragments: [
        { source: { startUs: 0, endUs: 1000000 }, project: { startUs: 0, endUs: 1000000 } },
      ],
    }),
    word(1, "two", 1000000, 2000000, {
      fragments: [
        {
          source: { startUs: 1000000, endUs: 2000000 },
          project: { startUs: 1000000, endUs: { numerator: 4000001, denominator: 2 } },
        },
      ],
    }),
    word(0, "one", 0, 1000000, {
      clipId: "repeat",
      partial: true,
      fragments: [
        {
          source: { startUs: 100000, endUs: 1000000 },
          project: { startUs: 3000000, endUs: 3900000 },
        },
      ],
    }),
  ];
  const input = request(records);
  input.corrections = [];
  input.constraints.maxDwellUs = 2000000;
  input.constraints.breakOnPunctuation = false;
  const output = captionProposals(input);
  assert.deepEqual(
    output.proposals.map((p) => p.rowIndexes),
    [[0], [1], [2]],
  );
  assert.deepEqual(output.proposals[1].projectFragments, [
    { rowIndex: 1, ...records[1].fragments[0] },
  ]);
  assert.equal(output.proposals[2].clip.seed.occurrenceClipId, "repeat");
  assert.deepEqual(output.proposals[2].clip.seed.words, [
    { ordinal: 0, sourceRange: { startUs: 0, endUs: 1000000 } },
  ]);
  assert.deepEqual(output.proposals[2].clip.placement.sourceRange, {
    startUs: 100000,
    endUs: 1000000,
  });
  assert.deepEqual(
    output.proposals[2].violations.find((v) => v.code === "PARTIAL_WORD"),
    { code: "PARTIAL_WORD", rowIndex: 2 },
  );
});

test("multilingual graphemes and unbreakable words retain literal text while constraint failures remain visible", () => {
  const records = [word(0, "e\u0301😀世界", 0, 100000), word(1, "unbreakable", 100000, 200000)];
  const input = request(records);
  input.corrections = [];
  Object.assign(input.constraints, {
    widthGraphemes: 4,
    separator: "",
    maxWords: 4,
    safeArea: { x: 20, y: 20, width: 300, height: 60 },
  });
  const output = captionProposals(input),
    draft = output.proposals[0];
  assert.equal(draft.text, "e\u0301😀世界\nunbreakable");
  assert.deepEqual(draft.words, records);
  assert.deepEqual(output.violations, [{ code: "UNSUPPORTED_CONSTRAINT", constraint: "maxWords" }]);
  assert.deepEqual(
    draft.violations.map((v) => v.code),
    ["RENDERED_LAYOUT_UNVERIFIED", "SAFE_AREA", "GRAPHEME_WIDTH", "MINIMUM_DWELL", "READING_SPEED"],
  );
  assert.equal(draft.violations.find((v) => v.code === "READING_SPEED").charactersPerSecond, 75);
});

test("unavailable or source-only evidence never invents project time and every response obeys the UTF8 budget", () => {
  const input = request();
  input.entry.identity = { assetId: "asset", streamId: "audio", generation: "generation" };
  assert.deepEqual(captionProposals(input).violations, [{ code: "PROJECT_PROJECTION_REQUIRED" }]);
  assert.deepEqual(captionProposals(input).proposals, []);
  input.maxBytes = 1024;
  input.constraints.unsupported = "世界".repeat(1000);
  assert.throws(() => captionProposals(input), { code: "OUTPUT_BUDGET_EXCEEDED" });
  const incomplete = request();
  incomplete.entry.complete = false;
  assert.deepEqual(captionProposals(incomplete).violations, [
    { code: "INCOMPLETE_EVIDENCE", state: "ready", complete: false },
  ]);
  assert.deepEqual(captionProposals(incomplete).proposals, []);
});

test("explicit gaps, skipped words and fragmented support split proposals without dropping selected rows", () => {
  const records = [
    word(0, "one", 0, 100000),
    { type: "gap", sourceRange: { startUs: 100000, endUs: 200000 } },
    word(1, "two", 200000, 300000),
    word(2, "skip", 300000, 400000),
    word(3, "last", 400000, 500000, {
      fragments: [
        { source: { startUs: 400000, endUs: 420000 }, project: { startUs: 400000, endUs: 420000 } },
        { source: { startUs: 480000, endUs: 500000 }, project: { startUs: 480000, endUs: 500000 } },
      ],
    }),
  ];
  const input = request(records);
  input.rowIndexes = [0, 2, 4];
  input.corrections = [];
  const output = captionProposals(input);
  assert.deepEqual(
    output.proposals.map((p) => p.rowIndexes),
    [[0], [2], [4]],
  );
  assert.deepEqual(
    output.proposals[2].projectFragments,
    records[4].fragments.map((fragment) => ({ rowIndex: 4, ...fragment })),
  );
  assert.deepEqual(
    output.proposals[2].violations.find((v) => v.code === "DISCONTINUOUS_WORD"),
    { code: "DISCONTINUOUS_WORD", rowIndex: 4 },
  );
  for (const indexes of [[0, 0], [2, 0], [0, 1], [99]])
    assert.throws(() => captionProposals({ ...input, rowIndexes: indexes }), {
      code: "INVALID_REQUEST",
    });
});

test("consumer command returns pure proposals even when no CLI is available", async () => {
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["skills/yap/scripts/caption-proposals.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  child.stdin.end(JSON.stringify({ ...request(), cli: { executable: "/does/not/exist/yap" } }));
  const code = await new Promise((resolve) => child.once("close", resolve));
  assert.equal(code, 0, stderr);
  const output = JSON.parse(stdout);
  assert.deepEqual(output.identity, { projectId: "project", revisionId: "revision" });
  assert.deepEqual(
    output.proposals.map((p) => p.text),
    ["Hello,\nworld!", "Again."],
  );
});

test("large explicit selections respect the existing per-cue seed pin limit without losing words", () => {
  const records = Array.from({ length: 1001 }, (_, index) =>
    word(index, "x", index * 1000, (index + 1) * 1000),
  );
  const input = request(records);
  input.corrections = [];
  Object.assign(input.constraints, {
    widthGraphemes: 8192,
    maxLines: 1,
    separator: "",
    breakOnPunctuation: false,
  });
  input.maxBytes = 2 * 1024 * 1024;
  const output = captionProposals(input);
  assert.deepEqual(
    output.proposals.map((p) => p.rowIndexes),
    [records.slice(0, 1000).map((_, i) => i), [1000]],
  );
  assert.deepEqual(output.violations, [{ code: "CUE_WORD_PIN_LIMIT", maximum: 1000 }]);
});

test("a literal display string beyond text admission limits is retained with a violation", () => {
  const text = "😀".repeat(4100),
    input = request([word(0, text, 0, 2000000)]);
  input.corrections = [];
  input.constraints.widthGraphemes = 8192;
  const draft = captionProposals(input).proposals[0];
  assert.equal(draft.text, text);
  assert.deepEqual(
    draft.violations.find((v) => v.code === "TEXT_SIZE_LIMIT"),
    { code: "TEXT_SIZE_LIMIT", maximumUTF16Units: 8192 },
  );
});

test("empty display corrections preserve the explicitly chosen inter-word separator", () => {
  const input = request([word(0, "one", 0, 1000000), word(1, "two", 1000000, 2000000)]);
  input.corrections = [{ rowIndex: 0, text: "" }];
  input.constraints.separator = " · ";
  assert.equal(captionProposals(input).proposals[0].text, " · two");
});

test("reading-speed admission compares exact project duration at the boundary", () => {
  const input = request([
    word(0, "x", { numerator: 1, denominator: Number.MAX_SAFE_INTEGER }, 1000000),
  ]);
  input.corrections = [];
  input.constraints.maxCps = 1;
  assert.equal(
    captionProposals(input).proposals[0].violations.some((v) => v.code === "READING_SPEED"),
    true,
  );
});

test("wrapping retains meaningful caller separators rather than silently deleting them", () => {
  const input = request([word(0, "one", 0, 1000000), word(1, "two", 1000000, 2000000)]);
  input.corrections = [];
  Object.assign(input.constraints, { separator: " · ", widthGraphemes: 4 });
  assert.equal(captionProposals(input).proposals[0].text, "one\n · two");
});

test("instant word evidence remains visible without invented dwell or aborting neighboring proposals", () => {
  const instant = word(1, "um", 200000, 200000, {
    instant: true,
    fragments: [
      { source: { startUs: 200000, endUs: 200000 }, project: { startUs: 200000, endUs: 200000 } },
    ],
  });
  const records = [word(0, "one", 0, 100000), instant, word(2, "two", 300000, 400000)];
  const input = request(records);
  input.corrections = [];
  const proposals = captionProposals(input).proposals;
  assert.deepEqual(
    proposals.map((p) => p.rowIndexes),
    [[0], [1], [2]],
  );
  assert.equal(proposals[1].clip, null);
  assert.deepEqual(proposals[1].words, [instant]);
  assert.deepEqual(proposals[1].projectFragments, [{ rowIndex: 1, ...instant.fragments[0] }]);
  assert.deepEqual(
    proposals[1].violations.map((v) => v.code),
    ["RENDERED_LAYOUT_UNVERIFIED", "MINIMUM_DWELL", "INSTANT_WORD", "READING_SPEED_UNDEFINED"],
  );
  assert.equal(proposals[2].clip.source.text, "two");
});

test("overlapping estimates use the widest exact envelope for dwell, speed and placement", () => {
  const end = { numerator: 2000001, denominator: 2 };
  const input = request([word(0, "first", 0, end), word(1, "next", 200000, 400000)]);
  input.corrections = [];
  input.constraints.breakOnPunctuation = false;
  input.constraints.maxCps = 10;
  const proposal = captionProposals(input).proposals[0];
  assert.deepEqual(proposal.rowIndexes, [0, 1]);
  assert.deepEqual(proposal.clip.placement.sourceRange, { startUs: 0, endUs: end });
  assert.deepEqual(
    proposal.clip.seed.words,
    input.entry.rows.map((row) => ({ ordinal: row.ordinal, sourceRange: row.sourceRange })),
  );
  assert.equal(
    proposal.violations.some((v) => ["MINIMUM_DWELL", "READING_SPEED"].includes(v.code)),
    false,
  );
});

test("explicit highlighting maps corrected wrapped UTF-16 words to retained overlapping source windows", () => {
  const input = request([
    word(0, "wrong", 0, 900000),
    word(1, "emoji", 200000, 500000),
    word(2, "discard", 500000, 800000),
    word(3, "trend", 700000, 1000000),
  ]);
  input.corrections = [
    { rowIndex: 0, text: "cafe\u0301" },
    { rowIndex: 1, text: "🧪" },
    { rowIndex: 2, text: "" },
  ];
  input.style.highlight = { activeColor: "#ffcc00ff", inactiveColor: "#ffffffff" };
  Object.assign(input.constraints, { widthGraphemes: 7, breakOnPunctuation: false });
  const draft = captionProposals(input).proposals[0];
  assert.equal(draft.text, "cafe\u0301 🧪 \ntrend");
  assert.deepEqual(draft.clip.source.timedWords, [
    { range: [0, 5], sourceRange: { startUs: 0, endUs: 900000 } },
    { range: [6, 8], sourceRange: { startUs: 200000, endUs: 500000 } },
    { range: [10, 15], sourceRange: { startUs: 700000, endUs: 1000000 } },
  ]);
  assert.deepEqual(
    draft.clip.seed.words,
    input.entry.rows.map(({ ordinal, sourceRange }) => ({ ordinal, sourceRange })),
  );
  assert.deepEqual(draft.words, input.entry.rows);
});

test("highlight runs preserve fragmented support and repeated occurrence identity without widening estimates", () => {
  const records = [
    word(0, "trend", 0, 1000000, {
      partial: true,
      fragments: [
        { source: { startUs: 100000, endUs: 300000 }, project: { startUs: 50000, endUs: 150000 } },
        { source: { startUs: 600000, endUs: 900000 }, project: { startUs: 300000, endUs: 450000 } },
      ],
    }),
    word(0, "trend", 0, 1000000, { clipId: "repeat" }),
  ];
  const input = request(records);
  input.corrections = [{ rowIndex: 0, text: "Trend!" }];
  input.style.highlight = { activeColor: "#ffcc00ff", inactiveColor: "#ffffffff" };
  const [partial, repeat] = captionProposals(input).proposals;
  assert.deepEqual(partial.clip.source.timedWords, [
    { range: [0, 6], sourceRange: { startUs: 100000, endUs: 300000 } },
    { range: [0, 6], sourceRange: { startUs: 600000, endUs: 900000 } },
  ]);
  assert.deepEqual(partial.clip.seed.words, [
    { ordinal: 0, sourceRange: { startUs: 0, endUs: 1000000 } },
  ]);
  assert.deepEqual(
    partial.violations.filter(({ code }) => ["PARTIAL_WORD", "DISCONTINUOUS_WORD"].includes(code)),
    [
      { code: "PARTIAL_WORD", rowIndex: 0 },
      { code: "DISCONTINUOUS_WORD", rowIndex: 0 },
    ],
  );
  assert.equal(repeat.clip.seed.occurrenceClipId, "repeat");
  assert.deepEqual(repeat.clip.source.timedWords, [
    { range: [0, 5], sourceRange: { startUs: 0, endUs: 1000000 } },
  ]);
});
