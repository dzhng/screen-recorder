# Retained pitch-follow preparation

Pitch-follow renders each complete retained source run once through the platform
rate converter. Exact rational arithmetic owns source demand and output sample
debt; only the converter's format rate is a `Double`. Ordinary and state-prerequisite
reads share the resulting PCM, before clip or parent processing. Request-local
scratch grows with duration, while conversion uses bounded blocks. Completed runs
retain paths rather than open descriptors.

[The follow report](follow.json) verifies exact output counts and measured tone
frequencies for mono/stereo sources at 44.1/48 kHz, including fractional converter
rates. Its retained-run comparisons cover splits, subranges, excluded poison,
silent lanes, policy/rate identity collisions and stereo RNNoise prefixes outside
the output view. Identity is compared with the existing unit-rate graph; that
graph normalizes negative zero through addition. This is not a raw signed-zero
preservation claim.

[The preserve regression](preserve.json) retains complete accepted mono PCM,
selected-only input, gaps, post-retime gain and state comparisons. It also renders
300 retained runs under a 256-descriptor limit and compares every output byte
with 300 repetitions of the single-run reference. Cancellation and selected
nonfinite input leave no published output or retiming scratch.

The 60-second and 600-second follow processes peaked at 31,981,568 and 31,965,184
resident bytes on this host. These are process measurements, not bounds on disk
usage, filesystem cache or other hosts. The fixed evaluator allows a 32 MiB
increase between these two durations. No maximum product duration is inferred.

[The mutation record](mutation.json) distinguishes the deliberately integer-rounded
converter-rate failure from the observed descriptor regression and old follow
refusal. The integer-rate mutation fails because the converter cannot pay the
exact output debt; restored code passes. Its temporary binary was not retained.
The failing pre-descriptor-repair worker and successful worker have separate
recorded hashes. [The manifest](manifest.json) binds committed sources, evaluators,
reports, platform and binaries; paths under `/tmp` describe verification provenance,
not portable dependencies. The bounded archive contains only request plans and
logs. Generated PCM and binaries are not duplicated here.

Independent review found no remaining blocker after the descriptor repair, but
supplied no separate build. The configured Codex CLI review failed account/model
admission and contributes no review evidence. These native checks do not prove
public CLI/MCP delivery, perceptual quality or universal bit-identical platform
conversion across processes. [The later native admission evidence](../14e-native-admission/README.md)
records small float differences seen in two regenerated follow outputs rather
than treating them as exact regeneration.

Reproduce with an isolated build of `ScreenRecorderCompositionAudioTests` and
fresh output directories using the [follow](../../../../packages/test-harness/editing/composition-follow.py)
and [preserve](../../../../packages/test-harness/editing/composition-retime.py)
evaluators. Each accepts the test worker path followed by its output directory.
The manifest's source commit identifies this historical run; current bound
native execution is verified separately by the linked admission evidence.
