# Compressed composition endpoints

The two-second AAC and MP3 sources both produce exactly 96,000 stereo composition
frames. A final 20,003 µs request produces exactly 961 frames and matches the full
mix slice with zero sample error in this run. The receipt retains the selected
clip with an empty unavailable-range list. No missing media is padded to pass.
The complete native mixer probe now passes nineteen checks.

The test retains the already-established AAC-only one-PCM16-step maximum/RMS
allowance; MP3 is exact in this tested case. A zero-error observation here does
not replace the documented broader AAC seek behavior. Full encoded endpoints
are tested separately from the earlier overlapping first-second case.

The first trial failed because the new test expected no clip receipt instead of
an empty range list for the selected clip. The native result matches its existing
contract; the assertion was corrected without changing production. Explicit full
and tail frame-count assertions then passed in a final complete rerun.
Independent review found no code issue but its native reader failed before this
case and it missed that initial receipt-shape error. Root execution and direct
inspection of the receipt-producing owner supply the corrected verification.

This adds endpoint/count coverage for these two 48 kHz files, not every compressed
rate, physical segment layout, unavailable-media scenario or subjective join.
Physical segment-origin composition and listening remain open. No processor,
normalization or hidden ramp was added.
