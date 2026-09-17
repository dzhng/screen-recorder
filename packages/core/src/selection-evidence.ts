import { setImmediate } from "node:timers/promises";
import { CatalogError } from "./library.js";
import type { SourceSelectionRead } from "./evidence.js";
import { sceneBoundaries, type SceneEvidenceRead } from "./scene-evidence.js";
import type { SelectionEvent, SelectionInput } from "./selection.js";

/** Streams published source evidence; the selector owns kept-span filtering and cut events. */
export async function* selectionEvidence(
  input: Pick<SelectionInput, "revision" | "sourceIdentity" | "sceneIdentity">,
  stores: { source: SourceSelectionRead; scenes: SceneEvidenceRead },
  signal: AbortSignal,
): AsyncGenerator<SelectionEvent> {
  const { revision, sourceIdentity, sceneIdentity } = input;
  if (
    sourceIdentity.recordingId !== sceneIdentity.recordingId ||
    sourceIdentity.sourceId !== sceneIdentity.sourceId
  )
    throw new CatalogError("INVALID_EVIDENCE", "Selection evidence must name one source");
  const durationUs = revision.sourceDurationUs;
  async function* chunks() {
    let afterStartUs: number | undefined;
    for (;;) {
      signal.throwIfAborted();
      const page = stores.scenes.page({
        identity: sceneIdentity,
        limit: 1,
        ...(afterStartUs === undefined ? {} : { afterStartUs }),
      });
      if (page.metadata.durationUs !== durationUs)
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Scene evidence duration does not match the pinned revision",
        );
      yield* page.chunks;
      if (page.nextStartUs === null) return;
      afterStartUs = page.nextStartUs;
      await setImmediate();
    }
  }
  async function* cursors(): AsyncGenerator<SelectionEvent> {
    let afterSequence: number | undefined;
    for (;;) {
      signal.throwIfAborted();
      const page = stores.source.page({
        ...sourceIdentity,
        range: { startUs: 0, endUs: durationUs },
        limit: 1000,
        ...(afterSequence === undefined ? {} : { afterSequence }),
      });
      for (const sample of page.samples) {
        signal.throwIfAborted();
        const { sourceUs, x, y, buttons, eligibility, geometryEpoch, sequence } = sample;
        yield {
          kind: "cursor",
          sample: {
            sourceUs,
            x: x ?? null,
            y: y ?? null,
            buttons,
            eligibility,
            geometryEpoch,
            sequence,
          },
        };
      }
      if (page.nextSequence === null) return;
      afterSequence = page.nextSequence;
      await setImmediate();
    }
  }
  async function* timing(reason: "pause" | "geometry"): AsyncGenerator<SelectionEvent> {
    let epoch: number | undefined;
    const windowUs = 10_000_000;
    for (let startUs = 0; startUs <= durationUs; startUs += windowUs) {
      signal.throwIfAborted();
      // Timing-store endpoints are inclusive; adjacent windows must not repeat an edge.
      const range = { startUs, endUs: Math.min(startUs + windowUs - 1, durationUs) };
      if (reason === "pause") {
        for (const pause of stores.source.pauseBoundaries(sourceIdentity, range))
          yield { kind: "boundary", atSourceUs: pause.atSourceUs, reason };
      } else {
        for (const geometry of stores.source.geometryChanges(sourceIdentity, range)) {
          if (geometry.epoch !== epoch && (epoch !== undefined || geometry.sourceUs! > 0))
            yield { kind: "boundary", atSourceUs: geometry.sourceUs!, reason };
          epoch = geometry.epoch;
        }
      }
      await setImmediate();
    }
  }
  async function* scenes(): AsyncGenerator<SelectionEvent> {
    for await (const chunk of chunks())
      for (const boundary of sceneBoundaries(chunk)) {
        signal.throwIfAborted();
        yield { kind: "boundary", atSourceUs: boundary.atSourceUs, reason: "scene" };
      }
  }
  async function* visuals(): AsyncGenerator<SelectionEvent> {
    let requestedThroughUs = -1;
    let spanIndex = 0;
    for await (const chunk of chunks()) {
      for (const point of chunk.coverage) {
        signal.throwIfAborted();
        if (point.requestedSourceUs <= requestedThroughUs) continue;
        while (
          revision.spans[spanIndex] &&
          revision.spans[spanIndex]!.endUs <= point.requestedSourceUs
        )
          spanIndex++;
        const span = revision.spans[spanIndex];
        const inside =
          span &&
          point.requestedSourceUs >= span.startUs &&
          point.actualSourceUs >= span.startUs &&
          point.actualSourceUs < span.endUs;
        yield {
          kind: "visual",
          atSourceUs: point.requestedSourceUs,
          actualSourceUs: point.actualSourceUs,
          stillnessRunStartUs: inside ? point.stillnessRunStartUs : null,
        };
        requestedThroughUs = point.requestedSourceUs;
      }
    }
  }
  const streams = [timing("pause"), timing("geometry"), scenes(), visuals(), cursors()];
  const heads: IteratorResult<SelectionEvent>[] = [];
  const at = (event: SelectionEvent) =>
    event.kind === "cursor" ? event.sample.sourceUs : event.atSourceUs;
  const priority = (event: SelectionEvent) =>
    event.kind === "boundary" ? 0 : event.kind === "visual" ? 1 : 2;
  try {
    for (const stream of streams) heads.push(await stream.next());
    for (;;) {
      signal.throwIfAborted();
      let chosen = -1;
      for (let i = 0; i < heads.length; i++) {
        if (heads[i]!.done) continue;
        const candidate = heads[i]!.value;
        const current = chosen < 0 ? null : heads[chosen]!.value;
        if (
          !current ||
          at(candidate) < at(current) ||
          (at(candidate) === at(current) && priority(candidate) < priority(current))
        )
          chosen = i;
      }
      if (chosen < 0) return;
      yield heads[chosen]!.value;
      heads[chosen] = await streams[chosen]!.next();
    }
  } finally {
    for (const stream of streams) await stream.return(undefined);
  }
}
