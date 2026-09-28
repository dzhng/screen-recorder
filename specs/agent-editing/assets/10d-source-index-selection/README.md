# Source index selection

Raw-source selection uses physical presentation observations. A scene change keeps
requests at the known previous and current observations; its reason carries the
exact physical sample clock and the later observation time separately. A first
observation of a changed picture does not claim when the unseen semantic cut
happened. The independently authored held-picture test and [mutation](mutation.txt)
prove that replacing the earlier request with grid-boundary-minus-one selects the
new picture twice.

Support edges are requested even when a narrow supported island lies between all
scene observations. Availability changes are distinct from edits. An unavailable
observation means that point had no picture; any surrounding unrepresented index
range remains unproven. Stillness can suppress periodic raw pictures without
inventing captured cursor stationarity or interpreting cursor overlays.

The source policy uses bounded lookback over published chunks. The recording
selector remains unchanged: its packed playback spans, nearest-sample policy and
cursor trail equality are different concerns. This adds a small source policy
instead of adding conditionals throughout the recording state machine. File
retention, coverage reads and scheduling remain shared owners. Dense support edges
obey the existing pending-work budget.

Unavailable coverage explicitly distinguishes retained scene observations from
validated demanded-picture observations. The frame owner checks the latter against
the exact settled request only when appending. The stored snapshot remains readable
following job removal and catalog reopen; an invented attempt cannot be admitted.

[Actual native requests](native.json) use the selector over published scene chunks
for generated two-track footage, with deliberately coarse declared support over a
real empty edit. Both tracks retain the unavailable observation and demand valid
pictures at support edges and recovery. Source bytes remain unchanged. This proves
selection/extraction, not public index readiness or visual quality.

Automatic parent-job materialization and final coverage generation remain next.
This checkpoint does not add a source index endpoint, second scheduler or cache.

Verification: full core 560 passed, one skipped; source selection/storage focused
13 passed, and source plus unchanged recording selection 23 passed. Core typecheck
and build pass. The grid-minus-one mutation fails the old/new physical-picture
oracle while six other source selector tests remain green.

Independent review reported no actionable defects and reran 29 source selection,
source storage and unchanged recording selector tests. Shape review kept the raw
policy in one bounded traversal rather than adding raw/edited/cursor switches to
the recording state machine. Source unavailable provenance uses the existing
frame owner for admission and the existing index rows for retention.
