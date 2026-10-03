# Named settled-recording cleanup: target and lifetime proposal

Read-only baseline: branch `codex/capture-cleanup-target` from current main. No source/schema edits. Scope is remaining20dB; terminal-message20dC stays independent.

## Why existing routes cannot express it

`recordingJobTargets.pin` always calls RevisionStore.revision. A settled no-video recording has sourceDurationUs=null and no r0 (`attachSource` deliberately does not manufacture one). `processing.retry` is source/scene/transcript only, source processing requires video, and JobQueue.retry returns an existing ready artifact unchanged. `capture.stop` returns settled state unchanged. None is a truthful cleanup route. Do not turn source-evidence readiness into storage-reclamation readiness.

The existing queue/storage already supports nonrevision owners: targetValues encodes their revisionId as the empty storage string. Owner identity and drainOwner use only targetKind/targetId. Thus there is no reason for a new owner kind, table, task registry or queue.

## Smallest explicit target extension

Keep JobOwner unchanged. Add exactly one nullable variant to **recording JobTarget**:

- Existing revision work: `{kind:"recording", recordingId, revisionId:string}`.
- Source-owned work: `{kind:"recording", recordingId, revisionId:null}`.

Null is the explicit discriminator. Request omission still means pin the current revision; it never means source-owned. Project revisionId stays required string. recordingJobTargets.pin on null validates existing, settled, noncanceled recording and no deletion intent, without requiring duration or a revision. On string/omission it retains the current revision lookup. isAvailable continues the current recording/deletion checks; the cleanup executor rechecks settled/source identity before mutation.

Serialization stays in existing jobs/artifacts columns: null maps to the already-used nonrevision storage `revisionId=''`; decoding only a recording row with that sentinel yields null. Project rows never interpret an empty value as a maintenance target. Job.get exposes explicit null so callers cannot mistake it for r0. This changes persisted target interpretation; increment the actual current catalog format (currently17, proposed18 if still free at implementation) rather than silently allowing an older binary to read it as a revision. No migration or new column/table.

Required consumer sweep is narrow but real: recording frame/audio/preview/index execution currently passes job.target.revisionId directly to store.revision; reject null before that call. Source/scenes/transcript already require r0 and therefore reject null. Export execution must keep matching its pinned revision identity. Project consumers keep their existing string branch; do not broaden them or touch their behavior. Cover serializer/readiness/retry/reopen with both recording variants so SQL identity cannot collide with r0/current/default requests.

## Public request and actual owner

Add `recording.cleanup {recordingId}` to the shared operation registry and full recording service dispatcher. It returns the existing compact Job identity/state; `job.get`, `job.retry`, `job.cancel` are the only continuation controls. Repeated cleanup submits the same artifact/input identity and joins queued/running or returns the completed result. An explicitly failed attempt retries through job.retry; there is no automatic loop. A new catalog cleanup-status field or startup backfill is unnecessary.

A small recording cleanup executor in the service owns the orchestration (it is filesystem/native work, not project editing): validate the named settled recording, submit artifact `capture-cleanup` with target revisionId:null and an input containing its immutable sourceId; use existing heavy lane, worker, operation-specific publication work deadline, and existing recording directory lease. It produces a bounded two-role result through the normal artifact result owner. Canonical availability, recording state/lifecycle sequence, interruptionReason and source-evidence generation are not rewritten. CLEANUP_PENDING in historic completion remains historic evidence, not mutable current diagnosis.

The native cleanup operation consumes the owned directory + expected sourceId. Under the existing CaptureJournalLease it validates the journal header identity, reads only fixed role publication proofs, and invokes existing CaptureAudioPublication.cleanup. It must not invoke publication/materialization to create a new canonical output, append completion, or repair missing proof. (The existing cleanup method may use materialize only as its full verifier of already-published canonical media.) No-receipt/no-journal cases retain bytes and report a bounded retained reason; invalid/conflicting proof refuses deletion. No fake audio format or R=0 proof.

Return each fixed role as removed/no-working-members/retained with a bounded reason. Known ambiguous tails or missing publication authority can be a completed inspection with retained bytes, not a claim that all bytes were reclaimed. Operational failures fail the job retryably after attempting independent healthy roles; cancellation and journal ownership failures are batch-wide. A permanent integrity conflict is final. Root can choose exact result labels during the concrete schema review; the semantic distinction is required.

## Leases, cancellation and restart

Acquire the existing shared recording-directory lifetime, inherit its descriptor into the worker, and hold it until the worker exits. Native takes exclusive nonblocking journal-inode ownership for its inspection/deletion transaction. This is the same source lifetime authority as publication, not a new lock. Source-evidence readers use the same journal lease, so contention must remain an actionable retry/busy result rather than an invalid-media diagnosis. This exposes a concrete related boundary: source export currently treats CAPTURE_BUSY as final; when cleanup introduces legitimate reader contention, map that named ownership refusal as retryable at the source operation owner with an actual concurrent gate, without retrying unknown failures.

JobQueue.cancel already aborts/drains an attempt and fences late publication. A cancel that loses to a settled ready result keeps it. Service restart leaves interrupted jobs explicitly retryable through the existing queue recovery; no source-history sweep. `recording.delete` already marks deletion intent, invokes jobs.drainOwner(recording), then obtains its exclusive directory authority and forgets the owner's jobs/artifacts. Keeping kind=recording means no second deletion path or predicate. Test orphan worker inheritance and deletion wait using existing lifetime fixtures rather than relying on catalog state.

## Cleanup proof remains unchanged

Deletion requires complete canonical PCM verification, pinned journal prefix/payload/canonical identities, clean indexed physical EOF, no unresolved diagnostic and A=C=R. A>C, A<C, zero/unknown/missing mappings retain uncertain inputs. Existing restart intent controls which attempt members can be removed. Cleanup only unlinks verified working payload/candidate/prepared/intent members; canonical bytes and publication proof remain. Unlinking a candidate hardlink may change canonical inode ctime/link count, so do not promise filesystem identity stability. Frozen admitted descriptors retain their normal changed-identity refusal; new readers verify bytes/proof afresh. No evidence-generation invalidation is required because canonical/journal contents do not change.

## Independently verifiable passes

1. **Target contract**: nullable source-owned recording target, serializer/catalog guard and normal execution refusal. No fake r0. Prove no-r0 and zero-duration recordings are addressable, ordinary omitted revision still pins, deletion/reopen/cancel/retry preserve owner identity. Keep project branch unchanged.
2. **Actual cleanup vertical**: explicit public named-recording job and native existing-owner cleanup. Real unwritable cleanup directory produces retryable failure with canonical reads available; restore access and job.retry reclaims only owned working members. Prove no-r0 audio-only and zero-duration cases, A!=C retention, corruption/refusal, independent role progress, cancellation/restart and concurrent source/deletion lifetimes. Same recording state/sequence, source byte hashes and ready source generation before/after. No live capture.

Touched owners: core jobs target/serializer + recording-target validators and direct recording executors; catalog version/tests; protocol operation; full service dispatch/main and new focused cleanup executor; native Wire registration + focused capture publication cleanup entry/result using the existing lease/cleanup implementation; existing native/job/deletion/public harness tests. No changes to shared project consumers, clocks, package formats or terminal-message schema are proposed.
