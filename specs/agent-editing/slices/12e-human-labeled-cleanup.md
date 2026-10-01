# 12e — Remove the independently marked fillers

Status: accepted. Native exact-range removal, exclusion controls, public delivery
and the user's independent complete-sentence audition pass. Dependencies are
the [saved human labels](../assets/12d-human-marks/README.md) and verified public
composition/editing owners, not a passing automatic speech recipe.

## Contract

Remove both explicitly named filler ranges in the marked complete sentence while
preserving protected words and the original recording. Use the user's actual
boundaries; neither inherited ASR timing nor the older accepted cut supplies new
ground truth. Preserve that older candidate and its scoped listening verdict.
This fixed task supplements parent 12 without claiming a complete corpus
inventory, repetition/removal intent, model selection or aggregate quality pass.

## Verification

- [x] Reproduce the frozen original through the current isolated native worker.
- [x] Exclude every sample in both marked ranges with exact delivered counts.
- [x] Complete retained PCM equality outside the existing join ramps and exact
  protected-word preservation; changed-sample negative control rejects damage.
- [x] Poison both excluded ranges in the actual source, verify each reaches
  original extraction, and prove the complete candidate remains unchanged.
- [x] Public edit, CLI/MCP WAV, preview/export and undo agree with the native
  candidate and existing codec/clock policies.
- [x] Independent complete-sentence audition accepts beginning, neighboring
  words, ending and join for this exact new candidate.

The [candidate packet](../assets/12e-labeled-cleanup/README.md) owns measurements,
identities and listening disposition. Reuse the existing excerpt and composition
owners; add no semantic editing service or generalized cleanup API. No new
capture, model, installation or audible automatic playback is needed.
