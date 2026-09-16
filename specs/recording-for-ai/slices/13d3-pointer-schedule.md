# 13d3 — Sequential current-pointer schedule

Status: core schedule implemented and verified; native composition remains open. Dependencies: [13d1](13d1-presentation-evidence.md),
[13d2](13d2-presentation-pointer-core.md). Parent: [13](13-edited-media.md).

## Contract

Merge source cursor observations, kept starts, pauses, geometry changes and native
presentation transitions in source order with bounded readers. Preserve exact
rational presentation boundaries. Carry the latest reset floor, including the
pause's strict-after rule, into the shared pointer eligibility policy. An old
pointer must not revive through A → B → A without a fresh cursor observation.

Write an immutable attempt-owned stream of ordered pointer states. Each kept span
has an explicit initial state, and a hidden pointer is represented by null.
Duplicate source timestamps resolve to the final normalized cursor observation.
Native interval splitting and movie composition belong to the following slice.

The source file/receipt must come from the pinned source's owned render attempt;
matching dimensions, duration and kept spans do not authenticate source identity.
No full-recording arrays, per-cursor worker processes or movie-specific copy of
cursor eligibility are allowed.

## Verification

First pin A → B → A without fresh cursor input. Then verify duplicate timestamp
ordering across read boundaries, pause equality, geometry/kept resets, exact
fractional support transitions, empty support, bounded progress, cancellation and
publication failure. Keep all nearest-still and shared-policy regression checks.

The [review and machine evidence](../assets/pointer-schedule/review.md) record the
scoped results and corrected independent-review findings.

[13d4 native composition](13d4-pointer-composition.md) consumes the stream through
the existing held-sample renderer. The parent slice owns durable preview integration
and physical capture acceptance.
