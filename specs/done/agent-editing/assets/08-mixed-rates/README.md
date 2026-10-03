# Simultaneous sample-rate mixing

The production-entry mixer now overlaps 44.1 kHz mono and 48 kHz stereo. Every output
sample equals the float32 sum of the separately verified resampled signal and
original stereo PCM. Fractional range delivery and a pure split preserve that mix
exactly. The complete existing mixer probe passes all seventeen checks.

A scratch negative control mutes the 48 kHz clip and fails at sample 2, showing the
reference requires both sources. No comparison tolerance, gain policy or native
implementation changed. Independent review found no actionable defect; its native
reader failed before the new cases, so runtime acceptance comes from the root run.

This proves the tested simultaneous rates, channels and clocks, including the
existing resampler's independently checked tone bound. It does not validate all
codec/rate combinations, physical segment origins, subjective speech joins or
release-scale behavior. Those remain open under 08 and 24.
