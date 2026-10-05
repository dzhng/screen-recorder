// Frozen research mapping: occupancy is classification of a coarse context patch.
// It does not infer exact event onset/end boundaries within that context.
export function patchOccupancy(rows, category, threshold, sampleCount, clock) {
  const expected =
    1 +
    Math.ceil(Math.max(0, sampleCount - clock.patchWindowSourceSamples) / clock.patchHopSamples);
  if (rows.length !== expected) throw new Error("Unproved native patch count");
  return Array.from({ length: (sampleCount / clock.sampleRate) * 10 }, (_, bin) => {
    const midpoint = ((bin + 0.5) * clock.sampleRate) / 10;
    const rawIndex = (midpoint - clock.patchWindowSourceSamples / 2) / clock.patchHopSamples;
    const index = Math.max(0, Math.min(rows.length - 1, Math.ceil(rawIndex - 0.5)));
    const center = index * clock.patchHopSamples + clock.patchWindowSourceSamples / 2;
    if (center >= sampleCount) return null;
    const score = rows[index][category];
    if (!Number.isFinite(score)) throw new Error("Invalid complete native score");
    return score >= threshold;
  });
}

export function occupancyCounts(referenceBins, prediction) {
  const reference = new Set(referenceBins);
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0,
    unknownPositive = 0,
    unknownNegative = 0;
  for (const [bin, positive] of prediction.entries()) {
    const actual = reference.has(bin);
    if (positive === null) {
      if (actual) {
        unknownPositive++;
        fn++;
      } else {
        unknownNegative++;
        tn++;
      }
    } else if (positive) {
      if (actual) tp++;
      else fp++;
    } else {
      if (actual) fn++;
      else tn++;
    }
  }
  return {
    tp,
    fp,
    fn,
    tn,
    unknownPositive,
    unknownNegative,
    positiveBins: tp + fn,
    negativeBins: fp + tn,
    predictedPositiveBins: tp + fp,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
  };
}
