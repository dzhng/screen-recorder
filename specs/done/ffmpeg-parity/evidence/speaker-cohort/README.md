# Independent acoustic speaker cohort

This bounded research result selects **no provider**. Both unchanged cached
candidates fail a development case under the fixed 20% DER limit, including
overlap with zero collar. No confirmation inference occurred. The three original
official test windows remain untouched for a separately frozen development recipe.

The [initial protocol](frozen-protocol.json) preceded input acquisition and
inference. [Selection](selection.json) uses only original, human-corrected
VoxConverse v0.3 annotations, never provider predictions. The original RTTMs and
[upstream declaration](upstream-dataset-readme.md) preserve attribution. The
[paper](https://arxiv.org/abs/2007.01216) describes correction after watching and
listening, aiming for 100 ms boundaries; this is not 50 ms word-boundary truth.

## Original clocks and provider padding

[Admission](admission.json) validates original RIFF clocks, selected integer
samples, exact PCM16-to-Float32 conversion, original RTTM reconstruction and every
prepared model/binary hash before inference. [Acquisition](input-audit.json)
records bounded HTTP ranges, exact response ranges/ETags, ZIP membership,
size/CRC and full selected-member hashes. Entire multi-gigabyte archive hashes
were not computed. Only the six selected members were fetched; original audio
remains in the shared research cache and is not redistributed here. Dataset
annotation rights do not supersede original media owners' rights.

Community1 returns one endpoint outside physical support. The pinned SDK creates
integer-stride overlapping windows, clears the unavailable tail to zeros, then
reconstructs the entire frame extent without a source-duration clamp. Exact source
[snapshots and notice](source-snapshots.json) bind that explanation to the executed
SDK revision. [Clock protocol](clock-protocol.json) was frozen before adapted
rescoring. Its adapter intersects only proven padded support with the original
clock, retaining every interior bound unchanged and explicitly accounting for
excluded padding. The original invalid output and scorer failure remain retained.
No threshold, identity, merge, source shift, collar or reference changed.

## Evidence and interpretation

[Raw results](results/) retain complete JSON, native logs, commands, exit status,
network denial and scores. [Replay](replay.mjs) reads them without acquisition,
model execution or product state changes. The [research map](research.json) owns
outcomes, budgets, hypothesis effects and next experiments.

The scoped process RSS and inference budget pass. Host CoreML caches are reused;
RSS excludes out-of-process CoreML/ANE memory. Startup is separate and does not
prove truly uncached cold cost. A passing subset cannot conceal a failed case.
Root Sortformer weight lineage remains unresolved independently of these scores.
Anonymous acoustic IDs do not prove recognition, unknown-assignment confidence,
word fidelity, product integration or general population quality.
