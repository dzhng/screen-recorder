# 20d6 — Explicit settled recording cleanup

Status: verified scoped cleanup checkpoint; [evidence](../assets/20d6-settled-cleanup/README.md).
Dependencies: [20d5](20d5-recording-source-job-target.md), [20d](20d-capture-publication.md).

An agent can explicitly reclaim verified publication working files from one settled
recording, including a recording with no video revision. The operation must not
rerun finalization, replace canonical media, append lifecycle events, or change
ready source evidence. Original imports and unverified working bytes remain intact.

## Existing owners

`recording.cleanup {recordingId}` submits source-owned work to the existing JobQueue,
with explicit null revision and immutable source identity. Existing job inspect,
retry, cancel and recording deletion draining own continuation. The service holds
and inherits the existing recording-directory lifetime into the worker. No startup
scan, timer, registry or cleanup-status column is added.

Native work acquires the existing exclusive journal lease and visits only the two
fixed recording audio roles. CaptureAudioPublication remains the sole proof and
unlink owner. It checks the published receipt against the expected source, journal
prefix and canonical bytes before cleanup. Removal still requires equal accepted,
committed and represented counts, clean physical EOF and no unresolved diagnosis.
No receipt or insufficient proof means retained bytes, not fabricated success.

Each role reports removed, already clear, or retained with a bounded reason. A
role-specific failure must not prevent inspection of an independent healthy role;
report failure after that pass. Cancellation and lost journal ownership stop the
whole pass. Temporary filesystem failures and ownership contention are retryable;
identity conflicts and malformed proof are final. Error translation must retain
actual error categories, not classify every PUBLICATION_FAILED as temporary.

The cleanup owner returns explicit outcomes and preserves filesystem error identity.
Changed proof and malformed publication paths report final conflicts. Never infer
complete reclamation from job readiness: inspect the role outcomes.

## Verification

Use prerecorded publication fixtures. Block deletion with real permissions while
canonical audio stays usable; restore permission and explicitly retry the same job.
Prove only verified owned working members disappear. Include no-r0/zero-surviving-
video recordings, count mismatch retention, changed receipt/media refusal,
independent role progress, cancel/restart, concurrent source access and deletion.
Recording state/sequence, canonical byte hashes and ready source generation stay
unchanged. In-flight admitted descriptors retain their ctime refusal; cleanup does
not relax immutable admission. Physical capture and installed-app cutover remain
separate gates.
