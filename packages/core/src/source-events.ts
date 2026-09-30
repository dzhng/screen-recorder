import { ceil, sourceAvailability } from "@screenrec/composition";
import { createHash } from "node:crypto";
import { z } from "zod";
import { compare, fromTime, intervalIndex } from "@screenrec/composition";
import type { AssetStore } from "./assets.js";
import type { AcquisitionStore } from "./acquisitions.js";
import { CatalogError } from "./catalog.js";
import { selectSource, type SourceSelection } from "./source-selection.js";
import {
  CaptureSourceRead,
  initialCapture,
  capturePositionSchema,
  boundSourceEvidenceResponse,
  type CaptureContext,
  type CaptureDomain,
  type CapturePosition,
  type CaptureRow,
  type CaptureSourceInput,
} from "./capture-source-read.js";
import {
  SourceSceneRead,
  initialScene,
  scenePositionSchema,
  type SceneContext,
  type ScenePosition,
  type SceneRow,
} from "./scene-source-read.js";
export type SourceEventContext = CaptureContext & { scene?: SceneContext };
export type SourceEventRow = CaptureRow | SceneRow;
export type SourceEventPosition = { capture: CapturePosition; scene: ScenePosition };
export const initialSourceEvents = (): SourceEventPosition => ({
  capture: initialCapture(),
  scene: initialScene(),
});
export const sourceEventOrdinal = (row: SourceEventRow) =>
  row.kind === "scene" ? row.sourceOrdinal : row.sourceSequence;
export class SourceEvents {
  constructor(
    private readonly options: {
      assets: AssetStore;
      acquisitions: AcquisitionStore;
      capture: CaptureSourceRead;
      scenes?: SourceSceneRead;
    },
  ) {}
  resolve(selection: SourceSelection, domain: CaptureDomain, prepare = false): SourceEventContext {
    const capture = this.options.capture.resolve(selection, domain);
    if (domain === "cursor" || !this.options.scenes) return capture;
    const scene = this.options.scenes.resolve(selection, prepare);
    return {
      ...capture,
      scene,
      coverage: capture.coverage.map((value) =>
        value.kind === "scene"
          ? {
              kind: "scene",
              state: scene.evidence ? "ready" : "unavailable",
              reason: scene.evidence ? null : (scene.reason ?? `scene_${scene.state}`),
            }
          : value,
      ),
    };
  }
  next(
    context: SourceEventContext,
    range: { startUs: number; endUs: number },
    state: SourceEventPosition,
    budget: { remaining: number },
  ): SourceEventRow | null | undefined {
    const capture = structuredClone(state.capture),
      scene = structuredClone(state.scene);
    const a = this.options.capture.next(
      { ...context, coverage: context.coverage.filter((c) => c.kind !== "scene") },
      range,
      capture,
      budget,
    );
    const b =
      context.scene && this.options.scenes
        ? this.options.scenes.next(context.scene, range, scene, budget)
        : null;
    // Commit empty scans, but do not consume a prefetched row until its other head is known.
    if (a === undefined) state.capture = capture;
    if (b === undefined) state.scene = scene;
    if (a === undefined || b === undefined) return undefined;
    const before =
      a && b
        ? compare(fromTime(a.sourceAtUs), fromTime(b.sourceAtUs)) ||
          sourceEventOrdinal(a) - sourceEventOrdinal(b) ||
          a.kind.localeCompare(b.kind)
        : 0;
    if (a && (!b || before <= 0)) {
      state.capture = capture;
      return a;
    }
    if (b) {
      state.scene = scene;
      return b;
    }
    state.capture = capture;
    state.scene = scene;
    return null;
  }
  cursor(input: CaptureSourceInput) {
    return this.options.capture.cursor(input);
  }
  events(input: CaptureSourceInput) {
    const selected = selectSource(this.options.assets, this.options.acquisitions, {
      assetId: input.assetId,
      streamId: input.streamId,
      ...(input.acquisitionId === undefined ? {} : { acquisitionId: input.acquisitionId }),
    });
    const context = this.resolve(selected.selection, "events", input.cursor === undefined);
    const range = input.sourceRange ?? { startUs: 0, endUs: ceil(fromTime(selected.durationUs)) },
      limit = input.limit ?? 100;
    if (
      !Number.isSafeInteger(range.startUs) ||
      !Number.isSafeInteger(range.endUs) ||
      range.startUs < 0 ||
      range.endUs > ceil(fromTime(selected.durationUs)) ||
      range.startUs >= range.endUs
    )
      throw new CatalogError("INVALID_RANGE", "Event range must be within the selected stream");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
      throw new CatalogError("INVALID_PARAMS", "Limit must be 1 to 500");
    const reference = createHash("sha256").update(JSON.stringify({ context, range })).digest("hex");
    let position = initialSourceEvents();
    if (input.cursor !== undefined) {
      const cursor = z
        .strictObject({
          reference: z.string(),
          position: z.strictObject({ capture: capturePositionSchema, scene: scenePositionSchema }),
        })
        .safeParse(input.cursor);
      if (!cursor.success) throw new CatalogError("INVALID_PARAMS", "Invalid source event cursor");
      if (cursor.data.reference !== reference)
        throw new CatalogError("ARTIFACT_CHANGED", "Event source or query changed");
      for (const kind of Object.keys(position.capture) as (keyof CapturePosition)[])
        position.capture[kind] = { ...cursor.data.position.capture[kind], row: null };
      position.scene = cursor.data.position.scene;
    }
    const pending = context.scene && !["ready", "unavailable"].includes(context.scene.state);
    const ready = context.coverage.some((c) => c.state === "ready");
    const support = intervalIndex(selected.track.available, (r) => ({
      start: fromTime(r.startUs),
      end: fromTime(r.endUs),
    }));
    const rows: SourceEventRow[] = [],
      budget = { remaining: 128 };
    let more = true;
    if (!pending)
      while (rows.length < limit) {
        const row = this.next(context, range, position, budget);
        if (row === undefined) break;
        if (row === null) {
          more = false;
          break;
        }
        const at = fromTime(row.sourceAtUs);
        if ((row.kind === "interruption" ? support.before(at) : support(at)).length) rows.push(row);
      }
    const result = {
      ...selected.selection,
      state: pending ? "not_ready" : ready ? "ready" : "unavailable",
      context,
      sourceRange: range,
      ...(input.cursor === undefined
        ? {
            available: sourceAvailability(selected.track.available, [range]),
          }
        : {}),
      page:
        pending || !ready
          ? null
          : {
              rows,
              nextCursor: more
                ? {
                    reference,
                    position: {
                      capture: Object.fromEntries(
                        Object.entries(position.capture).map(([kind, { after, done }]) => [
                          kind,
                          { after, done },
                        ]),
                      ),
                      scene: position.scene,
                    },
                  }
                : null,
            },
    };
    boundSourceEvidenceResponse(result);
    return result;
  }
}
