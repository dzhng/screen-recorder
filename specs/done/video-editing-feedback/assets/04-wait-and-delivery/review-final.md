Scoped verdict: **clean; the prior terminal recovery domain-loss finding is resolved.**

- `workStatus` selects nested export recovery status ([wait.ts:187](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:187)).
- Failed/canceled recovery now refreshes `export.status` while pending, then re-inspects the refreshed attempt; it no longer replaces `latest` with `job.get` ([wait.ts:318](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:318)).
- `waitSucceeded` rejects a committed export whenever its inspected recovery is not `ready`, including `failed` and queue-reported `not_requested` ([wait.ts:64](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:64)).
- New tests preserve receipt, destination, and output while asserting exit code 1 for both failed and canceled recovery ([wait.test.ts:1224](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.test.ts:1224)).
- The concurrent retry test changes the attempt generation and receives `INVALID_RESPONSE`, confirming refreshes remain pinned to the inspected attempt ([wait.test.ts:1288](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.test.ts:1288)).
- Service status supplies the domain fields, and queue status maps canceled jobs to `not_requested` ([exports.ts:772](/Users/server/dev/yap-exact-removal/apps/service/src/exports.ts:772), [jobs.ts:900](/Users/server/dev/yap-exact-removal/packages/core/src/jobs.ts:900)).

No files changed. Limits: source inspection only for this follow-up; I did not rerun Vitest because of the known temporary-directory denial, and make no native/media-quality claim. Retained proof reports 130 focused tests plus successful build, type, lint, and format checks.

`yap-slice04-terminal-domain-confirmation`
