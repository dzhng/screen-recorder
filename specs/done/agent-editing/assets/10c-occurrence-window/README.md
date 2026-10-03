# Exact occurrence window selection

The source projection owner indexes editorial envelopes separately from available
support. A gap-only query still identifies the occurrence and its clipped project
envelope, while returning no source fragments. This lets evidence readers report
unavailable capture context or break phrase continuity without inventing evidence.
Named inverse windows seek source rows; named forward points place instantaneous
events. Both use the same rational clock and physical/acquisition/ancestor support
as existing editorial range projection. Query clipping does not redefine whether
a complete source word survives an edit.

The indexes are built once per immutable revision. Global and selected-track
queries skip unrelated envelopes; named queries use a clip map and support index.
Results sort by clipped envelope start, canonical track rank and clip ID. Final
word/event merge ordering remains the reader’s responsibility. Holds, stills and
authored silence do not advance source evidence.

## Verification

All 118 composition tests pass, preserving existing exact range/partiality and
acquisition behavior. New cases cover fractional inverse ranges, gap-only masks,
track filtering/tied ordering, forward points and ancestor support boundaries.
A late query among 4096 occurrences examines fewer than 64 envelope values; named
inverse lookup examines fewer than four. Replacing indexed selection with a linear
scan reads 8100 values and fails the unchanged bound. Initial missing-method red,
mutation red and full green output are retained.

Build, type checks, lint, formatting and diff checks pass. Independent CLI review
found no actionable defects. No renderer, core service, public route or live-media
acceptance is implied by this pure mapping checkpoint.

Root integration at 99ac270 rebuilt composition and passed all 118 composition
tests. Public project evidence endpoints remain unimplemented.
