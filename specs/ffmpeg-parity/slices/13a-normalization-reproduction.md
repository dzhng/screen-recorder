# 13a — Explicit normalization recipe

Status: recipe frozen; production admission not implemented. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit normalization contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Mode is gain-only linear or explicit dynamic; caller supplies LUFS, dBTP and LRA-in-LU targets. Measurement is the whole retained input before this processor, with exact channels/support. Refuse insufficient signal or impossible linear targets; output sample rate follows compiled delivery. No silent fallback.

## Frozen artifact and verdict

Calibrated steady/stepped speech-like signals, silence and impossible linear targets. Freeze actual mode, measured full-context dependency, resampling/latency, tails/sample count and post-encode tolerance. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.

## Frozen recipe and measured admission

Use the selected bundled FFmpeg 9.0.2 receipt
`27350ff2f953bbd4d6ca8bfe0f6808b99b9752192657d289146b50319099f66a`.
Gain-only means one constant `volume` with double precision, derived from measured
whole-domain integrated loudness. It never invokes loudnorm's optional linear
mode, whose fallback would change the caller's mode. Dynamic means explicit
`loudnorm linear=false`, two complete passes with measured input I/TP/LRA/threshold
and first-pass target offset, followed by explicit compiled output sample rate.
The output is a candidate until independent read-only measurement admits it.

Typed public controls: `mode:gain-only|dynamic`, `targetIntegratedLufs` (−70..−5),
`truePeakCeilingDbtp` (−9..0) and `maxLoudnessRangeLu` (1..50). The range target is
a maximum. Full-domain input needs measurable integrated/range/peak statistics
and complete support; inadequate duration, empty gates or unknown channels refuse.
Gain-only refuses if the requested gain predicts a peak over the accepted ceiling
or unchanged LRA over its maximum. Dynamic never substitutes for that refusal.

The parent accepted gates before untouched confirmation: integrated target
absolute error ≤0.20 LU, LRA ≤maximum+0.20 LU, and **meter-specific** true peak
≤ceiling+0.15 dB; exact frame count and gain-only scaled PCM error ≤1e-6. Requested
targets, achieved readings, meter/runtime identities and these admission tolerances
are retained in the prepared recipe/result. No hard mathematical or encoded
true-peak guarantee follows from the tolerance; final lossy delivery is metered
separately. Never publish a candidate that misses any requested postcondition.

[Untouched confirmation](../evidence/audio-recipes/normalization-confirmation-report.json)
passed gain-only unequal stereo 48kHz and explicit dynamic steady mono 44.1kHz.
Gain-only reached −20.0000LUFS with maximum scaled PCM difference7.45e-9; dynamic
reached −19.9850LUFS. Both retained exact authored sample counts. The independent
libebur128 oracle from10 supplied achieved measurements; production uses the
bound scanner and inherits its disclosed measurement scope.

**Failure is part of the contract:** the stepped 12s calibration reached−18.01LUFS
but LRA15.10LU for a requested maximum7LU. This output must be refused before
prepared publication. Loudnorm's LRA option does not universally impose an output
cap. The [failed calibration](../evidence/audio-recipes/normalization-calibration-report.json)
and complete operands remain retained. The first calibration log parser rejected
trailing FFmpeg output; parsing its already retained JSON fixed that observer
without repeating the inference. The initial confirmation oracle used numeric
strings; typed conversion reused the already retained reference result.

The [reproduction harness](../../../packages/test-harness/editing/audio-recipes/README.md)
and [complete operands](../evidence/audio-recipes/operands.json) establish bounded
numerical success/refusal cases. No listening or universal dynamic effectiveness
claim was made. Shared compiler/native preparation extension precedes production.
