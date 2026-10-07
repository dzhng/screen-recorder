The five prior findings are resolved in the current diff:

- Fresh failed batch leases are closed before cached failures replace them ([wait.ts:233-237](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:233)).
- `index.get` no longer receives an unsupported top-level `generation`; only `index.frames` does ([wait.ts:163-174](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:163)).
- Phrase retries select `transcript.search` ([wait.ts:163-165](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:163)).
- `export.create` and `capture.stop` use `export.status` and `recording.get` ([wait.ts:54-55](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:54)).
- Batch cancellation reclassifies settled delivery to `timed_out` or `interrupted` ([main.ts:335-356](/Users/server/dev/yap-exact-removal/apps/cli/src/main.ts:335)).

Focused regression tests cover each fix ([wait.test.ts:691-854](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.test.ts:691)); the retained focused log reports 104 passing tests.

One remaining P2 correctness issue exists: generation pinning is lost when a ready getter omits `jobId`.

- `wait.ts:update` validates selection fields but never validates `generation` ([wait.ts:191-200](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:191)).
- After polling the ready job, it clears `current` when the getter response has no `jobId` ([wait.ts:313-318](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:313)).
- `index.get`’s ready response does exactly that while returning a generation ([index-read.ts:83-96](/Users/server/dev/yap-exact-removal/packages/core/src/index-read.ts:83)).
- The index producer defines that generation as the job’s `attemptId` ([index-processing.ts:292-295](/Users/server/dev/yap-exact-removal/packages/core/src/index-processing.ts:292)).
- The protocol correctly forbids top-level generation for `index.get`; it belongs in a cursor ([operations.ts:549-563](/Users/server/dev/yap-exact-removal/packages/protocol/src/operations.ts:549)).

A direct probe returned `wait.state: "settled"` for inspected attempt `attempt-A` while the getter returned generation `attempt-B`. A concurrent retry can therefore make `--wait` accept a newer index generation.

The current Vitest rerun could not start because the environment denied creation of Vitest’s temporary `ssr` directory (`EPERM`). No fresh native macOS or installed public CLI check was run; those claims remain limited to the retained logs and source inspection.