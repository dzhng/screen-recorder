# 06g — Durable artifact jobs

Status: complete as a core subpass. The catalog that already owns recordings and
revisions now also owns durable artifact jobs: bounded admission, deduplicated work,
one automatic attempt with explicit retry, lane limits, capture priority, cancellation
and restart reconciliation. Core type check, lint and 38 core tests pass, plus the 44
service and 3 CLI tests that drive the same store. This does not close slice 06, and it
implements no transcription, frame or export work: every executor in these tests is the
test's own. Dependency: [06a](06a-revision-store.md)/[06d](06d-recording-lifecycle.md).
Public module: `@screenrec/core/jobs`. Evidence:
[durable jobs review](../assets/durable-jobs/review.md).

## Contract and owner

`JobQueue` is the processing-state owner named in [architecture](../architecture.md).
It keeps its tables in the connection `RevisionStore` already opened, so there is one
catalog, one writer and no second database or daemon. `RevisionStore` exposes that
connection and its transaction boundary for exactly this reason; recordings and
revisions remain its own.

- **Pinned identity.** Admission pins recording, artifact, the caller's canonical input
  identity and the recording's current revision. An edit committed while work runs never
  moves the pinned revision, and publication stamps the artifact with the identity the
  work was admitted for plus a generation that increments per publication.
- **One attempt, then an explicit retry.** Work queued or running for the same identity
  is returned as it stands instead of doubled — enforced by a partial unique index, not
  only by the read that precedes it. Nothing re-runs on its own. `retry` mints a fresh
  attempt identity, and only an attempt that still owns its job may publish, so an
  answer from an abandoned, canceled or restart-orphaned attempt is dropped.
- **Bounded concurrency and capture priority.** One heavy and two frame attempts run at
  once. No new heavy attempt starts while any take is still capturing; frame work is not
  gated, because a live take's registered prefix is legitimately inspectable.
- **Bounded admission.** Waiting work is durable, so the queue caps it and reports
  `LIMIT_EXCEEDED` with `retryable`. Already-admitted identities still resolve when full.
- **Nothing polls.** Starts happen on submission, retry, cancellation and settled
  attempts; the owner calls `schedule()` after a reported capture transition. There is no
  timer, no backoff and no automatic retry anywhere in the module.
- **Cancellation costs what it costs.** A canceled job is canceled immediately and its
  attempt is aborted, but its lane stays occupied until the work actually settles, so
  capacity is never handed to a second attempt while the first is still using it.
- **Restart.** A `running` row can only outlive the process that owned it, so opening the
  catalog turns it into an explicit retryable failure rather than permanent ambiguity.

## Decisions taken here

- **The queue extends the existing catalog rather than receiving a handle to it.**
  `RevisionStore.catalog` and `RevisionStore.transaction` are public so sibling core
  modules keep their tables in the one database. Recording reads still go through the
  store's own methods, so the recordings table keeps exactly one owner.
- **`input` is opaque to core.** The queue compares the caller's canonical input string
  and never parses it, so no artifact schema is invented here for transcription, frames
  or export to inherit later.
- **Capture priority reuses `unsettled()`.** Any take that can still produce media pauses
  new heavy work, rather than a second list of "capturing" states being re-derived here.
  Startup reconciliation is what settles a stranded take, and with it this pause.
- **A validated absence is a non-retryable failure.** An executor rejecting with a
  non-retryable `CatalogError` reports `unavailable` with its reason and refuses retry;
  every other rejection is a retryable failure. That is the whole vocabulary — no
  separate outcome type, and core never decides on an adapter's behalf that an artifact
  cannot exist.
- **Publication requires a present, non-discarded take.** Core has no deletion yet, so
  this guard is proved today through cancellation. Wiring deletion to cancel a
  recording's jobs before removing its media stays future work in slice 06's library
  family; the publication guard is the half that already holds.
- **One queue per catalog.** Restart reconciliation runs when the queue opens, so a
  second live queue on one catalog would fail the first's attempts. The service owns one.

## Verification

Real temporary SQLite catalogs, an injected executor whose every attempt is held open by
the test, and acknowledged start/settle events rather than sleeps. Nine behaviors, each
observed red before green, and each guard falsified once by breaking it and confirming
the expected test — and only that test — went red. The falsification ledger and command
output are in the [review](../assets/durable-jobs/review.md).

Covered: dedup while queued/running and a fresh job only after publication; a restart
failing an interrupted attempt whose late answer cannot overwrite its retry; an edit
during processing leaving the pinned revision alone while later work pins the new one;
one heavy and two frame attempts at once with a freed frame slot not releasing a heavy
one; heavy work waiting on capture while frame work proceeds; cancellation releasing its
lane only once the work settled, with the late answer publishing nothing; work outliving
a discarded take publishing nothing, not reviving it, and its queued sibling being
dropped rather than started; bounded admission that still answers already-admitted
identities and recovers capacity; and a validated absence refusing retry where an
ordinary failure accepts one.

This is queue proof only. No transcription, frame decode, export or native worker took
part, no media was read, and every result published in these tests was a string the test
supplied.

## Handoff

Adapters compose this as: `submit` when an artifact is first wanted, `status` for
readiness, `retry` on an explicit request, `cancel` when the caller withdraws, and
`schedule()` after each ingested capture transition. Still open in slice 06 and its
downstream slices: the transcription (08), frame (09) and export (14) executors, export
jobs that wait on their evidence dependencies without holding a lane, `ARTIFACT_CHANGED`
pagination against a pinned generation, deletion that stops work before removing media,
and the service/CLI/MCP operations that expose any of this. None may introduce a second
catalog or a background poller.
