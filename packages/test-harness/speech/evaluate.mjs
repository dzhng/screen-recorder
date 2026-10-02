export const normalizeWord = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  if (p === 0.5 && Number.isInteger(middle)) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[Math.ceil(sorted.length * p) - 1];
}

// Sequence alignment preserves repeated occurrences; a bag of words hides omissions.
export function alignWords(expected, actual, tieCost = () => -1) {
  const width = actual.length + 1;
  const steps = new Uint8Array((expected.length + 1) * width);
  let previous = Uint32Array.from({ length: width }, (_, i) => i);
  let previousTieCost = new Float64Array(width);
  for (let i = 1; i <= expected.length; i++) {
    const row = new Uint32Array(width);
    const tieCostRow = new Float64Array(width);
    row[0] = i;
    for (let j = 1; j < width; j++) {
      const same = normalizeWord(expected[i - 1].text) === normalizeWord(actual[j - 1].text);
      const costs = [previous[j - 1] + (same ? 0 : 1), previous[j] + 1, row[j - 1] + 1];
      // Prefer more exact matches on text-only ties. A boundary-aware caller can
      // supply its distance instead; neither policy excuses a lexical error.
      const tieCosts = [
        previousTieCost[j - 1] + (same ? tieCost(expected[i - 1], actual[j - 1]) : 0),
        previousTieCost[j],
        tieCostRow[j - 1],
      ];
      let best = 0;
      for (let choice = 1; choice < 3; choice++) {
        if (
          costs[choice] < costs[best] ||
          (costs[choice] === costs[best] && tieCosts[choice] < tieCosts[best])
        )
          best = choice;
      }
      row[j] = costs[best];
      tieCostRow[j] = tieCosts[best];
      steps[i * width + j] = best;
    }
    previous = row;
    previousTieCost = tieCostRow;
  }
  const matches = [];
  let i = expected.length,
    j = actual.length;
  while (i || j) {
    const step = !i ? 2 : !j ? 1 : steps[i * width + j];
    if (step === 0) {
      i--;
      j--;
      if (normalizeWord(expected[i].text) === normalizeWord(actual[j].text)) matches.push([i, j]);
    } else if (step === 1) i--;
    else j--;
  }
  return matches;
}

export function evaluateLexical(reference, prediction) {
  const matches = alignWords(reference, prediction);
  const expectedMatched = new Set(matches.map(([i]) => i));
  const actualMatched = new Set(matches.map(([, j]) => j));
  const fillers = Object.fromEntries(
    ["um", "uh"].map((term) => {
      const labeled = reference.filter(
        (word) => word.filler === true && normalizeWord(word.text) === term,
      ).length;
      const matched = matches.filter(
        ([i]) => reference[i].filler === true && normalizeWord(reference[i].text) === term,
      ).length;
      const extra = prediction.filter((word) => normalizeWord(word.text) === term).length - matched;
      return [term, { labeled, matched, missed: labeled - matched, extra }];
    }),
  );
  return {
    referenceWords: reference.length,
    predictedWords: prediction.length,
    matchedWords: matches.length,
    omittedWords: reference.flatMap((_, i) => (expectedMatched.has(i) ? [] : [i])),
    extraWords: prediction.flatMap((_, i) => (actualMatched.has(i) ? [] : [i])),
    fillers,
  };
}

function validateWords(words, duration) {
  if (!Array.isArray(words)) throw new Error("Expected word timing array");
  let last = -1;
  for (const word of words) {
    if (
      typeof word.text !== "string" ||
      !normalizeWord(word.text) ||
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.start < 0 ||
      word.end < word.start ||
      word.end > duration ||
      word.start < last
    ) {
      throw new Error("Invalid or unordered word timing");
    }
    last = word.start;
  }
}

function interval95(successes, total) {
  if (!total) return null;
  const p = successes / total,
    z = 1.96,
    denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const radius =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

export function evaluate(dataset, runs) {
  if (!Array.isArray(dataset.clips) || !Array.isArray(dataset.fillerTerms))
    throw new Error("Expected clips and fillerTerms");
  const failures = [],
    pending = [],
    errors = [],
    perClip = [];
  const terms = new Set(dataset.fillerTerms.map(normalizeWord));
  if (
    new Set(
      runs.map((run) =>
        JSON.stringify([run.engine, run.modelRevision, run.runtimeRevision, run.binarySha256]),
      ),
    ).size > 1
  )
    throw new Error("Mixed model configurations");
  const byId = new Map();
  for (const run of runs) {
    if (byId.has(run.clipId)) throw new Error(`Duplicate run: ${run.clipId}`);
    byId.set(run.clipId, run);
  }
  const ids = new Set();
  let tp = 0,
    fp = 0,
    fn = 0,
    canonical = 0,
    heldClips = 0,
    walkthrough = 0;
  for (const clip of dataset.clips) {
    if (ids.has(clip.id)) throw new Error(`Duplicate clip: ${clip.id}`);
    ids.add(clip.id);
    if (
      !["canonical", "held-out", "walkthrough"].includes(clip.kind) ||
      !["human", "synthetic"].includes(clip.origin) ||
      !Number.isFinite(clip.duration) ||
      clip.duration <= 0
    )
      throw new Error("Invalid clip provenance");
    validateWords(clip.words, clip.duration);
    const run = byId.get(clip.id);
    if (!run) {
      pending.push(`Missing run: ${clip.id}`);
      continue;
    }
    if (clip.audioSha256 && clip.audioSha256 !== run.audioSha256)
      throw new Error(`Audio hash mismatch: ${clip.id}`);
    if (
      !/^[a-f0-9]{64}$/.test(clip.audioSha256 ?? "") ||
      !run.runtimeRevision ||
      !run.modelRevision ||
      !run.binarySha256 ||
      run.network !== "sandbox-deny-network"
    )
      pending.push(`Inference provenance pending: ${clip.id}`);
    validateWords(run.words, clip.duration);
    const matches = alignWords(
      clip.words,
      run.words,
      (expected, actual) =>
        Math.abs(expected.start - actual.start) + Math.abs(expected.end - actual.end),
    );
    const expectedMatched = new Set(matches.map(([i]) => i));
    const predictedFillers = run.words
      .map((w, i) => (terms.has(normalizeWord(w.text)) ? i : -1))
      .filter((i) => i >= 0);
    const fillerMatches = matches.filter(
      ([i, j]) => clip.words[i].filler === true && predictedFillers.includes(j),
    );
    const labeledFillers = clip.words.filter((w) => w.filler === true).length;
    const missedRequired = clip.words.flatMap((w, i) =>
      w.required === true && !expectedMatched.has(i) ? [i] : [],
    );
    const missedFillers = clip.words.flatMap((w, i) =>
      w.filler === true && !expectedMatched.has(i) ? [i] : [],
    );
    const boundaries = matches.flatMap(([i, j]) => [
      Math.abs(clip.words[i].start - run.words[j].start),
      Math.abs(clip.words[i].end - run.words[j].end),
    ]);
    perClip.push({
      id: clip.id,
      origin: clip.origin,
      matchedWords: matches.length,
      referenceWords: clip.words.length,
      missedRequired,
      missedFillers,
      boundaryMedian: percentile(boundaries, 0.5),
      boundaryP95: percentile(boundaries, 0.95),
    });
    if (clip.origin !== "human") {
      pending.push(`Synthetic clip excluded from fidelity: ${clip.id}`);
      continue;
    }
    errors.push(...boundaries);
    if (clip.kind === "canonical") {
      canonical++;
      if (!clip.words.some((w) => w.filler) || !clip.words.some((w) => w.required))
        pending.push(`Canonical filler/repetition labels incomplete: ${clip.id}`);
      if (missedRequired.length) failures.push(`Canonical omissions: ${clip.id}`);
    }
    if (clip.kind === "held-out") {
      heldClips++;
      tp += fillerMatches.length;
      fp += predictedFillers.length - fillerMatches.length;
      fn += labeledFillers - fillerMatches.length;
    }
    if (!run.audition?.reviewer || typeof run.audition.neighboringSpeechIntact !== "boolean")
      pending.push(`Audition pending: ${clip.id}`);
    else if (!run.audition.neighboringSpeechIntact)
      failures.push(`Audition clipped speech: ${clip.id}`);
    if (clip.kind === "walkthrough" && clip.duration >= 300) {
      walkthrough++;
      if (
        run.warm !== true ||
        !Number.isFinite(run.elapsedSeconds) ||
        run.elapsedSeconds <= 0 ||
        !Number.isFinite(run.peakRssBytes) ||
        run.peakRssBytes <= 0
      )
        pending.push(`Warm resource measurement pending: ${clip.id}`);
      else {
        if (run.elapsedSeconds > clip.duration) failures.push(`Slower than realtime: ${clip.id}`);
        if (run.peakRssBytes > 4 * 1024 ** 3) failures.push(`RSS exceeds 4 GiB: ${clip.id}`);
      }
    }
  }
  for (const id of byId.keys()) if (!ids.has(id)) throw new Error(`Unknown run clip: ${id}`);
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const median = percentile(errors, 0.5),
    p95 = percentile(errors, 0.95);
  if (median !== null && median > 0.1) failures.push("Median boundary error exceeds 100 ms");
  if (p95 !== null && p95 > 0.25) failures.push("P95 boundary error exceeds 250 ms");
  const coverage = new Set(
    dataset.clips.filter((clip) => clip.origin === "human").flatMap((clip) => clip.covers ?? []),
  );
  for (const item of ["repetition", "false-start", "silence", "technical-names"]) {
    if (!coverage.has(item)) pending.push(`Human coverage pending: ${item}`);
  }
  if (!canonical) pending.push("Real canonical fixture pending");
  if (tp + fn < 40 || heldClips < 2)
    pending.push("At least 40 labeled fillers across held-out human clips required");
  if (!walkthrough) pending.push("Five-minute human walkthrough pending");
  if (!errors.length) pending.push("No matched human word boundaries");
  return {
    status: failures.length ? "fail" : pending.length ? "pending" : "pass",
    failures,
    pending,
    heldOut: {
      truePositive: tp,
      falsePositive: fp,
      falseNegative: fn,
      precision,
      recall,
      precisionWilson95: interval95(tp, tp + fp),
      recallWilson95: interval95(tp, tp + fn),
    },
    boundaries: { samples: errors.length, median, p95 },
    clips: perClip,
  };
}
