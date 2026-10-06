import { temporalProcessing } from "./temporal-processing.js";
import { compileGeometry } from "./geometry.js";
import type { ValidatedComposition } from "./model.js";
import type { ProcessingInstruction } from "./processing-plan.js";
import type { CompiledFrame } from "./compiled-records.js";
import type { VisualOperation } from "./pointer.js";
import type { TimeValue } from "./schema.js";
import { CompositionError } from "./errors.js";
import { processingScalars } from "./processing.js";

/** Flattening domains are fixed by target ownership, never inferred from child bounds. */
export function visualPlanner(
  model: ValidatedComposition,
  temporal: ReturnType<typeof temporalProcessing>,
) {
  const clips = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
  const canvas = model.document.canvas;
  return (plan: ProcessingInstruction[], atUs: TimeValue): CompiledFrame["visual"] =>
    plan
      .filter((node) => node.mediaKind !== "audio")
      .map((node) => {
        let domain = { width: canvas.width, height: canvas.height };
        let pixelBounds: { x: number; y: number; width: number; height: number } | undefined;
        let sourceSpace = node.target.kind === "clip";
        if (node.target.kind === "clip") {
          const resolved = clips.get(node.target.id)!;
          const stream = resolved.stream;
          if (resolved.clip.source.kind === "text")
            domain = { width: resolved.clip.source.width, height: resolved.clip.source.height };
          else {
            if (!stream || stream.kind === "audio")
              throw new CompositionError(
                "INVALID_COMPOSITION",
                "Visual target has no picture domain",
              );
            domain = { width: stream.width, height: stream.height };
            pixelBounds = stream.kind === "video" ? stream.pixelBounds : undefined;
          }
        }
        const operations: VisualOperation[] = [];
        const geometryPrefix: number[] = [];
        const motionBlurOperations: VisualOperation[] = [];
        const hasAnimatedGeometry = node.steps.some(
          (step) =>
            step.processor.type === "geometry" &&
            Object.values(processingScalars(step.processor)).some((value) => typeof value !== "number"),
        );
        for (const step of node.steps) {
          if (!step.enabled) continue;
          if (step.processor.type === "geometry") {
            const geometry = temporal.geometry(step, node.target, atUs);
            if (geometry === null) continue;
            const start = operations.length;
            if (!sourceSpace)
              operations.push({ kind: "rasterize", width: canvas.width, height: canvas.height });
            operations.push(...compileGeometry(domain, canvas, geometry, pixelBounds));
            for (let index = start; index < operations.length; index++) geometryPrefix.push(index);
            domain = canvas;
            sourceSpace = false;
            pixelBounds = undefined;
          } else if (step.processor.type === "pointer")
            operations.push({
              kind: "pointer",
              stepId: step.id,
              trailUs: step.processor.trailUs,
              geometryPrefix: [...geometryPrefix],
            });
          else if (step.processor.type === "lut") {
            const { type: _, ...parameters } = step.processor;
            operations.push({ kind: "lut", ...parameters });
          } else if (step.processor.type === "sdr-correction") {
            const { type: _, ...parameters } = step.processor;
            operations.push({ kind: "sdr-correction", ...parameters });
          } else if (step.processor.type === "opacity") {
            const opacity = temporal.opacity(step, node.target, atUs);
            if (opacity !== null) operations.push({ kind: "opacity", opacity });
          } else if (step.processor.type === "blend") {
            operations.push({ kind: "blend", mode: step.processor.mode });
          } else if (
            step.processor.type === "motion-blur" &&
            hasAnimatedGeometry &&
            step.processor.samples > 1 &&
            step.processor.shutter > 0
          ) {
            motionBlurOperations.push({
              kind: "motion-blur",
              samples: step.processor.samples,
              shutter: step.processor.shutter,
            });
          }
        }
        if (sourceSpace)
          operations.push(...compileGeometry(domain, canvas, { type: "geometry" }, pixelBounds));
        operations.push(...motionBlurOperations);
        return { target: node.target, inputs: node.inputs, operations };
      });
}
