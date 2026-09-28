import type { ProcessingInstruction } from "@screenrec/composition";

/** Visual parameters and activation are already resolved in picture instructions, not native metadata. */
export function nativeProcessing(plan: readonly ProcessingInstruction[]) {
  return plan.map(({ steps, ...node }) => ({
    ...node,
    steps: steps.map(({ id, enabled, processor }) => ({
      id,
      enabled,
      processor: ["opacity", "geometry"].includes(processor.type)
        ? { type: processor.type }
        : processor,
    })),
  }));
}
