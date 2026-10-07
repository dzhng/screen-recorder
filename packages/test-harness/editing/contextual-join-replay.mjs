import assert from "node:assert/strict";

function observedCase(name, value) {
  const join = value?.join;
  const recognition = join?.rendered?.recognition;
  if (!join || recognition?.state !== "observed") return null;
  const edgeRMS = join.audio?.discontinuity?.edgeRMS ?? [];
  const tailRMS = edgeRMS.at(-1)?.channels?.[0]?.rms;
  if (!Number.isFinite(tailRMS)) return null;
  return {
    name,
    join,
    recognition,
    observedText: recognition.textComparison?.observedText ?? "",
    expectedText: recognition.textComparison?.expectedText ?? join.expectedText ?? "",
    tailRMS,
  };
}

/**
 * Turn public contextual evidence into one caller-authored repair plan. This is
 * deliberately a fixture/consumer decision: the product only reports evidence.
 */
export function discoverContextualRepair(report) {
  const cases = Object.entries(report?.fixtures ?? {})
    .map(([name, value]) => observedCase(name, value))
    .filter(Boolean);
  const suspect = cases
    .filter(
      (value) =>
        value.expectedText &&
        value.observedText &&
        value.observedText.toLocaleLowerCase() !== value.expectedText.toLocaleLowerCase() &&
        value.tailRMS > (value.join.thresholdRMS ?? 0),
    )
    .sort((a, b) => b.tailRMS - a.tailRMS)[0];
  assert(suspect, "No energetic clipped Parakeet edge was discoverable");

  const control = cases
    .filter(
      (value) =>
        value.name === "intact" &&
        value.name !== suspect.name &&
        value.join.boundary?.before?.assetId === suspect.join.boundary?.before?.assetId &&
        value.join.boundary?.before?.streamId === suspect.join.boundary?.before?.streamId &&
        value.join.boundary?.before?.sourceAtUs > suspect.join.boundary.before.sourceAtUs &&
        value.tailRMS <= (value.join.thresholdRMS ?? 0),
    )
    .sort((a, b) => a.tailRMS - b.tailRMS)[0];
  assert(control, "No complete intact control was available for contextual repair");

  const endUs = control.join.boundary.before.sourceAtUs;
  const boundary = suspect.join.boundary.before;
  return {
    caseName: suspect.name,
    expectedText: suspect.expectedText,
    observedText: suspect.observedText,
    tailRMS: suspect.tailRMS,
    projectId: suspect.join.projectId,
    revisionId: suspect.join.revisionId,
    clipId: boundary.clipId,
    assetId: boundary.assetId,
    streamId: boundary.streamId,
    trackId: suspect.join.boundary.trackId,
    sourceRange: { startUs: 0, endUs },
    projectRange: { startUs: 0, endUs },
    boundaryAtUs: suspect.join.boundary.projectAtUs,
    controlCaseName: control.name,
  };
}
