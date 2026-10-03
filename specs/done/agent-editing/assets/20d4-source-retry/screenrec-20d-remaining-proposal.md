# Remaining 20d: concrete next seams

Baseline: clean branch `codex/capture-settled-repair` from main20e71bc1. Read-only audit; no schema or production changes. Catalog16 is current;17 remains reserved by the job lane.

## Findings from actual owners

1. **A lost retry is real.** `SourceEvidenceExport.write` calls `CaptureJournal.layout` and `readPublished` under the journal lease. Their explicit JOURNAL_UNAVAILABLE/MEDIA_UNAVAILABLE errors fall through Wire's generic CaptureFailure translation, which sets retryable false. `JobQueue.retry` refuses failed nonretryable jobs. Restoring file access therefore does not make the existing failed source-evidence job retryable. Separately, the exporter's initial `stat` maps every failure to INVALID_JOURNAL, so fixing Wire alone misses directory-access IO. Service `sourceExporter` can also fail during its own lstat/open before native; that path needs the same actual permission gate, not assumed native coverage.

2. **Settled cleanup has no replay route.** Native stop and MediaRecovery attempt `CaptureAudioPublication.cleanup`; it deliberately preserves verified canonical availability if deletion fails. `CaptureService.stop` returns settled recordings unchanged. Startup reconciliation visits unsettled captures only. Source evidence calls **readPublished, not publish or cleanup**. `SourceProcessing.retry` routes to JobQueue.retry, which returns a ready job unchanged. Thus neither normal reads nor processing.retry reclaim a packed duplicate after a successful evidence generation. Current explicit library deletion removes the whole take and is not a cleanup substitute.

3. **The explanatory message is lost during projection.** Raw finished CaptureResult stores failure.code/message, but `JournalFinished.Failure` decodes only code and JournalCompletion exposes only failureCode. SourceEvidenceReceipt carries that reduced completion through stored evidence/package metadata; `CaptureSourceRead` emits interruption observations with code only. The existing normalized completion owner is the smallest disclosure route, not a new recording lifecycle error or raw-file endpoint.

## Recommended order

### A. Source-admission operational retry (smallest next implementation)

At the actual source-export operation boundary preserve NativeFailure unchanged; translate only explicit operational codes and the existing positive NSError access/IO classifier to retryable. Keep invalid journal, malformed/corrupt canonical media, changed identities and publication conflicts final. Split the initial stat failure into missing/not-regular versus operational access/IO; trace service-side descriptor opening and preserve that classification through JobQueue. Do not use finalization's unknown-error=>retryable default.

Acceptance: actual settled recording source job fails under chmod, public status says retryable, restore access then processing.retry/job.retry succeeds and emits the same source/canonical identities. Repeat for journal and canonical input where each reaches its actual owner. Actual corruption and identity-conflict negatives remain final. Admission/import source stays immutable. A bounded native gate plus real public job gate is sufficient; no timing variants or live capture.

This requires no new persistent fields or catalog bump. It directly repairs a user-visible dead end and should land first.

### B. Explicit settled publication cleanup, without reopening capture

Keep CaptureAudioPublication.cleanup as the only deletion/proof owner, its A=C=R/clean-indexed-EOF/identity verification unchanged. Add one explicit maintenance request for a named settled recording, executed by the **existing JobQueue**, with normal job.get/retry/cancel and existing recording deletion drain/lifetime ownership. Do not reuse source-evidence job identity: a ready evidence generation must remain ready and unchanged when cleanup fails. No startup history scan, periodic retries, catalog cleanup-status column or second registry. The source directory's existing receipt/intent/packed members are the durable work authority; job result is a bounded outcome/retained-reason receipt.

Important existing boundary: recording JobTargets currently always pins a revision, and recordings with no usable video deliberately have no r0. A cleanup artifact blindly targeted at r0 would strand audio-only/interrupted retained media. Before implementation, the smallest needed JobQueue target amendment is an explicitly **recording-owned, non-revision maintenance target**, still using existing recording identity/deletion checks. It must not manufacture a revision or broaden normal rendering/index targets. This is a type/serialization-owner change to coordinate with the job lane; it is not approved by this audit. If deferred, the slice must remain partial for no-r0 recordings rather than silently narrowing support.

Native operation only reads published receipts, verifies canonical media, and invokes cleanup. It must not republish absent/conflicting canonical media or append lifecycle/completion records. Lease + caller recording lifetime inherited by worker protect concurrent source reads/deletion. Async JobQueue avoids old control deadlines; use the measured publication/verification work budget rather than a global timeout. An explicit attempt returns retained/unavailable for no proof or ambiguous tails, success only when eligible owned working members are gone; cleanup failure remains retryable while canonical availability remains ready.

Acceptance: a real permission-blocked cleanup leaves packed bytes and canonical PCM usable; restore permission, explicit maintenance job removes only matching packed/attempt members. Crash/cancel/restart resumes via ordinary job retry and existing intent; changed identity refuses deletion. Ready source evidence generation/hash and recording state/sequence remain unchanged. Test no-r0 recording, A>C/A<C retention, concurrent read/lease and library deletion drain. One named recording is visited; no full-history loop.

### C. Terminal diagnostic provenance disclosure

Extend normalized JournalCompletion with optional bounded failureMessage decoded from the existing raw finished failure, retaining source sequence/code. Carry it through SourceEvidenceReceipt validation, existing stored generation/package inventory and public interruption observations. No new finalizationError usage, no lifecycle transition, no invented current diagnosis. Bump source-evidence policy identity for newly requested generations if necessary; do not mutate pinned prior generations. Existing ready generation regeneration semantics must be reviewed explicitly rather than assuming processing.retry replaces ready work.

Acceptance: fresh public capture/import reaches an interrupted marker with exact source completion code/message; pinned generation, project occurrence and package relocation preserve it. Damaged/untrusted/conflicting completion remains unavailable. If recording.get needs direct detail independent of timed support, that remains a separate explicit contract decision; do not claim timed event coverage solves zero-duration/no-r0 diagnostics.

## Scope retained

These seams do not close physical20/21 camera synchronization or change source clocks/support. They do not turn cleanup failure into unavailable canonical media. Parent20d remains open until no-r0 cleanup, terminal detail reach and source retry are resolved; no change to catalog17 is made here.
