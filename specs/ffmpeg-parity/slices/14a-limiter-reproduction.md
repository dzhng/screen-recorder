# 14a — Explicit limiter recipe

Status: not started. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit limiter contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Caller supplies sample ceiling in dBFS, lookahead/attack/release in milliseconds; stereo is linked. Report that a sample ceiling is not an encoded true-peak guarantee. Disable auto-level; compensate latency and flush tails to preserve authored sample count. Detector consumes the signal entering this processor.

## Frozen artifact and verdict

Known impulses/steps and stereo transients; freeze mapped parameter ranges, expected envelope, linked-channel behavior, latency/flush and full/window/split oracle. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.
