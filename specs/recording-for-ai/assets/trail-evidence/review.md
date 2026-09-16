# Trail evidence read verification

The core reads native-normalized evidence from the existing generation index.
The [durable tests](../../../../packages/core/src/evidence.test.ts) verify cursor
predecessors, nullable geometry, same-time epochs, pause ordering and bounded reads.

## Native boundary

[normalized.jsonl](normalized.jsonl) was emitted by the actual packaged native
`media.sourceEvidence` operation from a generated journal, without screen or audio
capture. It includes an unplaced pre-origin geometry, its timed placement, a pause,
and a cursor batch containing a pre-pause reading delivered after the marker.
The source-time mapping is explicit; equal-time cursor observations remain in their
original batch order. The test ingests this fixture and checks exact returned
observations plus the unchanged fixture bytes. It does not pretend generated data
proves physical capture timing.

## Bounds and evidence

All 16 focused evidence tests and all 109 core tests pass, along with core build
and type checks. A 50,000-observation indexed fixture remains queryable after its
derivative input file is removed. The point lookup returns the final unknown
observation rather than silently searching back for an eligible pointer.

Exceeding the geometry, unplaced-geometry or pause result cap throws LIMIT_EXCEEDED;
querying the exact final boundary still returns its full value and sequence.
Changing the lookahead LIMIT from 1001 to 1000 made this regression fail by silently
truncating; restoring it returned the suite green. Initial cursor and geometry
consumer tests were red before their read APIs existed.

SQLite query plans exposed a material issue: the nullable geometry query selected
the general sequence index, which could inspect unrelated observations throughout
the requested sequence range. It now explicitly uses the geometry time index with
sourceUs IS NULL, so unrelated cursor/audio history is outside the search. Point,
epoch and interval query plans use their corresponding indexes without a temporary
sort. The two geometry indexes are additive derived-index metadata; no source data
or existing table rows are rewritten.

## Review and limits

Shape review retains one evidence owner and the existing raw record schema. The
new queries preserve raw provenance; there is no clock conversion or inferred
placement in core. Existing raw paging, pauses and audio contracts stay intact.
The active trail planner must still consume these reads, resolve null-time
uncertainty and prove rendered cursor behavior. Stable normalized sequence is not
proof of event occurrence order across buffered event kinds.

Independent Codex review found no actionable defects and independently passed all
109 core tests plus the type check. Focused lint and formatting pass. The existing
pause API projects its original two-field contract, while the planner's pause read
adds stable sequence explicitly. Integration must link the prerequisite slice from
the active trail-timing handoff; that handoff is owned by the integrating pass.

Merged core verification passes all115 tests, including the new scene compatibility
checks. The rebuilt app and public source-timing read remain green. Public trail
rendering has not yet consumed these reads.
