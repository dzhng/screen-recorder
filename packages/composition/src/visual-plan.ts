import { temporalProcessing } from "./temporal-processing.js";
import { compileGeometry } from "./geometry.js";
import type { ValidatedComposition } from "./model.js";
import type { ProcessingInstruction } from "./processing-plan.js";
import type { CompiledFrame } from "./compiled-records.js";
import type { VisualOperation } from "./pointer.js";
import { CompositionError } from "./errors.js";

/** Flattening domains are fixed by target ownership, never inferred from child bounds. */
export function visualPlanner(
  model: ValidatedComposition,
  temporal: ReturnType<typeof temporalProcessing>,
) {
  const clips = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
  const canvas = model.document.canvas;
  return (plan: ProcessingInstruction[], atUs: number): CompiledFrame["visual"] =>
    plan
      .filter((node) => node.mediaKind !== "audio")
      .map((node) => {
        let domain = { width: canvas.width, height: canvas.height };
        let pixelBounds: { x: number; y: number; width: number; height: number } | undefined;
        let sourceSpace = node.target.kind === "clip";
        if (node.target.kind === "clip") {
          const stream = clips.get(node.target.id)!.stream;
          if (!stream || stream.kind === "audio")
            throw new CompositionError(
              "INVALID_COMPOSITION",
              "Visual target has no picture domain",
            );
          domain = { width: stream.width, height: stream.height };
          pixelBounds = stream.kind === "video" ? stream.pixelBounds : undefined;
        }
        const operations: VisualOperation[] = [];
        const geometryPrefix: number[] = [];
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
          else if (step.processor.type === "opacity") {
            const opacity = temporal.opacity(step, node.target, atUs);
            if (opacity !== null) operations.push({ kind: "opacity", opacity });
          }
        }
        if (sourceSpace)
          operations.push(...compileGeometry(domain, canvas, { type: "geometry" }, pixelBounds));
        return { target: node.target, inputs: node.inputs, operations };
      });
}
