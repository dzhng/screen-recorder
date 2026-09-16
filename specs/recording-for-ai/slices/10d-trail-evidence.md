# Indexed evidence for trail planning

Status: bounded core reads verified. This prerequisite does not select trails or
add a public operation. The [evidence report](../assets/trail-evidence/review.md)
records verification and the native-normalized fixture.

The source index owns cursor predecessors, recorded geometry placements and pause
markers. A cursor predecessor includes outside and unknown-geometry observations:
filtering them away would resurrect an older visible pointer after it left the
surface. Preserve each observation's time, eligibility, geometry epoch and stable
normalized sequence for the planner.

A timed geometry predecessor is only a recorded placement, not a guarantee of
active geometry. Geometry can change while paused or before source zero, leaving
no source timestamp. Reads expose those unplaced records and epoch lookups without
assigning guessed timestamps. A later explicit timed placement may resolve that
uncertainty. Callers must inspect the returned time even when looking up an epoch;
its latest placement can be later than the image being inspected.

Sequence means delivery order in the normalized export. Native cursor batches can
contain a pre-pause reading delivered after the pause marker. Time, epoch and native
clock semantics establish occurrence; sequence alone cannot. It only breaks ties
and preserves evidence order. Cursor and geometry point reads return null when no
matching evidence exists, never an invented observation.

Interval reads include both boundaries and retain equal-time sequence order.
Lists have a hard result cap and fail explicitly rather than silently discarding
reset markers. Indexed point and interval reads operate on the published evidence
generation; source files remain unchanged. No host-clock reconstruction, alternate
evidence owner, or new trail policy belongs in these reads.
