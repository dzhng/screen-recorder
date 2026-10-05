import type { CompiledProcessingInstruction } from "@screenrec/composition";

/** Visual parameters and activation are already resolved in picture instructions, not native metadata. */
export function nativeProcessing(plan: readonly CompiledProcessingInstruction[]) {
  return plan.map(({ steps, ...node }) => ({
    ...node,
    steps: steps.map(({ id, enabled, processor }) => ({
      id,
      enabled,
      processor: ["opacity", "geometry", "sdr-correction"].includes(processor.type)
        ? { type: processor.type }
        : processor,
    })),
  }));
}
