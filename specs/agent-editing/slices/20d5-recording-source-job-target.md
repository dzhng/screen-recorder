# 20d5 — Source-owned recording jobs without a revision

Status: verified; final independent review has no actionable findings. Dependencies: [20d1](20d1-recovery-continuation.md).

A settled recording can retain audio and publication working files even when no
usable video survived and no r0 exists. Existing JobQueue ownership must express
that work without fabricating a revision or creating a maintenance registry.

Recording job targets accept explicit revisionId:null for source-owned work.
Omitting revisionId still pins the current revision; project targets still require
a string revision. The existing recording owner and deletion drain remain shared.
The existing nonrevision storage sentinel remains internal; public jobs/results
expose null, never an empty string. Catalog18 refuses older persisted interpretation
rather than migrating it. Normal frame/audio/preview/index execution rejects null;
source/scenes/transcript retain their r0 requirement.

Verify no-r0 and zero-duration recordings, default revision pinning, queue/artifact
serialization across reopen, retry/cancel fencing and recording deletion drain.
The full recording service exposes existing job.get/retry/cancel through its required
JobQueue context. This activates existing continuation operations, not a new job API.
Cancellation uses the existing owner drain and its operation-specific drain wait;
get/retry remain short acknowledgments. No global deadline changes.

Zero surviving native video remains represented as null duration/no-r0; it does not
create a zero-length revision. This prerequisite adds no cleanup operation or native mutation. The next vertical
must still prove safe publication cleanup, retained consumer identity, cancellation,
restart and no-r0 reach before parent20d can close.

Evidence and next vertical identity constraints: [source job target](../assets/20d5-source-job-target/README.md).

[Integrated verification](../assets/20d5-source-job-target/root-verification.json)
confirms the target/control prerequisite on the combined root build.
