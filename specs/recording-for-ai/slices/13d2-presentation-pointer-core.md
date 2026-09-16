# 13d2 — Shared pointer policy over presentation support

Status: scoped core seam implemented and verified; movie scheduling remains open. Dependency: [13d1](13d1-presentation-evidence.md).
Parent: [13](13-edited-media.md).

## Contract

A cut beginning at 0.75 seconds can display the source picture stamped zero until
one second. The movie reader proves membership using the exact support interval;
it must not relax the still inspector's sample-timestamp membership rule.

Open native presentation JSONL against its receipt and pinned revision, validate
coverage with bounded record buffers, and expose forward-only cursors. Independent
current-time and prior-pointer cursors let sequential consumers compare old and
current pictures without retaining all rasters, rescanning prefixes or spawning
per-event native workers. Backwards requests fail explicitly. An opened file and
its lifetime remain pinned; closing it invalidates cursors.

Share the existing pointer/geometry/scene decision body with still inspection.
Presentation point observations feed that same policy with no trail. Proven empty
support explicitly means no picture/no pointer, not missing geometry or fabricated
pixels. No movie event schedule, native overlay, service job or public operation
belongs in this pass.

## Verification

Start with the held-before-cut example and exact half-open endpoints. Pin rational
boundaries, malformed/truncated/mutated streams, monotonic queries, close/cancel,
and complete per-span coverage. Existing still-frame/trail results remain unchanged.
Compare pointer decisions for shared source evidence across presentation and still
adapters where their selected pictures agree, then exercise cut/pause/geometry,
outside cursor, scene change and empty support independently.

The [review and machine evidence](../assets/presentation-pointer-core/review.md)
record the focused results and independent review.

Sequential reset history now belongs to [13d3](13d3-pointer-schedule.md), which
passes a persistent floor and exact presentation clocks into the shared policy.
Point inspection remains distinct from scheduling. Next pickup is the native
composition checkpoint described there; parent 13 is not complete.
