**Verdict: not clean — two confirmed P2 findings remain.**

1. **Source transcript reads can settle with a different attempt’s output.** [wait.ts:197](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:197) validates completed generation only for `index.get`. Source transcript getters also omit `jobId` and return an attempt-based generation ([project-service.ts:1088](/Users/server/dev/yap-exact-removal/apps/service/src/project-service.ts:1088), [transcript-processing.ts:300](/Users/server/dev/yap-exact-removal/packages/core/src/transcript-processing.ts:300)). Controlled probes for `transcript.get` and `transcript.search` returned `wait.state: settled` with `wait.job.attemptId: attempt-A` but `data.generation: attempt-B`. Extend the completed-attempt check to these source transcript replies.

2. **Pending `export.status --wait` loses the export contract.** The getter map includes `export.create`, but omits `export.status` ([wait.ts:52](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:52)). Once its job becomes ready, the fallback substitutes the generic job reply ([wait.ts:319](/Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:319)), dropping the export’s ID, destination, receipt and output path ([exports.ts:777](/Users/server/dev/yap-exact-removal/apps/service/src/exports.ts:777)). A controlled probe confirmed settlement after only `job.get`. Map `export.status` to its own getter and retain the domain response.

All six prior findings are resolved in the inspected source. No additional correctness issue was found in atomic delivery or the `audio.measure` lease boundary.

Evidence limits: source inspection and read-only in-memory probes against the existing built observer; the retained logs report 108 focused tests passing. I did not rerun Vitest or perform native/render/media-quality certification. No files were edited.

`yap-slice04-final-consumer-review`