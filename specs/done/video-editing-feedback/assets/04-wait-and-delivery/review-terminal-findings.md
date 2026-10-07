**Verdict: not clean — one confirmed P2 finding.**

- **Nested recovery failure still replaces the export response with a generic job response.** `workStatus` now selects `data.recovery` correctly ([wait.ts:184](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:184)), matching the producer’s nested status shape ([exports.ts:774](/Users/server/dev/yap-exact-removal/apps/service/src/exports.ts:774)). However, when that recovery job is unsuccessful, [wait.ts:315](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:315) assigns `latest = inspected` ([wait.ts:317](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:317)). `metadata()` then returns the raw `job.get` payload, dropping `exportId`, destination, receipt, output, and the producer’s top-level export state.

  A direct probe with recovery `queued → ready → failed` reproduced a settled result whose `data` was only the recovery job summary. The public regression covers only the successful `queued → ready` path ([wait.test.ts:1146](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.test.ts:1146)); it does not cover failed or canceled recovery.

The successful recovery selection and producer-shaped test path are otherwise consistent. I did not re-review the previously accepted generation, package, atomic, or measurement paths.

Evidence limits: source inspection and a read-only probe against the existing built observer; no files changed, no Vitest rerun, and no native/media-quality certification. Retained evidence reports 127 focused tests and successful scoped build/types/lint/format checks.

`yap-slice04-recovery-work-confirmation`