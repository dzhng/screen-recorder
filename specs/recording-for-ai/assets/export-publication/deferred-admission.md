# Deferred admission verification

The queue tests use real SQLite catalogs and controlled executor promises. They
observe persisted identities, actual worker starts, published results and deletion
fences. They do not render media or claim public export integration.

The full check ran 321 core/deletion tests across 26 files successfully. Core build,
core/service type checks and touched-file lint passed. The added tests prove waiting
exports leave room for their shared prerequisite; package work shares runnable
capacity and FIFO; capture pauses heavy work while admitted frames progress; and
canceled/failed/deleted waiting jobs cannot implicitly restart. Restart preserves
waiting identity and defers callback use until explicit owner installation.

A negative control removed the guard that skips admission on replayed submissions.
The bounded-work assertion failed because repeated inspection re-evaluated waiting
jobs. Restoring the guard passes. This is actual event-work measurement, not timing
inference. Independent Codex review then found regeneration could strand deferred
work until an unrelated event. Its dedicated regression failed with waiting instead
of running, and passed after regeneration gained the same changed-only admission
wake as retry. The reviewer also ran the then-current 42 queue tests successfully.

- [Full test receipt](deferred-tests.txt)
- [Replay-work negative control](deferred-mutation.txt)
- [Regeneration regression before correction](deferred-regeneration-red.txt)
- [Regeneration regression after correction](deferred-regeneration-green.txt)

The type-only closeout narrows transient package job states: this pass gives durable
library jobs dependency waiting, not transient package jobs. Source-generation
retention, export consumers, native startup recovery and public routes are still
owned by subsequent passes.

## Merged-tree integration

At `eca8ec6`, the root workspace rebuilt all eight build tasks, then passed all
97 service tests across ten files (86.19 seconds). Workspace imports resolve built
core output, so the earlier service run before rebuilding is not counted as
integration evidence for this change. The focused root jobs/library checks also
passed 66 tests. [Rebuilt service receipt](deferred-merged-service.txt).
