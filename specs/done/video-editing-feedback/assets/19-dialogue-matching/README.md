# Dialogue finishing checkpoint

The [public CLI report](report.json) retains ordinary delivered loudness files,
explicit edit requests, resulting revisions and unchanged real-source hashes.
Two identified8s speakers use the [fixture owner](../../../../../fixtures/video-editing-feedback/dialogue/README.md),
with explicit−12dB quiet-host attenuation and no recognition or listening labels.
Their processed levels start at−31.3/−21.9LUFS; independent +5.3/−4.1dB gain
drafts and explicit edits bring each selected clip to−26LUFS. Existing compression
and its+3dB makeup remain in order; the gain does not replace that stack.

Complete dynamic mastering then meets−20LUFS/−1dBTP/7LU. The
[independent full-precision oracle](master-oracle.json) observes−19.9633575LUFS,
−3.8302596dBTP,0.943751877LU LRA and exactly768000 stereo48kHz frames.
Unchanged strict gates pass; no encoded-delivery claim follows. The
[public journey](../../../../../packages/test-harness/editing/dialogue-matching.mjs)
owns reproduction, uses existing process/transport owners and keeps generated
audio scratch-only. The reported target is this fixture's explicit request, not
a universal dialogue preset.

The native makeup regression genuinely failed through schema and strict native
wire admission before implementation; afterward+6dB scales the baseline PCM
within1e−6, retained recipe includes the parameter and bypass is byte-identical
dry PCM. The integrated native was rebuilt in isolated output and the case passed
again. Seven pure/standalone helper checks cover exact pins, silence/short/gaps,
explicit peak/bounds, stale/dry evidence, repeated/retimed grids, unrepresentable
gains and new ID-free edit drafts. The public checkpoint initially refused a
fabricated processing-step ID; corrected fresh drafts omit IDs and retain
existing IDs, per the existing edit contract. No contract was weakened.

Scoped review is complete: the shape keeps measurement, explicit edits and audio
execution with their existing owners; the diff has no unresolved findings; docs
link the creative workflow to the finishing reference and executable helper.
The [independent review](independent-review.md) reached a clean terminal verdict.
Test-fixture cleanup uses the canonical below-gate reason and removes an obsolete
ID deletion. No media-producing behavior changed after the accepted run.
Whole-repository checks remain deferred until all spec slices are complete.
