**Verdict: not clean — one confirmed P2 finding remains.**

**`export.recover --wait` observes the original publication job instead of the recovery work.** The producer queues recovery separately and returns `export.status` ([exports.ts:1085](/Users/server/dev/yap-exact-removal/apps/service/src/exports.ts:1085)); that response exposes recovery under `data.recovery` while top-level `jobId` remains the original job ([exports.ts:774](/Users/server/dev/yap-exact-removal/apps/service/src/exports.ts:774)). The observer selects that original ID ([wait.ts:239](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:239)) and substitutes its failed job response ([wait.ts:310](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:310)).

A read-only probe confirmed immediate `wait.state: settled` after only `job.get(publication-job)`, despite queued recovery. The result dropped export identity, destination and receipt. The new regression misses this because it supplies a single queued top-level job ([wait.test.ts:1111](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.test.ts:1111)). Observe recovery through `export.status`, preserve the domain response, and cover the producer’s actual recovery shape.

No remaining issue was found in the completed-page generation validation or package-admission branch; focused probes confirmed matching/mismatched generations and package readiness, changed admission, and original `NOT_FOUND` error preservation.

Evidence limits: source inspection and in-memory probes against the existing built observer. Retained logs report 124 passing tests and successful scoped checks; I did not rerun Vitest, edit files, or certify native ZIP, inference, rendering or media quality.

`yap-slice04-admission-confirmation`