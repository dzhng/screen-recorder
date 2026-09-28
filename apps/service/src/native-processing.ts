import type { ProcessingInstruction } from "@screenrec/composition";

/** Opacity and activation are already resolved in picture instructions, not native metadata. */
export function nativeProcessing(plan: readonly ProcessingInstruction[]) {
  return plan.map(({ steps, ...node }) => ({
    ...node,
    steps: steps.map(({ id, enabled, processor }) => ({
      id,
      enabled,
      processor: processor.type === "opacity" ? { type: processor.type } : processor,
    })),
  }));
}
