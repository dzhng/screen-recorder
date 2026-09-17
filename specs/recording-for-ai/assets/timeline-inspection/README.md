# Public timeline inspection

The [shared event reader](../../../../packages/core/src/event-pages.ts) projects
pinned source and scene evidence for both library and retained-package inspection.
The portable writer uses that same reader; there is no second event store, processing
job or projection algorithm. The [service adapters](../../../../apps/service/src/timeline-inspection.ts)
resolve existing library/package authority and leave the response contract in the
[shared inspection owner](../../../../packages/core/src/timeline-inspection.ts).

## Bounded forward progress

A request bounds both returned markers and consumed input. Long static or removed
stretches may return no rows but still advance an opaque continuation. Consumers
must follow `nextCursor` until it is null, even after an empty page. Ordinals count
only emitted markers; the continuation separately remembers source-record keys,
scene chunk/boundary position, cuts and interruption state. It does not rescan
already consumed source evidence on each request.

Equal playback positions belong to one logical group, even across page boundaries.
Each row preserves its source marker and playback position. Journal sequence and
the timeline owner's boundary/cut rules determine the order. Marker-only time does
not create media duration.

Continuations bind target, revision, source and scene generations, capture
interruption state and event policy. They pin the initially selected revision even
if the library's current revision changes. A conflicting selector is rejected
before trying to look up its revision in another target. Both adapters resolve
authority again after awaited reads, so close/deletion or changed evidence cannot
return a continuation for a retired context.

A package defaults to its exported revision. Explicit included history is projected
from bundled source/scenes; exported event pages are never relabeled as another
revision. Source and scene evidence must both be published. This operation neither
requires nor claims transcript readiness.

## Evidence and limits

[Actual CLI/MCP proof](public.json) covers a generated relocated ZIP, default and
included historical revisions, independently expected pause/cut/geometry/interruption
positions, library/package row equality, continuation after a concurrent current
edit, selector isolation, public bounds, library deletion isolation, package close
and restart revocation. The fixture uses the actual native ZIP writer and public
operation registry. See its [host result](public.txt).

Core tests cover empty-page progress without phantom ordinals, generation scope,
concurrent edits during a read, authority revocation during awaited work and all
portable producer/validator regressions. Disabling checkpoint restoration produced
a repeated continuation and failed the progress test; restoring it passed. See
[negative control](resume-negative.txt) and [focused result](focused.txt).

The verification checkpoint passed 326 core, 99 service, 13 protocol and 21 CLI
tests. Independent Codex review found no actionable defects and independently
passed workspace types and all 326 core tests. Its scope did not include native
execution; the host proof above supplies that evidence. Retained-file event
validation and close revocation also remain covered by the
[retention result](retention.txt).

Generated fixtures demonstrate public timeline semantics, not physical gesture,
narration fidelity, transcript editing or full processed-package release readiness.
