# 06a — Durable revision transactions

Status: complete as a storage subpass. Real SQLite allocation, source registration,
revision replay/CAS, repeated undo/restore and snapshot history are integrated.
Core build, type check and 15 tests pass, including competing Node processes;
independent Codex review found no actionable defects. This does not close slice 06:
native ingestion, lifecycle request replay, source inventories and jobs remain there.
Dependency: slice 05. Public module: `@screenrec/core/library`.

## Contract and owner

Implement the single SQLite catalog owner in `packages/core/library.ts`, consuming
the existing pure timeline functions. Allocate recording identities before source
readiness, preserve monotonic discovery order, and attach the immutable source
duration/original revision once finalized or recovered. Keep recording creation,
source registration and edit transactions separate from device capture state.

The catalog persists recordings, immutable revisions, successful edit replay
records and an undo target stack. Table layout is delegated; there must not be a
second catalog introduced when native ingestion is integrated. Typed metadata can
expand in the capture/service pass without compatibility scaffolding.

All edit semantics in contracts.md apply: fresh revision IDs; compare expected
revision inside the write transaction; validate/canonicalize a whole cut batch;
persist argument fingerprint/result and revision in the same transaction; check
successful replay before stale rejection. Request-key reuse with different arguments
is an error. Repeated undo walks the active edit stack; restore creates a new,
undoable revision. A no-op trim returns the existing revision without adding history.

Never hold a transaction while encoding/transcribing. Native files are not written
by this module. Job scheduling, deletion of media, socket transport and the menu UI
are outside this subpass and must not be faked here.

## Verification

Use real temporary SQLite databases with injected fixture clock/IDs. Test one
behavior at a time, observed red then green: incomplete newest discovery, source
registration/replay, two cuts then repeated undo/exhaustion, restore/undo, stale
requests, same-request replay after subsequent edits, mismatched reuse, reopen the
database, rejected range without state changes, and competing processes submitting
one expected revision. Exactly one new edit may commit; the loser observes stale
state after acquiring the transaction. Bound lock waiting and expose failure.

Compare persisted intervals and current/history identities, not just row counts.
An independently stated O→A→B→undo→undo→restore→undo example from contracts.md is
the oracle. Existing timeline tests stay green. No visual artifact is required.

## Handoff

Expose a cohesive catalog API for the service to consume; do not create an interim
CLI-only editor. Record the API, native-ingestion follow-ups and exact evidence in
the parent handoff. Review shape, diff and docs, audit choices, then commit only this
subpass's files. Root integration owns public package exports and shared manifests.
