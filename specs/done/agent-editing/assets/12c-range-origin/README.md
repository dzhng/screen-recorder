# Denoise range origin

Restarting the frozen learned filter with one second of preceding kept audio does
not reproduce a late window from full processing: 47,999 of 48,000 samples differ,
with maximum absolute error 0.0029093. Starting at the requested window changes
all 48,000 samples. The full-origin control reproduces the window exactly.

[The predeclared plan](plan.json) fixes the retained five-second noisy narration,
its existing processed baseline, frame-aligned origins, unchanged suffix and
960-sample latency compensation. Only the processing start changes. The query is
seconds three through four of the same kept target; it is not a new edit selection.
[Report](report.json) and compressed raw/window PCM retain exact identities and
comparisons. No output normalization or tolerance was added.

This rejects the tested one-second warmup as an exact range/full strategy. It does
not prove every finite warmup fails. A retained processed target or verified state
checkpoint remains the appropriate next mechanism to investigate; hidden unbounded
prefix replay is not adopted. Excluded material must still be removed before
forming that target, and pure splits must preserve its processing origin.
Speech quality, context identity, preparation lifetime and production adoption
remain open. No runtime behavior or product dependency changed.

Independent review verified retained hashes and PCM comparisons and found no
actionable defect. No production state policy is selected by this experiment.
