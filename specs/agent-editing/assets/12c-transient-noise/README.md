# Brief-noise control

The frozen learned filter reduces this isolated transient-noise input by 29.57 dB,
less than the 48.32 dB measured on the separately retained stationary control at the
same aggregate input noise level. These differ in temporal and spectral shape;
this is a cohort comparison, not attribution to duration alone. All 240,000 output
samples are finite and unclipped under the established 960-sample compensation.

The mixture error against the original narration is 5.74 dB above added input noise.
That includes altered original ambience, speech and phase; it does not isolate
residual noise or establish speech damage. Neither metric accepts speech quality.

[The predeclared plan](plan.json) specifies five 20 ms triangular seeded-noise bursts
and unchanged 10 dB aggregate added-noise ratio. [Report](report.json) pins processor,
input/output hashes, commands and scope. Float files retain raw delayed output
and compensated output without normalization. [Frozen experiment script](run.py)
records the exact local invocation and scratch paths; it is research evidence,
not a production denoising API. No downloads, audio playback or model change.

Next use broader localized speech/listening checks and a pure-split-safe prepared
output policy. The user-preferred learned candidate remains provisional.

Retained-output verification recomputed counts, compensation slices, hashes and
metrics. The first independent arithmetic check used double-precision differences
while the experiment stored float32 differences; matching the declared float32
convention reproduces both reported values exactly. Raw outputs were unchanged.

Independent review found no actionable defect and recomputed hashes, counts,
compensation, clipping, metrics and the 10 dB input ratio from retained data.
