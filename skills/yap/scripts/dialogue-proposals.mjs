import { pathToFileURL } from "node:url";
import { budget, failure, runJsonHelper } from "./inspection-artifacts.mjs";

const nonempty = (value) => typeof value === "string" && value.length > 0;
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const coordinate = (value) => {
  const n = typeof value === "number" ? value : value?.numerator;
  const d = typeof value === "number" ? 1 : value?.denominator;
  if (!Number.isSafeInteger(n) || n < 0 || !positiveInteger(d))
    throw failure("INVALID_REQUEST", "Keep exact nonnegative rational measurement ranges");
  return [BigInt(n), BigInt(d)];
};

/** Pure per-occurrence drafts; no inspection, inference or edit execution. */
export function dialogueProposals(request) {
  if (
    !request ||
    !nonempty(request.projectId) ||
    !nonempty(request.revisionId) ||
    !Number.isFinite(request.targetIntegratedLufs) ||
    !Number.isFinite(request.truePeakCeilingDbtp) ||
    !["refuse", "cap-gain"].includes(request.peakPolicy) ||
    !Number.isFinite(request.gainBounds?.minimumDb) ||
    !Number.isFinite(request.gainBounds?.maximumDb) ||
    request.gainBounds.minimumDb > request.gainBounds.maximumDb ||
    !Array.isArray(request.clips) ||
    !request.clips.length ||
    request.clips.length > 1000
  )
    throw failure(
      "INVALID_REQUEST",
      "Supply explicit project/revision, finite targets/bounds, peakPolicy and 1–1000 selected clips",
    );
  budget(request.minimumDurationUs, undefined, 1, 3600000000, "minimumDurationUs");
  const seen = new Set();
  for (const { clipId, evidence: e } of request.clips) {
    if (
      !nonempty(clipId) ||
      seen.has(clipId) ||
      e?.kind !== "loudness" ||
      e.domain !== "project" ||
      e.projectId !== request.projectId ||
      e.revisionId !== request.revisionId ||
      e.tap?.target?.kind !== "clip" ||
      e.tap.target.id !== clipId ||
      e.tap?.point?.kind !== "processed" ||
      e.truePeak !== true ||
      e.channelInterpretation !== "native" ||
      !nonempty(e.audio?.jobId) ||
      !positiveInteger(e.audio?.generation) ||
      !positiveInteger(e.generation) ||
      !nonempty(e.implementationId) ||
      !/^[a-f0-9]{64}$/.test(e.signalRecipe?.sha256 ?? "") ||
      !["full-signal", "excerpt"].includes(e.scope) ||
      !positiveInteger(e.sampleRate) ||
      !positiveInteger(e.channels) ||
      !Number.isSafeInteger(e.sampleRange?.start) ||
      e.sampleRange.start < 0 ||
      !positiveInteger(e.sampleRange?.end) ||
      e.sampleRange.end <= e.sampleRange.start ||
      !Array.isArray(e.unavailable) ||
      e.unavailable.some((item) => !Array.isArray(item?.ranges)) ||
      !e.measurement ||
      [e.measurement.integratedLufs, e.measurement.truePeakDbtp].some(
        (value) => value !== null && !Number.isFinite(value),
      )
    )
      throw failure(
        "INVALID_REQUEST",
        "Each selection must have one distinct occurrence and delivered processed-clip loudness evidence at the pinned revision",
      );
    const [sn, sd] = coordinate(e.range?.startUs),
      [en, ed] = coordinate(e.range?.endUs);
    if (sn * ed >= en * sd) throw failure("INVALID_REQUEST", "Keep a positive measured range");
    seen.add(clipId);
  }
  return {
    projectId: request.projectId,
    revisionId: request.revisionId,
    proposals: request.clips.map(({ clipId, evidence }) => {
      const requestedGainDb = request.targetIntegratedLufs - evidence.measurement.integratedLufs;
      const { measurement, ...pin } = evidence;
      const common = { clipId, pin: structuredClone(pin), before: structuredClone(measurement) };
      const reason = evidence.unavailable.some((item) => item.ranges.length)
        ? "MISSING_SUPPORT"
        : BigInt(evidence.sampleRange.end - evidence.sampleRange.start) * 1000000n <
            BigInt(request.minimumDurationUs) * BigInt(evidence.sampleRate)
          ? "TOO_SHORT"
          : !Number.isFinite(measurement.integratedLufs) ||
              !Number.isFinite(measurement.truePeakDbtp)
            ? "UNMEASURABLE"
            : null;
      if (reason) return { ...common, status: "refused", reason, gainDb: null, gainStep: null };
      const refuse = (reason) => ({
        ...common,
        status: "refused",
        reason,
        requestedGainDb,
        gainDb: null,
        gainStep: null,
      });
      if (
        requestedGainDb < request.gainBounds.minimumDb ||
        requestedGainDb > request.gainBounds.maximumDb
      )
        return refuse("GAIN_BOUNDS");
      const peakGainDb = request.truePeakCeilingDbtp - measurement.truePeakDbtp;
      if (requestedGainDb > peakGainDb && request.peakPolicy === "refuse")
        return refuse("PEAK_CEILING");
      const gainDb = Math.min(requestedGainDb, peakGainDb);
      if (gainDb < request.gainBounds.minimumDb) return refuse("GAIN_BOUNDS");
      const gain = 10 ** (gainDb / 20);
      if (!Number.isFinite(gain) || gain === 0) return refuse("GAIN_UNREPRESENTABLE");
      return {
        ...common,
        status: gainDb === requestedGainDb ? "proposed" : "constrained",
        requestedGainDb,
        targetMet: gainDb === requestedGainDb,
        gainDb,
        gainStep: { enabled: true, processor: { type: "gain", gain } },
        predictedIntegratedLufs: measurement.integratedLufs + gainDb,
        predictedTruePeakDbtp: measurement.truePeakDbtp + gainDb,
      };
    }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--help"))
    console.log(
      "Usage: node dialogue-proposals.mjs < request.json\nSupply projectId/revisionId, targetIntegratedLufs, gainBounds {minimumDb,maximumDb}, truePeakCeilingDbtp, peakPolicy (refuse|cap-gain), minimumDurationUs and clips [{clipId,evidence}]. Evidence is delivered audio.measure JSON for a processed clip tap, with measurement at root. Returns exact evidence pins, measured-selection predictions and an ID-free new gainStep draft, or explicit short/unmeasurable/support/bounds/peak refusal. Cap-gain reports targetMet:false. Append explicitly to the existing ordered stack through processing.set; remeasure. Never calls CLI, infers or edits.",
    );
  else await runJsonHelper(dialogueProposals);
}
