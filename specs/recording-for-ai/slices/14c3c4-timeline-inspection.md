# 14c3c4 — Bounded timeline inspection

Status: implemented through shared core/service ownership and actual CLI/MCP
composition. [Verification and ownership](../assets/timeline-inspection/README.md)
separate timeline evidence from transcript or speech acceptance.

Library and retained-package timeline reads use one projection owner over pinned
source and scene evidence. A package's default is its exported revision; an explicit
included historical revision is reprojected from those same immutable source inputs.
Its exported event pages are never relabeled as another revision.

A continuation pins target, revision and both evidence generations. Its fixed-size
stream positions advance through source records, scene chunks and cuts. Pagination
must neither restart at the beginning nor create another event store/job lifecycle.
A bounded consumed-input allowance may produce an empty page while scanning removed
or static material. Consumers continue while a cursor exists, even when no rows were
returned. Emitted ordinals advance only for emitted events.

Return individual rows with source event data, playback position and ordinal. Equal
playback positions form one logical group and can span pages; combine adjacent rows
at that position. Public limits remain 100 by default and 500 maximum. Source journal
order and cut-boundary semantics remain owned by the existing timeline projection.
The portable serializer consumes this same reader, rather than implementing another
projection pipeline.

The service owns target resolution, readiness and continuation scope. Existing
package context authority fences reads before and after awaited work. No new public
context lookup or private-file capability is exposed. An edit does not retarget a
continuation; an explicit conflicting revision or changed evidence generation fails.

Verification must show library/package parity, historical revision selection,
continuation scope, empty-page forward progress, bounded read work, cancellation,
close/deletion rejection, and complete export/event-validator regressions. Actual
CLI/MCP wiring and parity are verified through the shared operation registry. Complete narrated package and speech gates remain separate.
