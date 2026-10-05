// Bounded research metrics; labels and raw candidate operands stay separate.
export function diarizationScore(reference, prediction, duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid duration");
  for (const intervals of [reference, prediction]) {
    if (!Array.isArray(intervals) || intervals.length > 1000)
      throw new Error("Unbounded intervals");
    for (const interval of intervals)
      if (
        ![interval.start, interval.end].every(Number.isFinite) ||
        interval.start < 0 ||
        interval.end > duration ||
        interval.end <= interval.start ||
        !(interval.speaker === null || typeof interval.speaker === "string")
      )
        throw new Error("Invalid interval");
  }
  const refs = [...new Set(reference.map((r) => r.speaker))].filter((s) => s !== null).sort();
  const preds = [...new Set(prediction.map((r) => r.speaker))].filter((s) => s !== null).sort();
  if (refs.length > 8 || preds.length > 16) throw new Error("Unbounded speaker labels");
  const points = [
    ...new Set([
      0,
      duration,
      ...reference.flatMap((r) => [r.start, r.end]),
      ...prediction.flatMap((r) => [r.start, r.end]),
    ]),
  ].sort((a, b) => a - b);
  const regions = points.slice(1).map((end, index) => {
    const start = points[index],
      midpoint = (start + end) / 2;
    return {
      duration: end - start,
      refs: new Set(
        reference
          .filter((r) => r.start <= midpoint && r.end > midpoint && r.speaker !== null)
          .map((r) => r.speaker),
      ),
      preds: new Set(
        prediction
          .filter((r) => r.start <= midpoint && r.end > midpoint && r.speaker !== null)
          .map((r) => r.speaker),
      ),
    };
  });
  const weights = preds.map((p) =>
    refs.map((r) =>
      regions.reduce(
        (sum, region) => sum + (region.preds.has(p) && region.refs.has(r) ? region.duration : 0),
        0,
      ),
    ),
  );
  let states = new Map([[0, { weight: 0, mapping: {} }]]);
  for (let i = 0; i < preds.length; i++) {
    const next = new Map(states);
    for (const [mask, state] of states)
      for (let j = 0; j < refs.length; j++)
        if (!(mask & (1 << j))) {
          const updated = {
              weight: state.weight + weights[i][j],
              mapping: { ...state.mapping, [preds[i]]: refs[j] },
            },
            key = mask | (1 << j);
          if (!next.has(key) || updated.weight > next.get(key).weight) next.set(key, updated);
        }
    states = next;
  }
  const best = [...states.values()].reduce((a, b) => (b.weight > a.weight ? b : a));
  let referenceSpeakerSeconds = 0,
    overlapSeconds = 0,
    missedSpeakerSeconds = 0,
    falseSpeakerSeconds = 0,
    confusedSpeakerSeconds = 0,
    silenceSeconds = 0;
  for (const region of regions) {
    const r = region.refs.size,
      p = region.preds.size;
    const correct = [...region.preds].filter((s) => region.refs.has(best.mapping[s])).length;
    referenceSpeakerSeconds += r * region.duration;
    overlapSeconds += r > 1 ? region.duration : 0;
    silenceSeconds += r === 0 ? region.duration : 0;
    missedSpeakerSeconds += Math.max(0, r - p) * region.duration;
    falseSpeakerSeconds += Math.max(0, p - r) * region.duration;
    confusedSpeakerSeconds += (Math.min(r, p) - correct) * region.duration;
  }
  return {
    referenceSpeakerSeconds,
    overlapSeconds,
    silenceSeconds,
    missedSpeakerSeconds,
    falseSpeakerSeconds,
    confusedSpeakerSeconds,
    mapping: best.mapping,
    der: referenceSpeakerSeconds
      ? (missedSpeakerSeconds + falseSpeakerSeconds + confusedSpeakerSeconds) /
        referenceSpeakerSeconds
      : null,
  };
}

export function eventScores(records, categories, threshold) {
  return Object.fromEntries(
    categories.map((category) => {
      const truePositives = [],
        falsePositives = [],
        falseNegatives = [],
        trueNegatives = [];
      for (const record of records) {
        const score = record.scores[category];
        if (!Number.isFinite(score) || score < 0 || score > 1)
          throw new Error("Missing/invalid score");
        const truth = record.labels.includes(category),
          predicted = score >= threshold;
        (truth
          ? predicted
            ? truePositives
            : falseNegatives
          : predicted
            ? falsePositives
            : trueNegatives
        ).push(record.id);
      }
      return [
        category,
        {
          truePositives,
          falsePositives,
          falseNegatives,
          trueNegatives,
          precision:
            truePositives.length + falsePositives.length
              ? truePositives.length / (truePositives.length + falsePositives.length)
              : null,
          recall:
            truePositives.length + falseNegatives.length
              ? truePositives.length / (truePositives.length + falseNegatives.length)
              : null,
        },
      ];
    }),
  );
}
