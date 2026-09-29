# Non-grid admitted phase — retained red

This extends the bounded admission candidate to an ordinary declared phase of
100001 microseconds. CaptureClock grouping remains invariant at 44.1/48k for 1024
and 8192 sample buffers. The existing integer-video-origin policy is disclosed:
a raw origin 499ns past the declared microsecond, followed by a 100000.002us audio
offset, produces candidate anchor 100001us; rounding the true relative offset once
would produce 100000us. This pass retains that policy difference without claiming
raw-origin equivalence or changing admission to hide a reader failure.

Run `node packages/test-harness/editing/capture-admission-windows.mjs --out EMPTY_DIR`.
The existing native test target has an opt-in window probe, and CameraReproduction
materializes the same admitted phase using the banked sparse-container mechanism.
No production code, journal format, writer layout or public capture session changes.

The native source window and actual CompositionAudio consumer receive the canonical
media. The latter resamples 44.1k to its normal 48k project rate. Full native PCM is
independently verified as the original two-second input samples after the declared
leading empty interval; it is not merely another output chosen as truth.

The retained result is **red**: at both rates native windows equal the full/original
slice one sample earlier than requested. The 48k project window has the same shift;
the 44.1→48k project window also differs from full, without a simple output-frame
shift. `run/report.json` separates each measured result and reports
`windowGatePassed:false`. The harness records that property honestly; it does not
assert that the bug must persist after the common reader is corrected.

This phase is supported ordinary input, not a new unsupported-format category.
Do not globally snap it onto a native sample boundary, alter the admission phase,
or add a private reader offset. The common reader owner has the frozen controls
for causal localization. This case must turn green before writer rollout; it does
not invalidate the already banked aligned-phase sample test or establish general
resampling correctness by itself.

Requests, receipts and WAVs are retained with hashes. Original PCM inputs live in
the prior sparse-storage fixture; this leaf does not duplicate them. The separate
append/journal proposal remains read-only while this common-consumer gate is red.

Independent review confirmed the oracle and scope, and flagged missing retained
artifacts during review. The matching requests, receipts, WAVs and hashes are now
in this leaf; the raw review is preserved compressed. No production source changed.
