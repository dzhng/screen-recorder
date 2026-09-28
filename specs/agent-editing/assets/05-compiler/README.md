# Compiler evidence

The pure compiler gate passes. This evidence opens no service, decodes no media and
makes no CLI/MCP or native-readiness claim. Native/video/audio/public-route adoption
remains gated by 07, 08, 09 and their later capability slices.

The [probe](../../../../packages/test-harness/editing/compiler.mjs) runs the actual
core asset-metadata projection and public compiler exports. Build core and composition
before running it. The [report](report.json) distinguishes source-rate metadata,
output sample clocks and unexecuted resampling.

Independent golden sequences prove B→A video over A→B audio, then restrict the full
nested processing tree to a short window. The same fixture carries 44.1/48 kHz
source metadata through the actual admission-to-composition projection. Its project
selection remains in presentation microseconds; no decoded-rate parity is claimed.
Strict frame/audio records and manifests round-trip JSON, including fractional
source boundaries and clipped sample bounds.

The frozen [render reproduction](../../../../packages/test-harness/editing/RENDER-REPRODUCTION.md)
exposed a defect in the first compiler pass: filtering samples at or after preview
start omitted the picture already visible there. Frames now carry the original
sample time and a separately clipped visible interval. A 50,001µs start retains the
33,366µs picture; an exact 66,733µs boundary correctly selects that sampled frame.
Window dependencies retain a leading picture's clip even if it ended before the
window, and omit video occurrences with no sampled presentation in that window.
The leading-picture regression failed on the old implementation before the fix.

Compiled frame layers distinguish source-unavailable from anchor-unavailable,
with ancestor support taking precedence. A direct and an attached occurrence of
the same gapped source produce different statuses in the independent probe. Only
a source-unavailable status may be resolved by native proof of a physical empty
edit; an unknown gap or unavailable ancestor cannot silently become black. The
resolver preserves this cause before intersecting availability, so native workers
do not recreate attachment logic.

The composition suite covers gaps, holds, exact cuts, nested ordering, gain/bypass,
retiming requirements, target taps, no-op empty stacks, immutable result ownership,
late windows in 10,000 repeated clips and lazy two-hour iteration. Window target
selection occurs before source/availability calculation; a deterministic metadata
read probe confirms unrelated siblings are not resolved during scoped iteration.
No wall-clock threshold is substituted for the later scale gate.

Verification: composition build/typecheck, core build, 92 composition tests, focused
lint/format checks and the expanded compiler probe pass. Removing the strict frame
coverage check falsifies its malformed-record regression. Earlier independent
reviews caught mutable empty stacks, out-of-window arithmetic and post-filtered
sibling work; those findings remain fixed. Native executors and actual prepared
results intentionally stay unresolved with an explicit NOT_READY guard. Stateful
processing, recipe pins, decoded-media fidelity and public journeys are not implied.

Final independent Codex review found no actionable regressions and reran the
92-test suite, typecheck/build and compiler conformance harness after the
availability-provenance change. Pure slice 05 acceptance is complete; downstream
media and live-route gates remain unchanged.
