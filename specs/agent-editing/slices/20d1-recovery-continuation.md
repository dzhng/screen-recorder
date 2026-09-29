# 20d1 — Responsive capture recovery with retained failure

Status: planned; required before 20d packed-layout rollout. Dependencies: [20c](20c-sparse-capture-materialization.md).

## Contract and owner

A take whose device has stopped can still need substantial canonical publication,
verification and cleanup. Keep that work in the existing `CaptureService` lifecycle
owner without holding its serialized control queue until media work ends. Retain one
recovery attempt with its recording identity, cancellation and outcome; do not add a
second job registry or use revision-dependent processing jobs for an unsettled take.
The existing capture finalization/publisher remains the native owner while its
recorder is alive. This is a required completion of [20d](20d-capture-publication.md),
not a smaller replacement for its publication/admission or physical-capture gates.

Service startup ownership is not proof that native capture stopped. Before authoring
service-sequenced finalizing, inspect authoritative native state and take identity.
A recorder that survived service restart continues reporting its own sequence; do
not fence its later events with a speculative service-authored outcome. Unknown
native ownership refuses recovery and retains all bytes. Native journal ownership
continues to guard mutation independently of catalog state.

## Persistent and public shape

Add nullable `finalizationError` to the existing recording lifecycle, containing the
public error concepts `code`, `message` and `retryable`. Bound retained error text as
existing job/package diagnostics do; do not persist arbitrary nested error objects.
Keep `interruptionReason` exclusively about terminal interruption. Failed or canceled
recovery leaves finalizing with its actionable error and unmodified ambiguous source
bytes. Preserve that error through service restart and expose it through ordinary
`recording.get` and capture status. Clear it only when a new attempt actually starts
or a terminal result wins. A repeated read or an acknowledged request is not a new
attempt. Reuse the existing catalog format policy for the changed recording shape;
no speculative compatibility migration or parallel attempt table.

Sweep lifecycle serialization, catalog reads/writes, recording/status schemas,
operation help, UI/menu state and fixture consumers together. Do not advertise a
finished or canceled take while an owned recovery can still write.

## Operations and ordering

- Stop explicitly starts or retries recovery after native absence is proven. An
  already-running recovery returns finalizing promptly; a settled stop remains
  idempotent. Failure persists once without an automatic retry loop.
- Status stays responsive during materialization and reports the same recording
  state/error. Native device state remains native information, not a fabricated
  recovery device state.
- Cancel aborts and drains the recovery owner without deleting ambiguous media.
  A terminal result that already won remains terminal. Proven no-source cancellation
  remains distinct from unreadable or unverified source bytes.
- Explicit library deletion uses existing quiesce to drain the attempt and release
  its native lease before deletion. Capture cancel does not become library delete.
- Start/restart while recovery owns the capture lane return a typed retryable pending
  outcome. They cannot claim a replacement started or publish a false recording
  transition. Preserve request-id identity and failed-replacement semantics.
- Startup reconciliation processes its existing unsettled takes with bounded owned
  work. Do not leave a mutable take unprotected between selecting its attempt and
  committing its result, or let late completion mutate a deleted/replaced take.

The media worker gets a recovery-specific work budget covering materialization,
verification and cleanup for the requested roles. Account for both byte volume and
fragmentation; duration alone is insufficient. Reuse existing byte-budget arithmetic
where applicable, but do not treat source verification's allowance as recovery proof.
Do not widen global timeouts or hide missing continuation under a giant client wait.

## Acceptance and review surface

Prove the smallest cases through the actual owners before the scale case:

- Native still recording/finalizing after service restart: no speculative service
  finalizing sequence, no competing recovery, later native terminal event accepted.
- Absent native: finalizing acknowledgment, persisted failure, ordinary read/restart
  visibility, explicit successful retry clearing error, and terminal failure precedence.
- Cancel/retry/deletion races: no ambiguous bytes discarded, no write after quiesce,
  completed take wins, and no automatic no-progress retry.
- Actual prerecorded input through the real controller, NativeCapture, writer and
  publisher: stable finalizing acknowledgment and normal/canceled/terminal races.
  Only physical acquisition is substituted; no live cursor or capture permissions.
- Actual materialization/recovery exceeding the old 10-second control and 30-second
  worker thresholds: responsive status/cancel, interrupted process restart, exact
  retained PCM/support and public terminal availability. Use measured media work,
  not a production sleep or fabricated slow receipt. Preserve bounded cancellation.

Retain requests, state/error receipts, input/worker hashes, actual decoded/sample
proof and independent review. Keep 20d open until this continuation and its existing
admission/package/cleanup gates pass; keep physical ten-minute camera synchronization
and webcam integration in 20/21 open independently.
