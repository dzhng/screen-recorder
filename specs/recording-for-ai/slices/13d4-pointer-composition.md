# 13d4 — Native current-pointer composition

Status: native composition implemented; generated native verification passed. Depends on [13d3](13d3-pointer-schedule.md).
Parent: [13](13-edited-media.md).

## Contract

Consume the core's immutable pointer schedule in bounded reads. Validate the pinned
file, receipt, ordering and initial state of every kept span; retain only a bounded
record buffer and one next state. Native draws supplied states and owns no cursor
eligibility, scene comparison or interpolation policy.

Split the existing held-picture traversal at exact pointer transitions. Composite
only the current pointer through the existing frame overlay rasterizer, starting
from clean held pixels on every split. Preserve source geometry, cuts and the
single video encoding pass. Empty support remains opaque black with no pointer.

Use a movie clock that represents all required transitions exactly, including the
final audio mux, or return `UNSUPPORTED_CLOCK` before publishing. A rounded duration
is insufficient evidence. The enclosing attempt binds source, revision, schedule
and receipt; matching metadata cannot authenticate a source independently.

## Verification

Generated sparse video must show moving and cleared pointers while its picture is
held, without accumulating trails. Pin fractional transitions and cuts, unsupported
clock rejection, invalid/changed schedules, cancellation and destination ownership.
Run existing video/movie/nearest-still gates. Keep native composition separate from
service preview integration and physical capture acceptance.

[Review and measured evidence](../assets/pointer-composition/review.md) document the
clock guarantee and scoped results. Next: prepare presentation evidence and pointer
states in the durable preview attempt, then call the native movie operation.
