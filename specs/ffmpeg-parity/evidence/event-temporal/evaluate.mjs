// Exact frozen category/bin evaluator, no inference. Writes fresh phase report.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { patchOccupancy, occupancyCounts } from "./bins.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => JSON.parse(readFileSync(join(root, path)));
const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");
const role = process.argv[2];
assert(["development", "confirmation"].includes(role));
const protocol = read("frozen-protocol.json");
const selection = read("selection.json");
const cases = selection.cases.filter((row) => row.role === role);
let selected = null;
if (role === "confirmation") {
  const decision = read("threshold-decision.json");
  assert(decision.frozenBeforeConfirmation);
  for (const [key, path] of [
    ["protocolSha256", "frozen-protocol.json"],
    ["mappingSha256", "bins.mjs"],
    ["developmentReportSha256", "development-report.json"],
  ])
    assert.equal(decision[key], hash(path), "Frozen " + key);
  selected = decision.selectedThresholds;
  assert(Object.keys(selected).length > 0, "No qualified named categories");
}
const outcomes = {};
for (const [category, definition] of Object.entries(protocol.categories)) {
  if (selected && !Object.hasOwn(selected, category)) continue;
  const curve = [];
  const thresholds = selected ? [selected[category]] : protocol.thresholdGrid;
  for (const threshold of thresholds) {
    const perCase = [];
    for (const source of cases) {
      const raw = read("results/" + source.id + ".json");
      assert.equal(raw.modelSha256, protocol.provider.modelSha256);
      const scoreBytes = readFileSync(join(root, "results/" + source.id + ".json.scores.json.gz"));
      const scores = JSON.parse(gunzipSync(scoreBytes));
      assert.equal(scores.length, raw.scoreShape[0]);
      assert(scores.every((row) => row.length === 521 && row.every(Number.isFinite)));
      const prediction = patchOccupancy(
        scores,
        definition.providerClassIndex,
        threshold,
        320000,
        protocol.patchMapping,
      );
      const counts = occupancyCounts(source.referenceOccupancy[category], prediction);
      perCase.push({
        id: source.id,
        reference: source.referenceOccupancy[category],
        prediction,
        counts,
        rawSha256: hash("results/" + source.id + ".json"),
        scoresSha256: createHash("sha256").update(scoreBytes).digest("hex"),
      });
    }
    const total = {
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 0,
      unknownPositive: 0,
      unknownNegative: 0,
      positiveBins: 0,
      negativeBins: 0,
      predictedPositiveBins: 0,
    };
    for (const row of perCase) for (const key of Object.keys(total)) total[key] += row.counts[key];
    const precision = total.tp + total.fp ? total.tp / (total.tp + total.fp) : null;
    const recall = total.tp + total.fn ? total.tp / (total.tp + total.fn) : null;
    const f1 =
      precision !== null && recall !== null && precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    curve.push({
      threshold,
      perCase,
      total,
      precision,
      recall,
      f1,
      passed:
        precision !== null &&
        recall !== null &&
        precision >= protocol.gate.precision &&
        recall >= protocol.gate.recall,
    });
  }
  const eligible = curve
    .filter((row) => row.passed)
    .sort((a, b) => b.f1 - a.f1 || b.threshold - a.threshold);
  outcomes[category] = {
    curve,
    selectedThreshold:
      role === "development" ? (eligible[0]?.threshold ?? null) : selected[category],
    passed: role === "development" ? eligible.length > 0 : curve[0].passed,
  };
}
const report = {
  role,
  protocolSha256: hash("frozen-protocol.json"),
  selectionSha256: hash("selection.json"),
  mappingSha256: hash("bins.mjs"),
  outcomes,
  unsupported: protocol.unsupported,
  scope:
    "100ms referenceoccupancy,975ms modelcontext and480ms hop; no preciseonset/end, populationquality or editorial authorization",
};
writeFileSync(join(root, role + "-report.json"), JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
if (role === "development") {
  const selectedThresholds = Object.fromEntries(
    Object.entries(outcomes)
      .filter(([, value]) => value.passed)
      .map(([category, value]) => [category, value.selectedThreshold]),
  );
  writeFileSync(
    join(root, "threshold-decision.json"),
    JSON.stringify(
      {
        frozenBeforeConfirmation: true,
        protocolSha256: report.protocolSha256,
        developmentReportSha256: hash("development-report.json"),
        mappingSha256: report.mappingSha256,
        selectedThresholds,
        confirmationExecuted: false,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
}
console.log(
  JSON.stringify({
    role,
    outcomes: Object.fromEntries(
      Object.entries(outcomes).map(([category, value]) => [
        category,
        {
          passed: value.passed,
          selectedThreshold: value.selectedThreshold,
          curve: value.curve.map(({ threshold, total, precision, recall, passed }) => ({
            threshold,
            total,
            precision,
            recall,
            passed,
          })),
        },
      ]),
    ),
    unsupported: protocol.unsupported,
  }),
);
