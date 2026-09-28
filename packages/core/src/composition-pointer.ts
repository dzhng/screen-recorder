import { setImmediate } from "node:timers/promises";
import { createHash, randomUUID } from "node:crypto";
import { link, open, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { isMediaClip, type CompiledFrame, type ValidatedComposition } from "@screenrec/composition";
import type { SourceEvidenceReader } from "./evidence-read.js";
import type { SourceSelection } from "./source-selection.js";
import type { PointerPreparation } from "./pointer-preparation.js";
import {
  PresentationPointerHistory,
  pointerHistoryBudget,
} from "./presentation-pointer-history.js";
import { CatalogError } from "./catalog.js";

/** Provisional attempt admission, independent of source duration or output pixel allocation. */
export const pointerPreparationLimits = Object.freeze({
  maxBytes: 128 * 1024 ** 2,
  maxRows: 1_000_000,
  maxEvents: 1_000_000,
  maxSources: 256,
  maxHistoryBytes: 1024 ** 3,
  maxFrames: 1_000_000,
  maxOperations: 10_000_000,
  rowBytes: 256 * 1024,
});
export type PreparedPointers = { file: string; bytes: number; records: number; sha256: string };
type Held = Parameters<Parameters<PointerPreparation["withHistory"]>[2]>[0];

/** Writes one bounded row per enabled pointer operation in raw compiler order.
 * All source/cache leases enclose the stream; no overlays cross inline IPC. */
export async function prepareCompositionPointers(
  input: {
    model: ValidatedComposition;
    frames: () => Iterable<CompiledFrame>;
    output: string;
    preparation: PointerPreparation;
    evidence: SourceEvidenceReader;
  },
  signal: AbortSignal,
  limits: { [K in keyof typeof pointerPreparationLimits]: number } = pointerPreparationLimits,
): Promise<PreparedPointers> {
  if (!isAbsolute(input.output))
    throw new CatalogError(
      "INVALID_OUTPUT",
      "Pointer preparation requires an absolute attempt path",
    );
  for (const [key, value] of Object.entries(limits))
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > pointerPreparationLimits[key as keyof typeof limits]
    )
      throw new CatalogError("INVALID_RANGE", "Pointer preparation requires bounded limits");
  const clips = new Map(input.model.clips.map(({ clip }) => [clip.id, clip]));
  const selections = new Map<string, SourceSelection>();
  // Compiler windows are replayable; this bounded scan discovers only participating sources.
  const work = () => {
    let frames = 0,
      operations = 0;
    return {
      frame() {
        signal.throwIfAborted();
        if (++frames > limits.maxFrames)
          throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds frame budget");
      },
      operation() {
        signal.throwIfAborted();
        if (++operations > limits.maxOperations)
          throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds graph work budget");
      },
    };
  };
  const operations = async function* (frames: Iterable<CompiledFrame>) {
    let frameCount = 0,
      operationCount = 0;
    const budget = work();
    for (const frame of frames) {
      budget.frame();
      if (frameCount++ % 128 === 0) await setImmediate(undefined, { signal });
      for (const node of frame.visual)
        for (const op of node.operations) {
          budget.operation();
          if (operationCount++ % 256 === 0) await setImmediate(undefined, { signal });
          if (op.kind === "pointer") yield { frame, node, op };
        }
    }
  };
  let rows = 0;
  for await (const { frame, node } of operations(input.frames())) {
    signal.throwIfAborted();
    if (++rows > limits.maxRows)
      throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds occurrence budget");
    if (node.target.kind !== "clip")
      throw new CatalogError("INVALID_EVIDENCE", "Pointer operation lacks clip source context");
    const clip = clips.get(node.target.id)!;
    if (!clip || !isMediaClip(clip) || !clip.acquisitionId)
      throw new CatalogError("INVALID_EVIDENCE", "Pointer clip lacks capture authority");
    const layer = frame.layers.find((layer) => layer.clipId === clip.id);
    if (!layer || layer.availability !== "available") continue;
    const selection = {
      assetId: clip.assetId,
      streamId: clip.streamId,
      acquisitionId: clip.acquisitionId,
    };
    selections.set(JSON.stringify(selection), selection);
    if (selections.size > limits.maxSources)
      throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds source lease budget");
  }
  const contexts = new Map<string, Held>();
  const entries = [...selections.entries()];
  let historyBytes = 0;
  const use = async (index: number): Promise<PreparedPointers> => {
    if (index < entries.length) {
      const [key, selection] = entries[index]!;
      return input.preparation.withHistory(
        selection,
        signal,
        async (held) => {
          historyBytes += held.presentation.receipt.bytes;
          contexts.set(key, held);
          try {
            return await use(index + 1);
          } finally {
            contexts.delete(key);
          }
        },
        limits.maxHistoryBytes - historyBytes,
      );
    }
    return write();
  };
  const write = async () => {
    signal.throwIfAborted();
    const staging = join(dirname(input.output), `.pointers-${randomUUID()}`);
    const file = await open(staging, "wx", 0o600);
    const hash = createHash("sha256");
    let bytes = 0,
      records = 0;
    const budget = pointerHistoryBudget({
      maxEvents: limits.maxEvents,
      maxSamples: limits.maxRows,
    });
    const samplers = new Map<string, PresentationPointerHistory>();
    try {
      for await (const { frame, node, op } of operations(input.frames())) {
        signal.throwIfAborted();
        if (++records > limits.maxRows)
          throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds occurrence budget");
        if (node.target.kind !== "clip")
          throw new CatalogError("INVALID_EVIDENCE", "Pointer operation lacks clip context");
        const clip = clips.get(node.target.id)!;
        if (!isMediaClip(clip) || !clip.acquisitionId)
          throw new CatalogError("INVALID_EVIDENCE", "Pointer clip lacks capture authority");
        const layer = frame.layers.find((layer) => layer.clipId === clip.id);
        const base = {
          frameIndex: frame.index,
          sampleAtUs: frame.sampleAtUs,
          clipId: clip.id,
          stepId: op.stepId,
          trailUs: op.trailUs,
        };
        let row: unknown = { ...base, status: "inactive" };
        if (layer) {
          if (layer.kind !== "video")
            throw new CatalogError("INVALID_EVIDENCE", "Pointer requires a timed video layer");
          const identity = {
            assetId: clip.assetId,
            streamId: clip.streamId,
            requestedSourceUs: layer.sourceUs,
          };
          if (layer.assetId !== clip.assetId || layer.streamId !== clip.streamId)
            throw new CatalogError("INVALID_EVIDENCE", "Compiled pointer layer changed its source");
          if (layer.availability !== "available")
            row = {
              ...base,
              ...identity,
              status: "excluded",
              availability: layer.availability,
            };
          else {
            const key = JSON.stringify({
              assetId: clip.assetId,
              streamId: clip.streamId,
              acquisitionId: clip.acquisitionId,
            });
            const held = contexts.get(key)!;
            let sampler = samplers.get(key);
            if (!sampler) {
              sampler = new PresentationPointerHistory(
                {
                  presentation: held.presentation,
                  evidence: input.evidence,
                  identity: held.plan.history.evidence,
                },
                signal,
                budget,
              );
              samplers.set(key, sampler);
            }
            const captureUs = layer.sourceUs - held.plan.sourceToAssetOffsetUs;
            const sampled = await sampler.sample(0, captureUs, op.trailUs);
            const context = {
              ...base,
              ...identity,
              captureUs,
              clockOffsetUs: held.plan.history.clockOffsetUs,
              sourceToAssetOffsetUs: held.plan.sourceToAssetOffsetUs,
              width: held.presentation.receipt.sourceWidth,
              height: held.presentation.receipt.sourceHeight,
              start: sampled.record.start,
              end: sampled.record.end,
            };
            row =
              sampled.inspection.kind === "empty"
                ? { ...context, status: "empty" }
                : {
                    ...context,
                    status: "picture",
                    sampleTime: sampled.inspection.record.sampleTime,
                    overlay: sampled.inspection.plan.overlay,
                  };
          }
        }
        const data = Buffer.from(JSON.stringify(row) + "\n");
        if (data.length > limits.rowBytes || data.length > limits.maxBytes - bytes)
          throw new CatalogError("LIMIT_EXCEEDED", "Pointer preparation exceeds byte budget");
        await file.writeFile(data);
        hash.update(data);
        bytes += data.length;
      }
      if (records !== rows)
        throw new CatalogError(
          "INVALID_EVIDENCE",
          "Compiled pointer occurrences changed during preparation",
        );
      await file.sync();
      signal.throwIfAborted();
      await link(staging, input.output);
      return { file: input.output, bytes, records, sha256: hash.digest("hex") };
    } finally {
      for (const sampler of samplers.values()) await sampler.close();
      try {
        await file.close();
      } finally {
        await rm(staging, { force: true });
      }
    }
  };
  return use(0);
}
