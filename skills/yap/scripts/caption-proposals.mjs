import { pathToFileURL } from "node:url";
import { budget, failure, runJsonHelper } from "./inspection-artifacts.mjs";

const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
const length = (text) => [...graphemes.segment(text)].length;
const sentenceEnd = /[.!?。！？]["'”’»）)]*$/u;
const time = (value) => {
  const n = typeof value === "number" ? value : value?.numerator;
  const d = typeof value === "number" ? 1 : value?.denominator;
  if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(d) || d <= 0)
    throw failure(
      "INVALID_REQUEST",
      "Word coordinates must be exact nonnegative rational microseconds",
    );
  return [BigInt(n), BigInt(d)];
};
const gapCompare = (start, end, us) => {
  const [sn, sd] = time(start),
    [en, ed] = time(end);
  const actual = sn * ed - en * sd,
    expected = BigInt(us) * sd * ed;
  return actual < expected ? -1 : actual > expected ? 1 : 0;
};
const gapAtLeast = (start, end, us) => gapCompare(start, end, us) >= 0;
const compare = (a, b) => {
  const [an, ad] = time(a),
    [bn, bd] = time(b);
  return an * bd < bn * ad ? -1 : an * bd > bn * ad ? 1 : 0;
};
const identity = (row) =>
  JSON.stringify([
    row.clipId,
    row.trackId,
    row.assetId,
    row.streamId,
    row.acquisitionId ?? null,
    row.generation,
    row.segment,
  ]);
const start = (row) => row.fragments[0].project.startUs;
const end = (row) => row.fragments.at(-1).project.endUs;
function appendLine(currentLines, token, separator, width, hasPrior = false) {
  const current = currentLines.at(-1);
  const candidate = current + (hasPrior ? separator : "") + token;
  const parts = candidate.split("\n");
  if (current && !separator.includes("\n") && length(parts[0]) > width)
    currentLines.push(...((separator.trim() ? separator : "") + token).split("\n"));
  else currentLines.splice(currentLines.length - 1, 1, ...parts);
}
const nonempty = (value) => typeof value === "string" && value.length > 0;

/** Pure drafts: no CLI calls, transcript preparation, project mutation or font-fit claim. */
export function captionProposals(request) {
  const entry = request.entry;
  if (!entry || !Array.isArray(entry.rows) || entry.rows.length > 10000)
    throw failure("INVALID_REQUEST", "Supply one compact transcript entry with at most 10000 rows");
  const { rowIndexes } = request;
  if (
    !Array.isArray(rowIndexes) ||
    !rowIndexes.length ||
    rowIndexes.length > 10000 ||
    rowIndexes.some(
      (index, i) =>
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= entry.rows.length ||
        (i && index <= rowIndexes[i - 1]),
    )
  )
    throw failure("INVALID_REQUEST", "Select explicit distinct row indexes in evidence order");
  const constraints = request.constraints;
  if (!constraints || typeof constraints !== "object")
    throw failure("INVALID_REQUEST", "Supply explicit caption constraints");
  const width = budget(constraints.widthGraphemes, undefined, 1, 8192, "widthGraphemes");
  const maxLines = budget(constraints.maxLines, undefined, 1, 32, "maxLines");
  const minimum = budget(constraints.minDwellUs, undefined, 1, 3600000000, "minDwellUs");
  const maximum = budget(constraints.maxDwellUs, undefined, minimum, 3600000000, "maxDwellUs");
  const maxCps = budget(constraints.maxCps, undefined, 1, 1000, "maxCps");
  const pause = budget(constraints.pauseUs, undefined, 1, 3600000000, "pauseUs");
  if (
    typeof constraints.breakOnPunctuation !== "boolean" ||
    typeof constraints.separator !== "string" ||
    constraints.separator.length > 32
  )
    throw failure(
      "INVALID_REQUEST",
      "Choose punctuation breaking and a separator of at most 32 UTF16 units",
    );
  const { style, canvas } = request;
  if (
    !style ||
    !canvas ||
    !nonempty(request.trackId) ||
    !nonempty(style.font?.assetId) ||
    !nonempty(style.font?.postScriptName)
  )
    throw failure(
      "INVALID_REQUEST",
      "Supply a caption track, exact font asset/face, canvas and text style",
    );
  for (const [name, value, limit] of [
    ["canvas.width", canvas.width, 4096],
    ["canvas.height", canvas.height, 4096],
    ["style.width", style.width, 4096],
    ["style.height", style.height, 4096],
  ])
    budget(value, undefined, 1, limit, name);
  if (
    !Number.isFinite(style.size) ||
    style.size <= 0 ||
    style.size > 512 ||
    !/^#[0-9a-f]{8}$/i.test(style.color) ||
    !["left", "center", "right"].includes(style.alignment) ||
    typeof style.wrap !== "boolean"
  )
    throw failure("INVALID_REQUEST", "Supply an admissible explicit text style");
  const area = constraints.safeArea;
  if (
    !area ||
    [area.x, area.y, area.width, area.height].some((value) => !Number.isFinite(value)) ||
    area.width <= 0 ||
    area.height <= 0
  )
    throw failure("INVALID_REQUEST", "Supply a positive finite safe-area rectangle");
  const violations = [];
  const known = new Set([
    "widthGraphemes",
    "maxLines",
    "minDwellUs",
    "maxDwellUs",
    "maxCps",
    "pauseUs",
    "breakOnPunctuation",
    "separator",
    "safeArea",
  ]);
  for (const key of Object.keys(constraints))
    if (!known.has(key)) violations.push({ code: "UNSUPPORTED_CONSTRAINT", constraint: key });
  const output = {
    version: 1,
    identity: entry.identity,
    rowIndexes,
    constraints,
    proposals: [],
    violations,
  };
  const finish = () => {
    const maxBytes = budget(request.maxBytes, 1024 * 1024, 1024, 8 * 1024 * 1024, "maxBytes");
    if (Buffer.byteLength(JSON.stringify(output) + "\n") > maxBytes)
      throw failure(
        "OUTPUT_BUDGET_EXCEEDED",
        "Pinned caption proposals exceed maxBytes; select fewer rows or increase the budget",
      );
    return output;
  };
  if (!entry.identity?.projectId || !entry.identity?.revisionId) {
    violations.push({ code: "PROJECT_PROJECTION_REQUIRED" });
    return finish();
  }
  if (entry.state !== "ready" || !entry.complete) {
    violations.push({ code: "INCOMPLETE_EVIDENCE", state: entry.state, complete: entry.complete });
    return finish();
  }
  const corrections = new Map();
  for (const correction of request.corrections ?? []) {
    if (
      !rowIndexes.includes(correction.rowIndex) ||
      corrections.has(correction.rowIndex) ||
      typeof correction.text !== "string" ||
      correction.text.length > 8192
    )
      throw failure(
        "INVALID_REQUEST",
        "Corrections must name unique selected word rows and preserve bounded display text",
      );
    corrections.set(correction.rowIndex, correction.text);
  }
  const selected = rowIndexes.map((index) => {
    const row = entry.rows[index];
    if (
      row.type !== "word" ||
      !nonempty(row.clipId) ||
      !nonempty(row.trackId) ||
      !nonempty(row.assetId) ||
      !nonempty(row.streamId) ||
      !nonempty(row.generation) ||
      !Number.isSafeInteger(row.ordinal) ||
      row.ordinal < 0 ||
      typeof row.text !== "string" ||
      !Array.isArray(row.fragments) ||
      !row.fragments.length
    )
      throw failure(
        "INVALID_REQUEST",
        "Each selected row must be an exact projected word occurrence",
      );
    if (!row.sourceRange || compare(row.sourceRange.startUs, row.sourceRange.endUs) >= 0)
      throw failure("INVALID_REQUEST", "Raw word pins must have positive exact ranges");
    for (const range of row.fragments.flatMap((fragment) => [fragment.source, fragment.project]))
      if (
        !range ||
        (row.instant
          ? compare(range.startUs, range.endUs) !== 0
          : compare(range.startUs, range.endUs) >= 0)
      )
        throw failure(
          "INVALID_REQUEST",
          "Word support must be positive ranges or exact instant points",
        );
    return { index, row, text: corrections.get(index) ?? row.text };
  });
  const groups = [];
  let current = [],
    currentLines = [""];
  for (const word of selected) {
    const prior = current.at(-1);
    const candidateLines = [...currentLines];
    appendLine(candidateLines, word.text, constraints.separator, width, current.length > 0);
    const pinsFull = current.length === 1000;
    if (
      prior &&
      (pinsFull ||
        word.index !== prior.index + 1 ||
        identity(word.row) !== identity(prior.row) ||
        word.row.instant ||
        prior.row.instant ||
        word.row.partial ||
        prior.row.partial ||
        word.row.fragments.length > 1 ||
        prior.row.fragments.length > 1 ||
        gapAtLeast(start(word.row), end(prior.row), pause) ||
        (constraints.breakOnPunctuation && sentenceEnd.test(prior.text)) ||
        candidateLines.length > maxLines ||
        gapCompare(end(word.row), start(current[0].row), maximum) > 0)
    ) {
      groups.push({ words: current, lines: currentLines });
      current = [];
      currentLines = [""];
      appendLine(currentLines, word.text, constraints.separator, width);
      if (pinsFull && !violations.some((item) => item.code === "CUE_WORD_PIN_LIMIT"))
        violations.push({ code: "CUE_WORD_PIN_LIMIT", maximum: 1000 });
    } else currentLines = candidateLines;
    current.push(word);
  }
  if (current.length) groups.push({ words: current, lines: currentLines });
  if (groups.length > 1000)
    throw failure("OUTPUT_BUDGET_EXCEEDED", "Proposal exceeds 1000 cues; select fewer rows");
  const rect = {
    x: area.x + (area.width - style.width) / 2,
    y: area.y + area.height - style.height,
    width: style.width,
    height: style.height,
  };
  const safe =
    area.x >= 0 &&
    area.y >= 0 &&
    area.x + area.width <= canvas.width &&
    area.y + area.height <= canvas.height &&
    rect.x >= area.x &&
    rect.y >= area.y &&
    rect.x + rect.width <= area.x + area.width &&
    rect.y + rect.height <= area.y + area.height;
  for (const { words: group, lines: renderedLines } of groups) {
    const first = group[0].row,
      last = group.at(-1).row;
    const text = renderedLines.join("\n");
    const cueViolations = [
      {
        code: "RENDERED_LAYOUT_UNVERIFIED",
        checks: ["pixel-width", "glyph-coverage", "clipping", "contrast", "legibility"],
      },
    ];
    if (!safe) cueViolations.push({ code: "SAFE_AREA", rect, safeArea: area });
    if (!style.wrap && renderedLines.length > 1) cueViolations.push({ code: "WRAPPING_DISABLED" });
    if (renderedLines.some((line) => length(line) > width))
      cueViolations.push({ code: "GRAPHEME_WIDTH", maximum: width });
    if (renderedLines.length > maxLines)
      cueViolations.push({ code: "LINE_COUNT", maximum: maxLines });
    if (!text.trim()) cueViolations.push({ code: "EMPTY_DISPLAY_TEXT" });
    if (text.length > 8192)
      cueViolations.push({ code: "TEXT_SIZE_LIMIT", maximumUTF16Units: 8192 });
    if (!gapAtLeast(end(last), start(first), minimum))
      cueViolations.push({ code: "MINIMUM_DWELL", minimumUs: minimum });
    if (gapCompare(end(last), start(first), maximum) > 0)
      cueViolations.push({ code: "MAXIMUM_DWELL", maximumUs: maximum });
    if (first.instant) cueViolations.push({ code: "INSTANT_WORD", rowIndex: group[0].index });
    const [en, ed] = time(end(last)),
      [sn, sd] = time(start(first));
    const readingNumerator = BigInt(length(text.replaceAll("\n", ""))) * 1000000n * ed * sd,
      durationNumerator = en * sd - sn * ed;
    if (first.instant) cueViolations.push({ code: "READING_SPEED_UNDEFINED" });
    else if (readingNumerator > BigInt(maxCps) * durationNumerator)
      cueViolations.push({
        code: "READING_SPEED",
        charactersPerSecond: Number(readingNumerator) / Number(durationNumerator),
        maximum: maxCps,
      });
    for (const word of group) {
      if (word.row.partial) cueViolations.push({ code: "PARTIAL_WORD", rowIndex: word.index });
      if (word.row.fragments.length > 1)
        cueViolations.push({ code: "DISCONTINUOUS_WORD", rowIndex: word.index });
    }
    output.proposals.push({
      rowIndexes: group.map((word) => word.index),
      words: group.map((word) => word.row),
      text,
      projectFragments: group.flatMap((word) =>
        word.row.fragments.map((fragment) => ({ rowIndex: word.index, ...fragment })),
      ),
      clip: first.instant
        ? null
        : {
            trackId: request.trackId,
            source: { ...style, kind: "text", text },
            seed: {
              kind: "transcript",
              source: {
                assetId: first.assetId,
                streamId: first.streamId,
                ...(first.acquisitionId ? { acquisitionId: first.acquisitionId } : {}),
              },
              generation: first.generation,
              occurrenceClipId: first.clipId,
              words: group.map(({ row }) => ({
                ordinal: row.ordinal,
                sourceRange: row.sourceRange,
              })),
            },
            placement: {
              kind: "content",
              clipId: first.clipId,
              sourceRange: {
                startUs: first.fragments[0].source.startUs,
                endUs: last.fragments.at(-1).source.endUs,
              },
            },
          },
      geometry: {
        processor: {
          type: "geometry",
          crop: { x: 0, y: 0, width: style.width, height: style.height },
          rect,
          fit: "contain",
          scale: { x: 1, y: 1 },
          rotationDeg: 0,
          pivot: { x: 0.5, y: 0.5 },
        },
      },
      violations: cueViolations,
    });
  }
  return finish();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--help"))
    console.log(
      "Usage: node caption-proposals.mjs < request.json\nPure caption drafts from one complete pinned compact-transcript entry, explicit rowIndexes/corrections, caption track, canvas, text style and constraints. Constraints: widthGraphemes, maxLines, minDwellUs/maxDwellUs, maxCps, pauseUs, breakOnPunctuation, separator, safeArea {x,y,width,height}; optional maxBytes. Returns ordinary text clip/geometry drafts, exact word pins/fragments and violations. Instant points retain evidence with clip:null and explicit unsupported dwell/speed. Never calls CLI, transcribes or applies edits. Pixel/glyph fit requires explicit application and actual frame.get inspection.",
    );
  else await runJsonHelper(captionProposals);
}
