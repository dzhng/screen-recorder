import { maximumPointerTrailUs } from "@screenrec/composition";
import { evidenceRecordingId } from "./evidence.js";
import { isDeepStrictEqual } from "node:util";
import { CatalogError } from "./catalog.js";
import type { EvidenceIdentity, RawCursorSample, SourceTrailRead } from "./evidence.js";
import {
  analyzeFrameScene,
  compareVisualSamples,
  compareVisualRasters,
  type VisualSampler,
} from "./scenes.js";
import {
  comparePresentationTimes,
  floorMicroseconds,
  microsecondTime,
  type PresentationTime,
  type PresentationInstant,
} from "./presentation-time.js";
import type { TimeRange } from "./timeline.js";

export type CursorPoint = { atSourceUs: number; x: number; y: number };
export type FrameOverlay = { trail: CursorPoint[][]; trailUs: number; pointer: CursorPoint | null };
export type TrailCutoff = {
  reason:
    | "kept_start"
    | "pause"
    | "geometry"
    | "scene"
    | "future_scene"
    | "outside"
    | "unknown_geometry"
    | "missing_cursor"
    | "empty_presentation";
  atSourceUs: number;
};
export const trailPolicy = Object.freeze({
  id: "requested-time-trail-v1",
  defaultUs: 2_000_000,
  maximumUs: maximumPointerTrailUs,
  maximumPoints: 1200,
  maximumObservations: 5000,
});
export type PointerResetFloor = {
  atSourceUs: number;
  allowAtBoundary: boolean;
  reason: TrailCutoff["reason"];
};
export type TrailScene = Awaited<ReturnType<typeof analyzeFrameScene>>;
type CursorObservation = RawCursorSample & { sequence: number };

/** Core selects temporal evidence; the native overlay only draws these already-clipped points. */
export async function planFrameTrail(
  request: { source: string; kept: TimeRange; requestedSourceUs: number; trailUs?: number },
  dependencies: {
    evidence: SourceTrailRead;
    identity: EvidenceIdentity;
    sample: VisualSampler;
  },
  signal: AbortSignal,
) {
  const { evidence, identity, sample } = dependencies;
  const trailUs = request.trailUs ?? trailPolicy.defaultUs;
  const scene = await analyzeFrameScene(
    { ...request, recordingId: evidenceRecordingId(identity), trailUs },
    sample,
    signal,
  );
  return planVisualTrail(
    request,
    {
      evidence,
      identity,
      scene,
      readScene: async (at, trailUs) => ({
        scene: await analyzeFrameScene(
          {
            ...request,
            recordingId: evidenceRecordingId(identity),
            requestedSourceUs: at,
            trailUs,
          },
          sample,
          signal,
        ),
      }),
    },
    signal,
  );
}

/** One geometry, reset and cursor-eligibility policy for still and presentation evidence. */
export async function planVisualTrail(
  request: { kept: TimeRange; requestedSourceUs: number; trailUs?: number },
  dependencies: {
    evidence: SourceTrailRead;
    identity: EvidenceIdentity;
    scene: TrailScene;
    resetFloor?: PointerResetFloor;
    presentationClock?: { at: PresentationInstant; sampleTime: PresentationTime };
    readScene: (
      at: number,
      trailUs: number,
    ) => Promise<{ scene: TrailScene | null; presentationTime?: PresentationTime }>;
  },
  signal: AbortSignal,
) {
  const { evidence, identity, scene, readScene, resetFloor, presentationClock } = dependencies;
  const at = request.requestedSourceUs;
  const trailUs = request.trailUs ?? trailPolicy.defaultUs;
  const actual = scene.lastSample.actualSourceUs;
  // Still selection may be future-facing; a presentation's exact sample must never
  // admit later microsecond journal events merely because its display timestamp rounds up.
  const selectedAt = presentationClock ? floorMicroseconds(presentationClock.sampleTime) : actual;
  const cutoffs: TrailCutoff[] = [];
  const add = (reason: TrailCutoff["reason"], atSourceUs: number) =>
    cutoffs.push({ reason, atSourceUs });
  const unavailable = (message: string): never => {
    throw new CatalogError("UNAVAILABLE", message);
  };
  const geometryAt = (time: number) => {
    const timed = evidence.timedGeometryAt(identity, time);
    if (!timed) return unavailable("No timed geometry for the selected source moment");
    const next = evidence.nextTimedGeometry(identity, time);
    if (next && next.sequence <= timed.sequence)
      return unavailable("Geometry placement order is ambiguous");
    const unplaced = evidence.unplacedGeometry(identity, {
      afterSequence: timed.sequence,
      ...(next ? { beforeSequence: next.sequence } : {}),
    });
    const unresolved = unplaced.at(-1);
    // A following placement can confirm the final geometry observed during a collapsed pause.
    if (
      unresolved &&
      (!next ||
        unresolved.epoch !== next.epoch ||
        !isDeepStrictEqual(unresolved.geometry, next.geometry))
    )
      return unavailable("Unplaced geometry has no matching timed confirmation");
    if (
      timed.geometry.outputWidth !== scene.sourceWidth ||
      timed.geometry.outputHeight !== scene.sourceHeight
    )
      return unavailable("Geometry dimensions do not match the decoded source image");
    return timed;
  };
  const requestedGeometry = geometryAt(at);
  const selectedGeometry = geometryAt(selectedAt);
  const latest = evidence.latestCursor(identity, at);
  const overlay: FrameOverlay = { trail: [], trailUs, pointer: null };
  let start = scene.range.startUs;
  let reset = Math.max(request.kept.startUs, resetFloor?.atSourceUs ?? 0);
  let pauseReset = resetFloor && !resetFloor.allowAtBoundary ? resetFloor.atSourceUs : -1;
  if (resetFloor) add(resetFloor.reason, resetFloor.atSourceUs);
  const priorStart = Math.min(start, Math.max(request.kept.startUs, latest?.sourceUs ?? start));
  const historyStart = resetFloor ? Math.min(at, Math.max(reset, priorStart)) : priorStart;
  const pauses = evidence.pauseBoundaries(identity, {
    startUs: historyStart,
    endUs: Math.max(at, selectedAt),
  });
  const changes = evidence.geometryChanges(identity, {
    startUs: historyStart,
    endUs: Math.max(at, selectedAt),
  });
  let epoch = geometryAt(historyStart).epoch;
  for (const change of changes) {
    if (change.epoch !== epoch) {
      add("geometry", change.sourceUs!);
      if (change.sourceUs! <= at) reset = Math.max(reset, change.sourceUs!);
    }
    epoch = change.epoch;
  }
  for (const pause of pauses) {
    add("pause", pause.atSourceUs);
    if (pause.atSourceUs <= at) {
      reset = Math.max(reset, pause.atSourceUs);
      pauseReset = Math.max(pauseReset, pause.atSourceUs);
    }
  }
  if (request.kept.startUs > at - trailUs) add("kept_start", request.kept.startUs);
  for (const boundary of scene.boundaries) {
    add("scene", boundary.atSourceUs);
    reset = Math.max(reset, boundary.atSourceUs);
  }
  start = resetFloor ? Math.min(at, Math.max(start, reset)) : Math.max(start, reset);
  const raster = (geometry: typeof requestedGeometry.geometry) => ({
    outputWidth: geometry.outputWidth,
    outputHeight: geometry.outputHeight,
    contentRect: geometry.contentRect,
    contentScale: geometry.contentScale,
    scaleFactor: geometry.scaleFactor,
  });
  const incompatible = !isDeepStrictEqual(
    raster(requestedGeometry.geometry),
    raster(selectedGeometry.geometry),
  );
  if (incompatible)
    add("geometry", Math.max(requestedGeometry.sourceUs!, selectedGeometry.sourceUs!));
  if (scene.futureComparison?.boundary) add("future_scene", actual);
  const futurePause = pauses.some(
    (pause) => pause.atSourceUs > at && pause.atSourceUs <= selectedAt,
  );
  const veto = incompatible || scene.futureComparison?.boundary || futurePause;
  let stalePointerScene: Awaited<ReturnType<typeof analyzeFrameScene>> | null = null;
  let missingPriorPicture = false;
  let stalePointerComparison: ReturnType<typeof compareVisualSamples> | null = null;
  const eligible = (observation: CursorObservation) =>
    observation.sourceUs >= reset &&
    observation.sourceUs > pauseReset &&
    observation.geometryEpoch === requestedGeometry.epoch &&
    observation.eligibility === "inside" &&
    typeof observation.x === "number" &&
    typeof observation.y === "number";
  const point = (observation: CursorObservation): CursorPoint => {
    if (
      observation.x! < 0 ||
      observation.x! >= scene.sourceWidth ||
      observation.y! < 0 ||
      observation.y! >= scene.sourceHeight
    )
      throw new CatalogError(
        "INVALID_EVIDENCE",
        "Eligible cursor coordinates escape the source raster",
      );
    return { atSourceUs: observation.sourceUs, x: observation.x!, y: observation.y! };
  };
  if (!veto) {
    if (trailUs > 0) {
      const page = evidence.page({
        ...identity,
        range: { startUs: start, endUs: at + 1 },
        limit: trailPolicy.maximumObservations,
      });
      if (page.nextSequence !== null)
        throw new CatalogError("LIMIT_EXCEEDED", "Too many raw cursor observations for one trail");
      let run: CursorPoint[] = [];
      let total = 0;
      for (let i = 0; i < page.samples.length; i++) {
        const observation = page.samples[i]!;
        // Duplicate source times use the final normalized observation, just like the pointer read.
        if (page.samples[i + 1]?.sourceUs === observation.sourceUs) continue;
        if (!eligible(observation)) {
          if (run.length) overlay.trail.push(run);
          run = [];
          continue;
        }
        if (++total > trailPolicy.maximumPoints)
          throw new CatalogError("LIMIT_EXCEEDED", "Trail exceeds the native point budget");
        run.push(point(observation));
      }
      if (run.length) overlay.trail.push(run);
    }
    if (latest && eligible(latest)) {
      if (
        presentationClock
          ? comparePresentationTimes(microsecondTime(latest.sourceUs), presentationClock.at) < 0
          : latest.sourceUs < scene.range.startUs
      ) {
        geometryAt(latest.sourceUs);
        const prior = await readScene(latest.sourceUs, 0);
        stalePointerScene = prior.scene;
        if (!stalePointerScene) {
          missingPriorPicture = true;
          add("empty_presentation", latest.sourceUs);
        }
        const before = stalePointerScene?.reference;
        const after = scene.lastSample;
        if (before && presentationClock) {
          if (!prior.presentationTime)
            throw new CatalogError(
              "INVALID_EVIDENCE",
              "Presentation scene has no exact sample clock",
            );
          if (comparePresentationTimes(prior.presentationTime, presentationClock.sampleTime) < 0)
            stalePointerComparison = {
              previousActualSourceUs: before.actualSourceUs,
              actualSourceUs: after.actualSourceUs,
              ...compareVisualRasters(before, after),
            };
        } else if (before && before.actualSourceUs < after.actualSourceUs) {
          stalePointerComparison = compareVisualSamples(before, after);
        }
        if (stalePointerComparison?.boundary) add("scene", after.actualSourceUs);
      }
      if (!missingPriorPicture && !stalePointerComparison?.boundary)
        overlay.pointer = point(latest);
    } else if (latest) {
      if (latest.eligibility !== "inside")
        add(latest.eligibility === "outside" ? "outside" : "unknown_geometry", latest.sourceUs);
      else if (latest.geometryEpoch !== requestedGeometry.epoch) add("geometry", latest.sourceUs);
    } else add("missing_cursor", at);
  }
  signal.throwIfAborted();
  const first = overlay.trail[0]?.[0];
  const last = overlay.trail.at(-1)?.at(-1);
  return {
    policy: trailPolicy.id,
    overlay,
    requestedSourceUs: at,
    actualSourceUs: actual,
    evidenceRange: { startUs: start, endUs: at },
    interval: first && last ? { startUs: first.atSourceUs, endUs: last.atSourceUs } : null,
    cutoffs,
    pointerObservation: latest,
    geometry: { requested: requestedGeometry, selected: selectedGeometry },
    sourceEvidence: identity,
    scene,
    stalePointerScene,
    stalePointerComparison,
  };
}
