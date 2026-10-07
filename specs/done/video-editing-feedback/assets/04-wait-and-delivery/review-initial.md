The wait observer rejects valid requests, loses domain replies, and mishandles batch leases and cancellation outcomes. In-memory probes reproduced several failures; spawned CLI and native tests were not rerun in the read-only environment.

Full review comments:

- [P2] Close fresh leases before restoring cached batch failures — /Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:223-226
  When one frame has a failed replacement and retained publication while another frame remains pending, each batch poll opens a fresh lease for the failed frame. This branch overwrites its data with the cached job failure without closing the incoming lease. Subsequent cleanup cannot see that token, so polling can exhaust the service's 32-lease capacity before the 30-second expiry and prevent healthy items from completing. Close the incoming item's lease before replacing it.

- [P2] Avoid adding an unsupported generation field to index.get — /Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:163-164
  A ready `index.get` response contains a string generation, so these lines add `generation` to the follow-up parameters. However, `index.get` rejects that top-level field; generation pinning belongs in its cursor. Consequently, even an already-ready index requested with `--wait` immediately returns `wait.state: interrupted` and `INVALID_RESPONSE`. Only add generation where the getter's schema accepts it.

- [P2] Select transcript.search when retrying a phrase query — /Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:41-45
  For a supported project `transcript.retry` request containing `text`, this mapping always selects `transcript.get` while preserving `text` in the parameters. The strict getter schema rejects that field, so waiting immediately interrupts after the retry has already been admitted. Select `transcript.search` for phrase-query retries and preserve the original search selection.

- [P2] Follow advertised getters for exports and capture finalization — /Users/server/dev/yap-exact-removal/apps/cli/src/wait.ts:50-54
  The getter map omits `export.status` and `recording.get`. Thus a pending `export.create --wait` substitutes a generic job summary and exits successfully without the export reply's `exportId`, receipt or output path; a finalizing `capture.stop --wait` instead immediately interrupts because it has no job ID. Add operation-specific getter and selector mappings so waiting reaches the requested domain outcome rather than changing its contract, as required by [AGENTS.md:56](../../../../../AGENTS.md).

- [P2] Propagate batch delivery cancellation into wait metadata — /Users/server/dev/yap-exact-removal/apps/cli/src/main.ts:312-316
  If the deadline expires during delivery of a settled `frame.batch` or `index.frames` result, `consumeBatch` converts the aborted artifact reads into per-item failures while retaining the incoming `wait.state: settled`. The CLI consequently exits 1 instead of the documented timeout exit 2 and falsely reports settled observation; SIGINT is similarly not reported as interrupted. Reclassify the wait outcome after batch consumption while preserving completed items and partial failures.