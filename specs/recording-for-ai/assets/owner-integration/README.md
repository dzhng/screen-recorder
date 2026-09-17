# Integrated package and export owners

At `2fa1b5d`, the root build passed all eight tasks. The fresh bundled native worker
passed 121 combined archive, retained inspection, workspace/recovery, registry and
export/publication checks. All 315 core tests pass. All 97 service tests pass after
the test-only diagnostic synchronization correction below.

- [Native integration](native.txt)
- [Core integration](core.txt)
- [Service integration](service.txt)

This verifies the combined internal owners, including the merged catalog requirement
for both abandonment and confirmed private-byte cleanup fields. Public package
selectors, queued export startup recovery, service/public export composition and the
physical capture/speech/installed-workflow gates remain outside this checkpoint.

## Capture test synchronization

The initial service run had [two failures](service-initial-failure.txt): each exhausted
Vitest's default one-second diagnostic poll. Both passed unchanged in isolation. A
controlled 1.2-second recovery worker reproduced the same [false failure](diagnostic-red.txt),
even though background recovery is allowed to outlast service readiness.

The fixture now waits for the diagnostic stream event within its existing five-second
fixture budget. The delayed worker remains in the regression; every recording,
revision and failure-outcome assertion remains unchanged. [Focused cases pass](diagnostic-green.txt),
then the entire service suite passes. No production recovery behavior or production
deadline changed. This identifies the test's unintended one-second assumption, not
the exact host delay behind the initial intermittent failures.

Independent Codex review found no actionable defect in the test change. Its runtime
attempt hit sandbox Unix-socket EPERM; the host results above supply runtime evidence.
Touched-file lint and service types pass. Shape review replaced polling with the
existing diagnostic stream; it added no production state or retry mechanism.
