# Five-picture packet reproduction

A fresh 2,052,120-byte movie made from accepted journal ordinals 220–224 with the
same single-copy and exact gap edits reproduces the read stall after two pictures.
The same five-picture source window completes with digest
`32ac4c4b2afc0c369569c23d24ad9f9f12713f2e426bd2c6f1b643179c738e61`.
This makes a small reproducer independent of the thousands of edits in the full
candidate. The 20-second diagnostic watchdog terminated its reader; no canonical
publication or full recovery success is claimed.

Read-only compressed-sample inspection distinguishes this failure from the earlier
passing three-picture case. Both preserve all 13 unique source payload hashes and
selected-picture sync/dependency flags. There are no missing payload bytes in this
comparison. In the failing case, the last picture before the first gap is droppable
and has PTS 933410 / DTS 1000080 in candidate media time; the next retained reference
picture has PTS 1000080 / DTS 933410. Across that backward decode-order transition,
AVAssetReader's compressed output replays earlier GOP packets. It emits 47 buffers
and 4,083,139 payload bytes versus the raw window's 17 buffers and 1,473,698 bytes.
The passing three-picture case advances to a droppable picture with forward DTS;
its compressed output has 20 buffers versus 17 raw, with the same 66,233 payload
bytes. Timing values use the exact million-tick clock, not rounded milliseconds.

This associates the failure with the cross-gap decoder restart/replay path. It does
not establish an AVFoundation internal cause, justify a tolerance change, or imply
that all such GOP boundaries fail. Buffer-level discontinuity attachments were not
subsequently inspected; sample-level attachments, cursor flags, PTS/DTS/durations
and payload hashes are retained in full.

Writer/backend trials are paused while the parent audit revisits upstream capture
admission and display-duration semantics. Accepted mappings and original media
remain immutable. Rejected callback pixels are absent from this fixture and cannot
be reconstructed. The unproven writer draft is not adopted, and no capture guard
or reader policy changed in this evidence pass.

`evidence.tar.gz` retains the tiny movie, selected original journal rows, generator,
exact verifier source, timeout trace, packet inspector and complete comparisons.
Its manifest authenticates every member; the large source is the separately
retained physical fixture. All processes are terminal. No new recording, codec
sweep, full re-export or production change occurred.
