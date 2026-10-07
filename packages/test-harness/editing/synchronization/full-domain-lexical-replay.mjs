import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, "")
    .trim();

const wordsFrom = (bytes) =>
  Buffer.from(bytes)
    .toString("utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => JSON.parse(line).words ?? [])
    .map((word) => normalize(word.text))
    .filter(Boolean);

const ngrams = (words, length) => {
  const values = new Set();
  for (let index = 0; index + length <= words.length; index += 1) {
    values.add(words.slice(index, index + length).join(" "));
  }
  return values;
};

const longestSharedAcrossParticipants = (sources, wordsBySource) => {
  let longest = 0;
  const shared = [];
  for (let left = 0; left < sources.length; left += 1) {
    for (let right = left + 1; right < sources.length; right += 1) {
      if (sources[left].participant === sources[right].participant) continue;
      for (let length = 1; length <= 12; length += 1) {
        const rightGrams = ngrams(wordsBySource[sources[right].name], length);
        for (const gram of ngrams(wordsBySource[sources[left].name], length)) {
          if (!rightGrams.has(gram)) continue;
          longest = Math.max(longest, length);
          if (length >= 5) shared.push(`${sources[left].name}:${sources[right].name}:${gram}`);
        }
      }
    }
  }
  return { longest, shared };
};

/** Replay the full-domain lexical refusal without rerunning native inference. */
export async function replayFullDomainLexicalScout(reportPath) {
  const resolved = resolve(reportPath);
  const report = JSON.parse(await readFile(resolved, "utf8"));
  assert.equal(report.kind, "full-domain-lexical-scout");
  assert.equal(report.status, "refused", "a refused lexical scout cannot be promoted by editing JSON");
  assert.equal(report.promotion, false);

  const directory = dirname(resolved);
  const protocolBytes = await readFile(join(directory, "protocol.json"));
  const protocol = JSON.parse(protocolBytes);
  assert.equal(protocol.kind, "full-domain-lexical-scout-v1");
  assert.deepEqual(protocol.sourceSelection, {
    windowUs: 20_000_000,
    gapUs: 1_000_000,
    context: { beforeUs: 0, afterUs: 0 },
    recipe: "source-windows-20s-context4s-guard1s-v2",
  }, "lexical source-selection protocol changed");
  assert.equal(
    protocol.normalization,
    "lowercase ASCII alphanumeric apostrophe tokens; exact contiguous n-grams",
    "lexical normalization protocol changed",
  );
  assert.deepEqual(protocol.anchorRule, {
    minimumWords: 5,
    requiresDistinctSourceFiles: true,
    requiresThreeSeparatedMatches: true,
    maximumOffsetSpreadUs: 2_000_000,
  }, "lexical anchor rule changed");
  assert.equal(typeof protocol.runtime?.nativeSha256, "string");
  assert.equal(typeof protocol.runtime?.modelReceiptSha256, "string");
  assert.equal(report.protocolSha256, digest(protocolBytes));
  assert.deepEqual(report.sources, protocol.sources);
  assert.deepEqual(report.files, protocol.files);

  const wordsBySource = {};
  let wordCount = 0;
  let windowCount = 0;
  for (const file of protocol.files) {
    const compressed = await readFile(join(directory, file.compressedPath));
    assert.equal(digest(compressed), file.compressedSha256, `${file.name}: compressed identity changed`);
    const raw = gunzipSync(compressed);
    assert.equal(digest(raw), file.rawSha256, `${file.name}: transcript identity changed`);
    const lines = raw.toString("utf8").trim().split("\n").filter(Boolean);
    windowCount += lines.length;
    wordsBySource[file.name] = wordsFrom(raw);
    wordCount += wordsBySource[file.name].length;
  }

  const { longest, shared } = longestSharedAcrossParticipants(protocol.sources, wordsBySource);
  assert.equal(report.observations.sourceCount, protocol.sources.length);
  assert.equal(report.observations.windowCount, windowCount);
  assert.equal(report.observations.transcribedWordCount, wordCount);
  assert.equal(report.observations.crossParticipantAnchorCount, shared.length);
  assert.equal(report.observations.longestCrossParticipantNgram, longest);
  assert.match(report.refusal?.reason ?? "", /no cross-participant exact five-word anchor/i);
  return {
    status: report.status,
    promotion: report.promotion,
    sourceCount: protocol.sources.length,
    crossParticipantAnchorCount: shared.length,
    longestCrossParticipantNgram: longest,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node full-domain-lexical-replay.mjs <report.json>");
  console.log(JSON.stringify(await replayFullDomainLexicalScout(process.argv[2])));
}
