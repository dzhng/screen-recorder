# 06d — Durable recording lifecycle

Status: complete as a storage subpass. The existing SQLite catalog owner now allocates
recording and capture-source identity before capture, applies reported device
transitions idempotently, and finalizes a validated source exactly once. Core type
check, lint, format and 25 core tests pass, plus the 22 service round-trip tests that
drive the same store through a real socket. This does not close slice 06: the native
capture controller, journal parsing, control operations, job scheduling and artifact
state still live there. Dependency: [06a](06a-revision-store.md). Public module:
`@screenrec/core/library`.

## Contract and owner

`RevisionStore` remains the only metadata writer. Lifecycle state lives on the
recording row it already owned; there is no second store, event framework or device
state machine. Core persists what a capture session *reports* and refuses what
contradicts it — it never infers a transition or a duration of its own.

- **Identity before capture.** `allocate` reserves both the recording ID and the
  capture-source ID that native stamps into its journal, in state `preparing`.
  An optional allocation request key makes a lost start response replay to the same
  take instead of starting a second one.
- **Reported transitions.** `ingestLifecycle` applies one event carrying the source
  ID and a sequence. A mismatched source ID is refused; a sequence already applied
  returns the stored recording unchanged; an unreachable target state is refused with
  `INVALID_STATE`. Sequence gaps are accepted, because a journal tail can be lost.
- **Finalization.** `complete` carries the validated source duration and creates the
  original revision inside the same transaction; a repeat is idempotent and a
  different duration is refused. `interrupted` carries a reason plus either a
  validated recovered duration (normal original-revision registration) or `null`
  (no original revision, no zero-duration timeline). A `null` duration is a validated
  claim that no video survived, so it and an attached duration refuse each other in
  both directions: recovery must finish before the interruption is reported.
- **Settled means settled.** `complete`, `interrupted` and `canceled` accept only a
  repeat of themselves, so a stale completion cannot overwrite a newer outcome and an
  interruption cannot overwrite a finished take.
- **Discovery.** `latest` returns the newest non-canceled take, ready or not. Every
  timeline read of a discarded take — revision, history, fresh edits and edit replay
  alike — reports
  `UNAVAILABLE`; reads of an interrupted take with no video report `UNAVAILABLE` with
  its reason; reads of a live take report `NOT_READY`. A discarded take keeps its row
  only so allocation replay and late-event refusal still resolve it.

Edit, undo, restore, replay, history pagination and competing-writer behavior are
unchanged from 06a and are still exercised by their own tests.

## Decisions taken here

- **Contract names win over the prompt's.** States use contracts.md's vocabulary:
  `complete` is the finalized state (not "ready"). `canceled` is added as the seventh
  state because a discarded take must stay resolvable for allocation replay and for
  refusing its late native events; it is excluded from discovery rather than deleted.
- **One sequence counter per capture session, authored by the event's producer.**
  The native journal numbers its own events; the service numbers the events it raises
  itself (a refused start, a cancel that never reached native). Core requires only
  strict increase within the session, which is what makes at-least-once delivery safe.
- **Source attachment stays a separate primitive.** `registerSource` attaches a
  validated duration independently of device state, as 06a required, and the
  `complete`/`interrupted` paths call it. It refuses a canceled take and refuses a
  changed duration, so "exactly once" holds through either entry point.
- **No migration step.** This is a fresh development schema; pre-existing
  development catalogs are not automatically upgraded.

## Verification

Real temporary SQLite databases with injected clock/ID providers, observed red before
green, and each new guard falsified once by breaking it and confirming the expected
test — and only that test — went red: the sequence guard, the session-identity guard,
the transition table, the discovery filter, source immutability in both directions,
the canceled-source guard, the settled no-video guard, the discarded-read guard on
both revision and history, the settled-read distinction, the lifecycle transaction
boundary and allocation replay.

Covered: allocation discoverable as `preparing` before readiness; a whole take's
transitions replayed after reopening the database; a stale completion losing to a
newer interruption; an event from another session changing nothing; a completion for
a take that never started creating no timeline; a discarded take leaving discovery
while its restart request still names one new take; a permission failure keeping its
identity with no original revision; a repeated finalization keeping exactly one
original revision; a write that fails after the original revision was inserted leaving
neither the state nor the revision behind; and a canceled take refusing a source
registered after the fact.

Core type check, lint, format and 25 core tests pass, with the 22 service round-trip
tests green against the same store. Four independent Codex reviews ran; they found the two
contradictory-source directions, two paths that still read a discarded take (history
and edit replay) and two missing falsification cases. All are fixed here; the last
review reproduced its finding through public calls only.

This is storage proof only. It says nothing about real capture: no native controller,
IPC operation, journal parser, scheduler or UI took part, and every duration and
reason in these tests was supplied by the test as already-validated input.

## Handoff

The service composes these calls: `allocate(requestId)` before instructing native to
start, then one `ingestLifecycle` per journal or control event, then edits through the
existing revision API. Still open in slice 06 and its siblings: the capture-control
operations that produce these events, journal ingestion after service death,
`recordings.list` with its cursor, artifact/job state and generation pinning, storage
accounting and delete. None of them may introduce a second catalog.
