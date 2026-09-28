import { compileGeometry, type PicturePrimitive } from "./geometry.js";
import type { ValidatedComposition } from "./model.js";
import type { ProcessingInstruction } from "./processing-plan.js";
import type { CompiledFrame } from "./compiled-records.js";
import { CompositionError } from "./errors.js";

/** Flattening domains are fixed by target ownership, never inferred from child bounds. */
export function visualPlanner(model: ValidatedComposition) {
  const clips = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
  const canvas = model.document.canvas;
  return (plan: ProcessingInstruction[]): CompiledFrame["visual"] =>
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
        const operations: PicturePrimitive[] = [];
        for (const step of node.steps) {
          if (!step.enabled) continue;
          if (step.processor.type === "geometry") {
            if (!sourceSpace)
              operations.push({ kind: "rasterize", width: canvas.width, height: canvas.height });
            operations.push(...compileGeometry(domain, canvas, step.processor, pixelBounds));
            domain = canvas;
            sourceSpace = false;
            pixelBounds = undefined;
          } else if (step.processor.type === "opacity")
            operations.push({ kind: "opacity", opacity: step.processor.opacity });
        }
        if (sourceSpace)
          operations.push(...compileGeometry(domain, canvas, { type: "geometry" }, pixelBounds));
        return { target: node.target, inputs: node.inputs, operations };
      });
}
