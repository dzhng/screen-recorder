# Low and high lossless source rates

This bounded checkpoint exercises integral upsampling and downsampling through the
existing 48 kHz stereo composition mixer. An authored 8 kHz mono PCM source and a
192 kHz stereo PCM source each overlap the same independent 48 kHz reference.
The high case reaches the currently admitted rate boundary; it does not verify
rejection above that boundary or all admitted formats.

Source extraction is exact against the authored PCM. Full, fractional range,
tail and split requests preserve exact sample clocks and sample values relative
to the matching full render. Each mixed output is the exact float sum of the
native converted component and the independent reference. Mono duplicates exactly;
distinct authored stereo tones verify channel identity independently of the mix
comparison. Missing-input, one-frame shift and swapped-stereo controls are rejected.
These checks establish timing, channel routing and arithmetic, not the quality of
an independently specified resampling filter.

The shared rate harness owns the case definitions and retains WAVs before
validation. Its default compressed cohort remains intact; the earlier AAC
cross-invocation reproducibility gap and lack of a substitute tolerance remain
recorded in [the preceding checkpoint](../08-11-rate-conformance/README.md).
No product behavior, resampler, source admission or codec policy changed.

The [verification record](verification.md) identifies runs, worker and reviews.
The archive preserves all captured media, native requests/receipts, failed-control
measurements and logs. It contains no rendered acoustic images, and makes no
listening or whole-slice 08/11 acceptance claim. Negative occupied origins,
admission-boundary refusals, music/real-speech joins and listening remain separate
requirements; this finite pair is not a Cartesian codec/rate/layout matrix.
