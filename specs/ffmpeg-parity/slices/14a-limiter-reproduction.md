# 14a — Explicit limiter recipe

Status: recipe frozen; production not implemented. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit limiter contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Caller supplies sample ceiling in dBFS, one lookahead/attack duration and release in milliseconds; stereo is linked. Report that a sample ceiling is not an encoded true-peak guarantee. Disable auto-level; compensate latency and flush tails to preserve authored sample count. Detector consumes the signal entering this processor.

## Frozen artifact and verdict

Known impulses/steps and stereo transients; freeze mapped parameter ranges, expected envelope, linked-channel behavior, latency/flush and full/window/split oracle. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.

## Frozen linked sample limiter

Use bundled FFmpeg 9.0.2 composed linked-mono-max-limiter-v1: `alimiter`
on the mono maximum-absolute channel detector, unit input/output levels, `level=false`,
`asc=false`, `latency=true`. Public controls: `ceilingDbfs`
(20log10(.0625)..0, approximately−24.0824..0), `lookaheadMs` (.1..80) and
`releaseMs` (1..8000). Ceiling maps to10^(dBFS/20). Stereo is maximum-linked.
The single lookahead control maps to FFmpeg attack; no independent attack knob
is invented. The parent accepted this coupling before confirmation. The mono detector buffer
is floor(rate×lookaheadMs/1000) samples, with buffer−1 samples of compensated
delay. Native graph scheduling supplies the complete state domain.

Parent accepted exact authored sample count/landmark timing, linked ratio error
≤1e-6, sample-ceiling excess ≤1e-6 linear amplitude, and packet/full-context crop
PCM difference ≤1e-6 before untouched confirmation.
[Three confirmations](../evidence/audio-recipes/dynamics-report.json) covered
lookahead 2.75ms,.1ms and80ms, including31 input frames shorter than the3839-sample
delay. All authored leading/middle/final impulses retained their indices; frame
counts, linked gain, ceiling and packet/crop equality passed. The explicit
uncompensated calibration shifted impulses239 samples and lost the last one;
that diagnostic demonstrates why latency compensation and flushing are binding.

This is a sample limiter, with no auto-gain  Full-domain processing followed by a
window crop passed exactly; a newly initialized excerpt is outside that proof.
A sample ceiling does not establish reconstructed or encoded true peak. Complete
[input/output arrays](../evidence/audio-recipes/operands.json) retain the evidence
and selected FFmpeg SHA8410694433e927bdf2cc751b8c81cb4545b2302828fdffed6044018b10f39f31.
Compiler split/domain invariance and public consumer proof remain production work.

## Raw candidate failure and selected composed recipe

Review added signed gain, finite-PCM and complete compressor-envelope checks.
These found a real raw alimiter limitation: output is computed before release gain
is clamped back to unity. A low-level sample showed gain 1.00017762, within the
independent one-release-step bound 1+1/(rate×releaseSeconds). Disable automatic
level compensation is the contract; mathematical per-sample non-amplification is
not claimed. Frozen ceiling/link/packet/crop tolerances stayed unchanged.

An untouched near-ceiling raw control retained the ceiling but failed the original
linked ratio gate: absolute difference 2.91e-5. Its per-channel safety clip caught
release overshoot on only the louder channel. The
[failed raw report](../evidence/audio-recipes/raw-reviewed-report.json) remains
evidence; it cannot admit the raw recipe as universally linked output.

The parent accepted a separately frozen composed recipe before confirmation.
Reshape stereo input to128-sample padded packets and split program/detector.
Compute m=max(abs(L),abs(R)), split m into dry and limited branches, run the same
latency-compensated alimiter on mono m, and regrid limited m to128 packets. Merge
original stereo/dry m/limited m, derive g=limited(m)/m (m=0→1), apply that common
scalar to both signed original channels, and trim exact authored count. These are
bounded PCM filters, not routing/timeline interpretation. All filters are present
in the selected final bundle. Packet grid, zero rule and complete graph are recipe
identity.

[Calibration comparisons](../evidence/audio-recipes/linked-calibration-report.json)
matched all three low-level raw-winner outputs exactly. The intentional near-ceiling
correction applies the scalar safety clamp to both channels; the quieter channel
changes at most 1.46e-5 versus the failed raw output.
[Untouched confirmation](../evidence/audio-recipes/linked-heldout-report.json)
used 19007 near-ceiling frames with authored silence and 101 mostly-zero frames
shorter than 80ms lookahead. Both passed unchanged exact-count/landmark/zero/sign
checks, ceiling/link 1e-6 and packet/crop 1e-6. Maximum linked error was1.12e-8;
packet/crop differences were zero. No raw failure or tolerance was discarded.
The shared seam and production 14 must use this single composed recipe.

Final independent review rechecked complete scratch arrays and confirmed the
selected signed/zero/count/clock/link/ceiling/packet/crop gates. It found that the
archive had not yet captured newest confirmation/fault operands; the refreshed
archive and hash manifest now retain every generator, complete comparison operand
and report. This correction changed retention only and did not rerun inference.
