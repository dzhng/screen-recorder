# 06g — Durable artifact jobs

Status: core implementation verified and integrated. This does not close 06 or
provide a media/transcription/export executor. Depends on 06a/06d. Evidence:
[durable jobs review](../assets/durable-jobs/review.md).

## Ownership and identity

`JobQueue` owns jobs/artifact publication in the same catalog connection and
transaction boundary as `RevisionStore`. The app-managed service must own one
queue, provide its executor, and close the queue before closing the catalog.
There is no second database or daemon.

A work identity contains recording, resolved revision, artifact kind and canonical
input. Omitted revision resolves once at admission; historical requests retain
the explicit revision. Status reads carry that exact identity. Different revisions
or options cannot overwrite each other's artifacts, regardless of completion order.

An identity gets one automatic attempt. Submitting it again returns its outcome,
including ready, failed or canceled. Explicit retry creates a fresh attempt ID and
reserves the next generation before execution. Only that attempt can publish. A
missing recording or discarded take cannot receive a late result. Published results
remain attached to their captured identity; they are not a mutable current-revision
pointer. Source-only processing (such as original narration recognition) pins the
original revision; edited transcript reads project that result without retranscribing.

## Scheduling and failure

One heavy and two frame workers may run concurrently. At most 32 additional jobs
wait; overload reports retryable `LIMIT_EXCEEDED`. Already-admitted identities still
resolve at capacity. The executor starts after its capacity is reserved, including
when the executor itself requests other work.

Any unsettled capture pauses new heavy work. Frames for finalized recordings may
proceed while another take records. The owner calls `schedule()` after capture
transitions; job admission and settlement trigger the other scheduling opportunities.
There is no polling or automatic retry.

Cancel requests abort immediately, but occupied capacity remains until the executor
settles. Explicit retry can restart canceled work; repeated submission cannot. Queue
shutdown marks its running attempts interrupted/retryable before requesting abort,
so an executor ignoring abort cannot publish a successful shutdown result. The native
runner must honor the signal and settle only after its child exits. Queued work stays
durable; opening after a crash makes orphaned running work failed/retryable.

Only an explicit `UNAVAILABLE` error represents absent evidence. Other permanent
errors remain failed/non-retryable; ordinary executor errors are retryable failures.
Unsupported development job formats are refused without migration.

## Verification and remaining integration

Real SQLite catalogs and held executors exercise identity/reopen, late results,
revision changes, historical reads, explicit retries, shutdown, reentrant scheduling,
capture priority, admission limits and capacity retained through cancellation.
No media or model is executed in these core tests.

Still open: service/CLI/MCP bindings, native executors, source-evidence ingestion,
derivative eviction, generation-bound pagination, recording deletion and export
jobs waiting on dependencies without occupying an execution slot. Input strings
and artifact results are internal adapter values; external schemas and media byte
limits stay with their owning operations.
