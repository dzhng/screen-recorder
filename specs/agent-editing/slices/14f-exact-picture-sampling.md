# 14f — Preserve the exact picture sampling instant

Status: a public14e frame-counter probe exposed a clock-design defect. The current
floor-to-microsecond contract makes a matching30fps unit-rate source repeat and
skip pictures. Before implementation, independent audit confirmed the decoder
faithfully follows the old request; this is a compiler/execution contract repair.
Dependencies: existing composition frame phase and native presentation membership.
Public14e video acceptance waits for this fix. [The retained red](../assets/14f-picture-clock/README.md)
includes the actual picture, request/reply and source-clock analysis.

## One clock, explicit labels

Frame k executes at exact rational microseconds
`k * 1000000 * fps.denominator / fps.numerator`. The compiler owns this instant.
Existing integer sampleAtUs and visibleRange values remain derived labels for the
project's frame cells, preserving global range-preview phase; never reconstruct
an execution instant from a floored label. A compiler API exposes the exact instant
by frame index so other owners do not recalculate it.

Clip and ancestor availability, source mapping, contributor/dependency admission,
processing windows, geometry and opacity all sample that exact instant. A mapped
video sourceUs uses the existing TimeValue number-or-rational shape; holds preserve
their authored instant. Native selection compares this exact source instant with
physical presentation support. Do not use epsilon, nearest-frame selection or
quantized physical timestamps. Use the existing ExactTime arithmetic owner; avoid
requiring the requested rational to fit CMTime merely to compare it with decoded
sample support. Decoder seeks may start earlier without changing selection.

Pointer dependencies and presentation membership use exact time. Cursor event
records retain their integer observation clock; floor only that observation cutoff,
after exact source-to-capture mapping. Requested-source receipt checks use rational
equality. Native prepared-pointer validation must enforce the same relationship.
Raw source frame APIs retain their existing distinct query contracts.

## Scope and ownership

Composition owns the frame clock and exact mapping. Core consumers ask that owner
for execution time; native owns physical sample membership. Frame/movie renderer
identities change so cached pictures made under the old rule cannot masquerade as
corrected output. No new table, persistent timeline or compatibility wrapper.
Keep original workers and historical evidence immutable; build new workers only in
isolated scratch. Retiming DSP and all accepted A–D audio remain unchanged.

The old integer execution formula is deliberately superseded in contracts.md only
with the demonstrated unit-rate counter failure retained. Audit choices records
why one-frame identity preservation outweighs retaining the implementation's
microsecond sampling approximation. The integer label convention itself stays.

## Verification and review surface

Before accepting, prove matching-CFR unit-rate counter identity and fractional-rate
source mapping through actual frame.get and encoded movie delivery. Retain the old
29→28 counter failure at project query999999us/30fps. A query's requested instant
is not its selected frame instant: independent oracles must first select the
project frame, then map its exact execution instant.

Pin rational cut/window membership, including a clip or processor beginning at
33333.2us containing frame1 at33333⅓us. Exercise ancestor/source exclusions,
geometry/opacity, pointer dependencies and exact presentation membership with
integer event cutoffs, holds, repeated/retimed sources and source origins. Full,
pure-split and short-range outputs must select identical source pictures for the
same project frame. Existing compilation/index/pointer and native movie checks
remain required; update an old assertion only when it encodes the disproved
integer-execution rule, retaining its other contract.

Use the existing14e counter/landmark fixture and named source frames. The visual
variable is picture identity around frame and edit boundaries, with large counters
and asymmetric bit markers as the crop. Layout, captions and aesthetic changes are
out of scope. Run compare-screenshots against the source and retained red, then
fresh unprimed screenshot-critique as the last visual check before acceptance.
Open shots with preview-shots for an optional five-minute review while continuing
independent work; silence does not supply audio or physical acceptance.

Delegated: internal helper names and bounded exact-comparison mechanics. The single
clock, exact physical membership, label convention, ownership and preserved audio
are fixed. Complete repository review and audit-choices before committing.
