import { CatalogError } from "./catalog.js";
import type { EvidenceIdentity, RawCursorSample } from "./evidence.js";
import type { SceneEvidenceIdentity } from "./scene-evidence.js";
import { scenePolicy } from "./scenes.js";
import { trailPolicy } from "./trails.js";
import { renderPlan, type RenderSpan, type TimelineRevision, type TimeRange } from "./timeline.js";

export const selectionPolicy = Object.freeze({
  id: "sampled-evidence-selection-v2",
  coverageUs: 5_000_000,
  ordinarySpacingUs: 1_000_000,
  idleUs: 300_000,
  continuousUs: 2_000_000,
  motionToleranceFraction: 0.001,
  burstDistanceFraction: 0.01,
  maximumPendingCandidates: 5000,
});
type Cursor = Pick<
  RawCursorSample,
  "sourceUs" | "x" | "y" | "buttons" | "eligibility" | "geometryEpoch"
> & { sequence: number };
export type SelectionEvent =
  | { kind: "cursor"; sample: Cursor }
  | { kind: "boundary"; atSourceUs: number; reason: "pause" | "scene" | "geometry" }
  | {
      kind: "visual";
      atSourceUs: number;
      actualSourceUs: number;
      stillnessRunStartUs: number | null;
    };
export type SelectionInput = {
  revision: TimelineRevision;
  sourceIdentity: EvidenceIdentity;
  sceneIdentity: SceneEvidenceIdentity;
  sourceWidth: number;
  sourceHeight: number;
};
export type SelectionReason = {
  kind: "first" | "last" | "cut" | "pause" | "scene" | "coverage" | "cursor-motion" | "button-down";
  eventSourceUs: number;
  side?: "before" | "after";
  trigger?: "idle" | "continuous" | "acquisition_gap" | "reset" | "end";
};
export type SelectedCandidate = {
  kind: "candidate";
  ordinal: number;
  requestedSourceUs: number;
  requestedPlaybackUs: number;
  kept: TimeRange;
  reasons: SelectionReason[];
  sourceIdentity: EvidenceIdentity;
  sceneIdentity: SceneEvidenceIdentity;
};
export type SelectionRecord =
  | SelectedCandidate
  | {
      kind: "coverage";
      ordinal: number;
      source: TimeRange;
      playback: TimeRange;
      equality: "sampled" | "unproven";
    };
export type SelectionCoverage = Extract<SelectionRecord, { kind: "coverage" }>;
type Pending = Omit<SelectedCandidate, "ordinal"> & { ordinal?: number };
type Group = {
  at: number;
  cursor?: Cursor;
  visual?: Extract<SelectionEvent, { kind: "visual" }>;
  boundaries: Set<"pause" | "scene" | "geometry">;
};
const at = (event: SelectionEvent) =>
  event.kind === "cursor" ? event.sample.sourceUs : event.atSourceUs;
const visible = (point: Cursor) =>
  point.eligibility === "inside" && typeof point.x === "number" && typeof point.y === "number";
const cursorKey = (point: Cursor) =>
  JSON.stringify([
    point.eligibility,
    point.geometryEpoch,
    point.x ?? null,
    point.y ?? null,
    point.buttons,
  ]);

class Selection {
  private readonly spans: readonly RenderSpan[];
  private spanIndex = 0;
  private begun = false;
  private lastAdded = false;
  private windowStart = 0;
  private representative: Pending | undefined;
  private latest: Pending | undefined;
  private readonly pending: Pending[] = [];
  private ordinal = 0;
  private cursor: Cursor | undefined;
  private anchor: Cursor | undefined;
  private burst: { start: number; last: number; distance: number } | undefined;
  private visual: Extract<SelectionEvent, { kind: "visual" }> | undefined;
  private visualChanged = false;
  private cursorChanged = false;
  private lastCursorChange = -Infinity;
  private cursorGap: number | undefined;
  private readonly tolerance: number;
  private readonly burstDistance: number;
  constructor(
    private readonly input: SelectionInput,
    private readonly signal?: AbortSignal,
  ) {
    this.spans = renderPlan(input.revision);
    const edge = Math.max(input.sourceWidth, input.sourceHeight);
    this.tolerance = Math.max(1, edge * selectionPolicy.motionToleranceFraction);
    this.burstDistance = edge * selectionPolicy.burstDistanceFraction;
  }
  private get span() {
    return this.spans[this.spanIndex];
  }
  private add(time: number, reason: SelectionReason): Pending | undefined {
    const span = this.span;
    if (!span || time < span.source.startUs || time >= span.source.endUs) return;
    let row = this.pending.find((v) => v.requestedSourceUs === time);
    if (!row) {
      if (this.pending.length >= selectionPolicy.maximumPendingCandidates)
        throw new CatalogError(
          "LIMIT_EXCEEDED",
          "Too many screenshot candidates in the observation window",
        );
      row = {
        kind: "candidate",
        requestedSourceUs: time,
        requestedPlaybackUs: span.playback.startUs + time - span.source.startUs,
        kept: span.source,
        reasons: [],
        sourceIdentity: this.input.sourceIdentity,
        sceneIdentity: this.input.sceneIdentity,
      };
      this.pending.push(row);
      this.pending.sort((a, b) => a.requestedSourceUs - b.requestedSourceUs);
      if (!this.latest || time >= this.latest.requestedSourceUs) this.latest = row;
    }
    if (
      !row.reasons.some(
        (r) =>
          r.kind === reason.kind &&
          r.eventSourceUs === reason.eventSourceUs &&
          r.side === reason.side,
      )
    )
      row.reasons.push(reason);
    return row;
  }
  *flush(before: number): Generator<SelectionRecord> {
    // A still observation just before the idle threshold needs another observation (or a gap)
    // before its earlier moving endpoint is final. Never emit a later candidate ahead of it.
    if (this.burst && this.burst.distance >= this.burstDistance)
      before = Math.min(before, this.burst.last);
    while (this.pending[0] && this.pending[0].requestedSourceUs < before) {
      this.signal?.throwIfAborted();
      const row = this.pending.shift()!;
      row.ordinal = this.ordinal++;
      yield { ...row, ordinal: row.ordinal };
    }
  }
  private closeBurst(trigger: NonNullable<SelectionReason["trigger"]>) {
    if (this.burst && this.burst.distance >= this.burstDistance)
      this.add(this.burst.last, { kind: "cursor-motion", eventSourceUs: this.burst.last, trigger });
    this.burst = undefined;
  }
  private reset(trigger: "reset" | "end" | "acquisition_gap") {
    this.closeBurst(trigger);
    this.cursor = undefined;
    this.anchor = undefined;
    this.cursorGap = undefined;
    this.cursorChanged = true;
    this.visualChanged = true;
  }
  private unchanged(end: number): boolean {
    return (
      !!this.visual &&
      !!this.cursor &&
      !this.visualChanged &&
      !this.cursorChanged &&
      end - this.visual.atSourceUs <= scenePolicy.stepUs &&
      end - this.cursor.sourceUs <= selectionPolicy.idleUs &&
      this.cursor.eligibility !== "unknownGeometry" &&
      this.lastCursorChange <= this.windowStart - trailPolicy.defaultUs
    );
  }
  private *coverage(end: number): Generator<SelectionRecord> {
    if (!this.representative || end <= this.windowStart) return;
    yield* this.flush(this.windowStart + 1);
    this.signal?.throwIfAborted();
    const span = this.span!;
    yield {
      kind: "coverage",
      ordinal: this.representative.ordinal!,
      source: { startUs: this.windowStart, endUs: end },
      playback: {
        startUs: span.playback.startUs + this.windowStart - span.source.startUs,
        endUs: span.playback.startUs + end - span.source.startUs,
      },
      equality: this.unchanged(end) ? "sampled" : "unproven",
    };
  }
  *advance(time: number, inclusive: boolean): Generator<SelectionRecord> {
    while (this.span) {
      this.signal?.throwIfAborted();
      const span = this.span;
      let due: number;
      if (!this.begun) due = span.source.startUs;
      else
        due = Math.min(
          span.source.endUs,
          this.lastAdded ? Infinity : span.source.endUs - 1,
          this.windowStart + selectionPolicy.coverageUs,
          this.cursorGap ?? Infinity,
        );
      if (due > time || (due === time && !inclusive && this.begun)) break;
      if (!this.begun) {
        this.begun = true;
        this.windowStart = due;
        this.lastAdded = false;
        this.visual = undefined;
        this.cursor = undefined;
        this.anchor = undefined;
        this.burst = undefined;
        this.cursorGap = undefined;
        this.latest = undefined;
        this.visualChanged = false;
        this.cursorChanged = false;
        this.lastCursorChange = -Infinity;
        this.representative = this.add(due, { kind: "first", eventSourceUs: due });
        if (due > 0) this.add(due, { kind: "cut", eventSourceUs: due, side: "after" });
      } else if (due === span.source.endUs) {
        this.closeBurst("end");
        yield* this.flush(Infinity);
        yield* this.coverage(due);
        this.spanIndex++;
        this.begun = false;
      } else if (due === this.cursorGap) {
        this.reset("acquisition_gap");
      } else if (!this.lastAdded && due === span.source.endUs - 1) {
        this.lastAdded = true;
        this.add(due, { kind: "last", eventSourceUs: span.source.endUs });
        if (span.source.endUs < this.input.revision.sourceDurationUs)
          this.add(due, { kind: "cut", eventSourceUs: span.source.endUs, side: "before" });
      } else {
        const unchanged = this.unchanged(due);
        yield* this.coverage(due);
        if (!unchanged) {
          this.representative =
            this.latest && due - this.latest.requestedSourceUs < selectionPolicy.ordinarySpacingUs
              ? this.latest
              : this.add(due, { kind: "coverage", eventSourceUs: due });
        }
        this.windowStart = due;
        // Spacing may reuse an older image. Its uncertainty survives until a fresh representative.
        if (this.representative?.requestedSourceUs === due) {
          this.visualChanged = false;
          this.cursorChanged = false;
        }
      }
      yield* this.flush(due - selectionPolicy.idleUs);
    }
  }
  group(group: Group) {
    const span = this.span;
    if (!span || !this.begun || group.at < span.source.startUs || group.at > span.source.endUs)
      return;
    if (group.boundaries.size) {
      this.reset("reset");
      for (const reason of group.boundaries)
        if (reason !== "geometry") {
          this.add(group.at - 1, { kind: reason, eventSourceUs: group.at, side: "before" });
          this.add(group.at, { kind: reason, eventSourceUs: group.at, side: "after" });
        }
    }
    if (group.at === span.source.endUs) return;
    const visual = group.visual;
    if (visual) {
      if (
        visual.stillnessRunStartUs == null ||
        visual.actualSourceUs < span.source.startUs ||
        visual.actualSourceUs >= span.source.endUs
      )
        this.visualChanged = true;
      if (this.visual) {
        if (
          visual.atSourceUs - this.visual.atSourceUs > scenePolicy.stepUs ||
          visual.stillnessRunStartUs !== this.visual.stillnessRunStartUs
        )
          this.visualChanged = true;
      } else if (visual.atSourceUs !== span.source.startUs) this.visualChanged = true;
      this.visual = visual;
    }
    const current = group.cursor;
    if (!current) return;
    if (
      this.cursor &&
      (this.cursor.geometryEpoch !== current.geometryEpoch ||
        (visible(this.cursor) && !visible(current)))
    )
      this.reset("reset");
    if (this.cursor && cursorKey(current) !== cursorKey(this.cursor)) {
      this.cursorChanged = true;
      this.lastCursorChange = current.sourceUs;
    } else if (!this.cursor && current.sourceUs !== span.source.startUs) this.cursorChanged = true;
    if (current.buttons !== 0 && (!this.cursor || (current.buttons & ~this.cursor.buttons) !== 0)) {
      this.closeBurst("reset");
      this.add(current.sourceUs, { kind: "button-down", eventSourceUs: current.sourceUs });
    }
    if (visible(current)) {
      if (this.anchor) {
        const distance = Math.hypot(current.x! - this.anchor.x!, current.y! - this.anchor.y!);
        if (distance >= this.tolerance) {
          this.burst ??= {
            start: this.cursor?.sourceUs ?? this.anchor.sourceUs,
            last: current.sourceUs,
            distance: 0,
          };
          this.burst.distance += distance;
          this.burst.last = current.sourceUs;
          this.anchor = current;
          if (
            current.sourceUs - this.burst.start >= selectionPolicy.continuousUs &&
            this.burst.distance >= this.burstDistance
          )
            this.closeBurst("continuous");
        } else if (this.burst && current.sourceUs - this.burst.last >= selectionPolicy.idleUs)
          this.closeBurst("idle");
      } else this.anchor = current;
    } else this.anchor = undefined;
    this.cursor = current;
    this.cursorGap = current.sourceUs + selectionPolicy.idleUs;
  }
}

/** Emits candidate rows and bounded coverage rows; coverage may refer to an earlier image. */
export async function* selectIndex(
  input: SelectionInput,
  events: AsyncIterable<SelectionEvent> | Iterable<SelectionEvent>,
  signal?: AbortSignal,
): AsyncGenerator<SelectionRecord> {
  const selection = new Selection(input, signal);
  let group: Group | undefined;
  const consume = function* (value: Group) {
    yield* selection.advance(value.at, false);
    selection.group(value);
    yield* selection.advance(value.at, true);
    yield* selection.flush(value.at - selectionPolicy.idleUs);
  };
  for await (const event of events) {
    signal?.throwIfAborted();
    const time = at(event);
    if (
      !Number.isSafeInteger(time) ||
      time < 0 ||
      time > input.revision.sourceDurationUs ||
      (group && time < group.at)
    )
      throw new CatalogError("INVALID_EVIDENCE", "Selection events must progress in source time");
    if (group && time !== group.at) {
      yield* consume(group);
      group = undefined;
    }
    group ??= { at: time, boundaries: new Set() };
    if (event.kind === "cursor") group.cursor = event.sample;
    else if (event.kind === "visual") group.visual = event;
    else group.boundaries.add(event.reason);
  }
  signal?.throwIfAborted();
  if (group) yield* consume(group);
  yield* selection.advance(input.revision.sourceDurationUs, true);
  yield* selection.flush(Infinity);
}
