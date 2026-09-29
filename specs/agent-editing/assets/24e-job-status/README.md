# Public job recipe identity evidence

The first full two-hour attempt completed public 10,000-occurrence setup in 2.367s,
then `job.get` refused a response containing the 15,944,124-byte internal execution
recipe. Shutdown left a retryable interrupted job. The original failure and recipe
remain retained; this is not a successful preparation measurement.

The existing project-service job response now returns `inputSha256` instead of raw
`input`. Target, attempt, state, diagnostics and publication remain unchanged.
Asset/acquisition admission and get/retry/cancel already use that one closure;
recording/package service currently refuses those operations pending cutover.
No queue/store identity, execution recipe, cache or frame limit changes.

The exact failed large job is readable through CLI and MCP, retries to a fresh
attempt, cancels, and replays canceled status after restart. Its failed status is
490 bytes. Observed digest calculation is 6.90ms; three MCP reads take 32.1–37.7ms,
three CLI reads 121.7–128.4ms including process startup. These are scoped observations.
The queue still loads and queries by full input, so this is compact public delivery,
not constant-work or constant-memory job inspection. General 24 query/storage
scaling remains open; no cache was added to hide this limitation.

The scene/transcript recipe-release journeys retain their stronger internal recipe
comparisons using read-only catalog diagnostics authenticated against the public
digest. Public generation/cursor/retry controls still execute. Frozen ASR output is
not new inference or listening evidence. Focused service tests pass; independent
review found no actionable issue, but its test run was blocked by sandbox Unix
socket EPERM. The unrestricted focused run and public journeys supply runtime proof.

The archive manifest pins original failure, current internal recipe, public receipts,
review and test logs, and generation comparison reports. Source media in these
existing journeys is unchanged; this pass retains metadata diagnostics rather than
duplicating their earlier media evidence. Build protocol then service/CLI; verify
`apps/service`'s `project-service.test.ts` and the existing `scene-evidence.mjs` and
`evidence.mjs` public harnesses with the frozen native worker.

[Combined-root verification](root-verification.json) confirms the integrated service/CLI checks; logs are in `root-verification.tar.gz`.
