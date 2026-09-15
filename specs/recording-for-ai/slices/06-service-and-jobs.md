# 06 — Single-writer library and app-managed service

Status: revision/lifecycle storage, transport, app lifetime and library operation
binding, native capture control and journal reconciliation are integrated. Durable
artifact jobs and the wider physical capture gates remain. Dependencies: 02, 05.

The [revision transaction subpass](06a-revision-store.md) depends only on 05 and
can proceed while native recovery is verified. It builds this slice's single
catalog owner, not a second storage layer. This parent closes only after capture
journal ingestion, service lifetime and persistent jobs pass their own gates.

The [app-service lifetime subpass](06c-app-service-lifetime.md) depends on 00 and
06b, so idle process ownership can be verified independently of remaining audio
recovery gates. Its completion does not prove capture reconciliation.

The [library operation binding](06e-library-operations.md) gives both existing
transports access to the core catalog and edit engine. It can be verified before
native capture control and persistent artifact jobs are connected.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

New recordings, revisions and artifact jobs have one durable authority across CLI, MCP and native controls.

Implement core storage with SQLite, private socket transport in apps/service, and app-owned Node lifecycle. Allocate recording/source IDs before native start. Ingest native journal events idempotently, persist independent artifact states, and reconcile after restart. Implement request-id replay, revision compare-and-swap, undo stack and restore transactions against the timeline engine. Queue one heavy job/two frame jobs with explicit retry and cancellation.

## Runnable checkpoint

Run bun run lab:service. Use real subprocesses and temporary SCREENREC_HOME: two simultaneous writes, lost-response retry, stale revision, repeated undo, capture-journal ingest replay, native start rejection/death before first sample, service death during capture, job kill/retry, edit while transcript job runs, and client startup with app absent.

## Acceptance

Exactly one metadata writer and one winning concurrent edit; old IDs stay stale after undo. Latest returns newest not-ready take. Restart turns orphaned processing into explicit retryable failure. Late jobs cannot relabel old artifacts or recreate deleted recordings. A startup failure ends within the bounded deadline.

A failed take with no decodable video retains its catalog identity and terminal
failure, with no original revision; source reads return `UNAVAILABLE`. Exercise
that outcome separately from a usable interrupted prefix. Lifecycle replay must
survive relaunch, and history pagination must exclude edits added after its first
page. Consume and extend the existing revision store for these contracts.

## Decisions delegated and scope firewall

SQL layout and socket framing internals are delegated. No general migration layer or second daemon. Native capture-journal ownership stays distinct from library mutations. Promote probe functions into core; delete duplicate fixture-only stores.

## Visual review

No product styling gate. Any status screenshot must receive screenshot-critique last. Process logs and transaction evidence are the primary verdict.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If app-child lifecycle proves unworkable, reslice that transport with evidence; retain the single-writer/public-operation contract rather than adding a second authoritative store.

## Worker parent lifetime

An independent native subpass in `/tmp/screenrec-native-worker-lifetime` is checking
that a media worker exits when its original service parent dies, even with input
still open. That ownership is separate from EOF and from the later durable queue's
interrupted-job reconciliation. Its fixture must distinguish parent notification
from ordinary completion; a live worker with a closed test runner is not acceptable
cleanup evidence.
