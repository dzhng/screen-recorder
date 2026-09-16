# Durable artifact jobs — verification evidence

The core queue uses real temporary SQLite catalogs and held asynchronous executors.
No media, speech model or native worker is executed in these tests.

## Integration correction

The initial delegated candidate deduplicated only queued/running work and did not
include revision in its unique identity. Two focused regressions reproduced:

- Resubmitting a failed request started a new attempt without explicit retry.
- Submitting the same parameters after an edit reused the old running revision.

Both failed before correction and now pass. Work and published results are keyed
by recording/revision/artifact/input. An existing completed or failed identity is
returned unchanged. Explicit retries reserve a fresh generation before execution;
late results cannot move it. Status requires the pinned identity.

Additional checks cover results completing out of order across revisions and
parameters, historical requests, permanent processing failures distinct from absent
evidence, shutdown rejecting late success, retrying canceled work only after its old
executor releases capacity, and an executor submitting more work without bypassing
lane limits. Older tests that asserted synchronous executor invocation now await
acknowledged starts; actual concurrency limits are unchanged.

## Current checks

- Core: 46 tests pass, including 17 queue behaviors.
- Core typecheck and focused lint pass.
- A separate service worker pass already verifies cancellation and promise settlement
  after native child closure; composing that runner with this queue is still open.
- The original candidate's 38-core/44-service/3-CLI results predate these corrections;
  they are not presented as integrated checks.

No real-process queue restart, service operations, generation-bound pagination,
recording deletion or media executor integration is claimed. Reopen tests use two
catalog handles to deliver an old executor's late answer; the production service
still must enforce a single writer and one queue. Independent Codex review found no actionable regression and ran all 16 then-current
queue tests plus the core typecheck. The additional unsupported-format regression
also passes. Final integrated checks remain to be run.
