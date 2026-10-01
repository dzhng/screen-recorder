# 12g — Keep filler measurement separate from required preservation

Status: implemented and isolated scorer verification passed; root integration
pending. This applies the existing selected best-effort policy; parent12 quality
remains open.

## Contract and ownership

The selected speech engine exposes evidence and makes no editorial choices. Filler
precision/recall, false positives, false negatives and confidence intervals remain
measurements, as specified in the [current verification contract](../../recording-for-ai/verification.md#performance-and-fidelity-targets).
A filler label alone cannot fail evaluation or promote a word to required. An
explicitly required filler remains required. Preserve both omission roles using
separate reference-word indices, with the existing canonical-only hard omission
check. Held-out/walkthrough required omissions remain diagnostic.

The [existing evaluator](../../../packages/test-harness/speech/evaluate.mjs) owns
matching, metrics, omission diagnostics and status. The ordinary `evaluate` CLI
prints that report and chooses its existing exit code. No policy toggle, alternate
scorer, model or wrapper belongs here. Timing, independent coverage, provenance,
audition and warm-resource requirements retain their current meaning and bounds.
Historical reports, failed trials and the chosen model remain immutable.

## Verification and limits

Use synthetic evaluator contract inputs through the actual CLI. A complete cohort
with low filler scores and optional canonical filler omissions must retain every
measurement while passing only when all other requirements are met. Explicitly
required fillers and other required canonical words must still fail on omission;
independent timing misses must still fail; sparse low-score evidence stays pending.
Compare complete before/after reports and preserve the original failed regression.

The [owned evidence packet](../assets/12g-evaluator-policy/README.md) records exact
inputs, outputs, commands and identities. Synthetic inputs exercise evidence
branches; they are not human quality proof, new inference or a selected-baseline
pass. Reuse accepted marks/models/media without repeating inference or auditions.
Root owns parent12 and shared handoff/ledger updates.
