import { evidenceRecordingId } from "./evidence.js";
import { createHash, randomUUID } from "node:crypto";
import { link, open, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { CatalogError } from "./catalog.js";
import type { EvidenceIdentity, SourceTrailRead } from "./evidence.js";
import type { SourceEvidenceReader } from "./evidence-read.js";
import { PresentationEvidence, type PresentationRecord } from "./presentation-evidence.js";
import { PresentationPointer } from "./presentation-pointer.js";
import { compareVisualRasters, scenePolicy } from "./scenes.js";
import { trailPolicy, type CursorPoint, type PointerResetFloor } from "./trails.js";
import {
  ceilMicroseconds,
  comparePresentationTimes as compare,
  microsecondTime,
  type PresentationTime,
} from "./presentation-time.js";

type ScheduleInput = {
  revisionId: string;
  presentation: PresentationEvidence;
  evidence: SourceTrailRead & Pick<SourceEvidenceReader, "exportRecords">;
  identity: EvidenceIdentity;
  output: string;
  maxBytes: number;
  maxEvents: number;
};
type Event = { at: PresentationTime } & (
  | { kind: "presentation"; record: PresentationRecord }
  | { kind: "cursor" | "pause" }
  | { kind: "geometry"; epoch: number }
);
export type PointerState = { spanIndex: number; at: PresentationTime; pointer: CursorPoint | null };

/** Caller binds the evidence/receipt to one pinned source in its private render attempt.
 * Matching dimensions and spans alone cannot authenticate source identity. */
export async function writePointerSchedule(input: ScheduleInput, signal: AbortSignal) {
  if (
    !isAbsolute(input.output) ||
    !Number.isSafeInteger(input.maxBytes) ||
    input.maxBytes < 1 ||
    !Number.isSafeInteger(input.maxEvents) ||
    input.maxEvents < 1
  )
    throw new CatalogError(
      "INVALID_RANGE",
      "Pointer schedule requires an absolute output and positive safe budgets",
    );
  signal.throwIfAborted();
  const staging = join(dirname(input.output), `.pointer-schedule-${randomUUID()}`);
  const file = await open(staging, "wx", 0o600);
  let bytes = 0,
    records = 0,
    events = 0;
  const hash = createHash("sha256");
  async function append(value: unknown) {
    signal.throwIfAborted();
    const data = Buffer.from(JSON.stringify(value) + "\n");
    if (data.length > 65_536 || data.length > input.maxBytes - bytes)
      throw new CatalogError("LIMIT_EXCEEDED", "Pointer schedule exceeds its byte budget");
    await file.writeFile(data);
    hash.update(data);
    bytes += data.length;
  }
  try {
    const source = input.presentation;
    const header = {
      version: 1,
      recordingId: evidenceRecordingId(input.identity),
      sourceId: input.identity.sourceId,
      sourceGeneration: input.identity.generation,
      revisionId: input.revisionId,
      sourceWidth: source.receipt.sourceWidth,
      sourceHeight: source.receipt.sourceHeight,
      durationUs: source.receipt.durationUs,
      spanCount: source.spans.length,
      trailPolicy: trailPolicy.id,
      scenePolicy: scenePolicy.id,
    };
    await append(header);
    for await (const state of pointerStates(input, signal, () => {
      if (++events > input.maxEvents)
        throw new CatalogError("LIMIT_EXCEEDED", "Pointer schedule exceeds its input-event budget");
    })) {
      await append(state);
      records++;
    }
    await file.sync();
    signal.throwIfAborted();
    try {
      await link(staging, input.output);
    } catch {
      throw new CatalogError(
        "INVALID_OUTPUT",
        "Cannot publish pointer schedule to an occupied destination",
      );
    }
    return { ...header, file: input.output, bytes, records, events, sha256: hash.digest("hex") };
  } finally {
    try {
      await file.close();
    } finally {
      await rm(staging, { force: true });
    }
  }
}

async function* pointerStates(
  input: ScheduleInput,
  signal: AbortSignal,
  visited: () => void,
): AsyncGenerator<PointerState> {
  const { presentation, evidence, identity } = input;
  async function* frames(): AsyncGenerator<Event> {
    for await (const record of presentation.records(signal))
      yield { at: record.start, kind: "presentation", record };
  }
  async function* observations(index: "cursor" | "geometry" | "pauses"): AsyncGenerator<Event> {
    for (const [spanIndex, range] of presentation.spans.entries()) {
      signal.throwIfAborted();
      for (const page of evidence.exportRecords(identity, index, range)) {
        for (const row of page) {
          signal.throwIfAborted();
          const at = microsecondTime(row.sourceUs!);
          yield index === "geometry"
            ? { at, kind: "geometry", epoch: JSON.parse(row.content).epoch }
            : { at, kind: index === "pauses" ? "pause" : "cursor" };
        }
        await setImmediate(undefined, { signal });
      }
      if (spanIndex % 256 === 255) await setImmediate(undefined, { signal });
    }
  }

  const streams = [
    frames(),
    observations("cursor"),
    observations("pauses"),
    observations("geometry"),
  ];
  const heads: IteratorResult<Event>[] = [];
  const pointer = new PresentationPointer(presentation, evidence, identity, signal);
  let current: PresentationRecord | undefined;
  let reset: PointerResetFloor = { atSourceUs: 0, allowAtBoundary: true, reason: "kept_start" };
  let geometryEpoch: number | undefined;
  let previousPointer: CursorPoint | null = null,
    previousSpan = -1;
  const end = microsecondTime(presentation.spans.at(-1)!.endUs);
  const advanceReset = (
    at: PresentationTime,
    reason: PointerResetFloor["reason"],
    allowAtBoundary = true,
  ) => {
    const next = { atSourceUs: ceilMicroseconds(at), reason, allowAtBoundary };
    if (
      next.atSourceUs > reset.atSourceUs ||
      (next.atSourceUs === reset.atSourceUs && !allowAtBoundary)
    )
      reset = next;
  };
  const first = () => {
    let best = -1;
    for (let i = 0; i < heads.length; i++)
      if (!heads[i]!.done && (best < 0 || compare(heads[i]!.value.at, heads[best]!.value.at) < 0))
        best = i;
    return best;
  };
  try {
    for (const stream of streams) heads.push(await stream.next());
    for (;;) {
      signal.throwIfAborted();
      let selected = first();
      if (selected < 0 || compare(heads[selected]!.value.at, end) >= 0) break;
      const at = heads[selected]!.value.at;
      // Drain ties with constant memory. latestCursor owns final normalized sequence selection.
      do {
        visited();
        const event = heads[selected]!.value;
        if (event.kind === "presentation") {
          const next = event.record;
          if (!current || current.spanIndex !== next.spanIndex) {
            advanceReset(next.start, "kept_start");
            geometryEpoch = evidence.timedGeometryAt(
              identity,
              presentation.spans[next.spanIndex]!.startUs,
            )?.epoch;
          } else if (current.empty || next.empty) advanceReset(next.start, "empty_presentation");
          else if (compareVisualRasters(current, next).boundary) advanceReset(next.start, "scene");
          current = next;
        } else if (event.kind === "pause") advanceReset(event.at, "pause", false);
        else if (event.kind === "geometry") {
          if (geometryEpoch !== undefined && geometryEpoch !== event.epoch)
            advanceReset(event.at, "geometry");
          geometryEpoch = event.epoch;
        }
        heads[selected] = await streams[selected]!.next();
        selected = first();
      } while (selected >= 0 && compare(heads[selected]!.value.at, at) === 0);
      if (!current || compare(at, current.end) >= 0) continue;
      const result = await pointer.atEvent(current, at, reset);
      const inspection = result.inspection;
      const nextPointer = inspection.kind === "empty" ? null : inspection.plan.overlay.pointer;
      if (inspection.kind === "picture" && inspection.plan.stalePointerComparison?.boundary)
        advanceReset(current.start, "scene");
      // A stationary observation refreshes eligibility but does not change the drawn glyph.
      const same =
        nextPointer === null
          ? previousPointer === null
          : previousPointer !== null &&
            nextPointer.x === previousPointer.x &&
            nextPointer.y === previousPointer.y;
      if (current.spanIndex !== previousSpan || !same) {
        yield { spanIndex: current.spanIndex, at, pointer: nextPointer };
        previousPointer = nextPointer;
        previousSpan = current.spanIndex;
      }
    }
  } finally {
    for (const stream of streams) await stream.return(undefined);
  }
}
