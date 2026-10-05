# 13a — Explicit normalization recipe

Status: not started. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit normalization contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Mode is gain-only linear or explicit dynamic; caller supplies LUFS, dBTP and LRA-in-LU targets. Measurement is the whole retained input before this processor, with exact channels/support. Refuse insufficient signal or impossible linear targets; output sample rate follows compiled delivery. No silent fallback.

## Frozen artifact and verdict

Calibrated steady/stepped speech-like signals, silence and impossible linear targets. Freeze actual mode, measured full-context dependency, resampling/latency, tails/sample count and post-encode tolerance. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.
