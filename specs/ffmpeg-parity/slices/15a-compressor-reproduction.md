# 15a — Explicit compressor recipe

Status: not started. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit compressor contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Threshold/knee are dB, ratio dimensionless, attack/release milliseconds; stereo is linked. Detector is explicit input signal or selected processed tap before this processor; reject routing cycles. Detector state follows the same compiled state domains as program signal. Preserve sample count and compensate any latency.

## Frozen artifact and verdict

Distinct detector/program steps and overlap/gap cases; freeze detector tap semantics, parameter mapping/ranges, response, linked-channel behavior, context/tails and full/window/split oracle. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.
