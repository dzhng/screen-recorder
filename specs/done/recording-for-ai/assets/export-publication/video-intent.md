# Durable video intent evidence

The generated harness uses actual native source evidence, PreviewInspection,
cache publication and MP4 rendering. It records independent cache bytes before
export admission and compares the exported bytes against those bytes, as well as
checking the native receipt and decoded duration. Concurrent edits do not move the
pinned revision or history bound.

Actual SIGKILL receipts cover external commit before the catalog records it,
catalog commit before private acknowledgement, and empty-directory allocation before
its identity is registered. The child remains alive on IPC and its terminal signal
is asserted; an unresolved Promise alone is not treated as proof of process death.

Cancellation after external commit leaves a committed intent even though JobQueue
rejects the late artifact. Deletion while preparation is held cannot finish before
the exporter and its cache descriptor drain. Successful actual recording deletion
removes private staging and metadata while preserving the external file. A lost
native retirement response leaves the deletion marker and resumes safely when the
owned staging directory is already gone. Nonempty substituted storage is preserved
and deletion remains pending.

Explicit canceled-job retry retains the original revision across cache eviction and
preview regeneration. It does not wait inside a worker lane: missing readiness is
an actionable failure in this internal checkpoint. The future waiting-admission
contract is owned by 14d2b. Ordinary committed status is historical, has no native
hash operation, and does not monitor the user-owned output. Known-commit retry never
recreates a removed export or replaces the user's replacement.

Two negative controls prove the consequential guards: inserting an ordinary abort
check before cataloging the already-committed file changes the late-cancel result
from committed to canceled; removing managed-directory exclusion accepts an export
inside the recording source directory. Both mutations fail their expected assertions
and are restored before final verification.

No user screen, microphone or destination was accessed. This is generated empty-
pointer/no-narration media for lifetime verification, not physical capture, pointer
selection, speech audition, ZIP completeness or installed public export acceptance.
The owning slice records remaining queue-admitted recovery and storage accounting.

Independent Codex review found a missing crash window in prepared-receipt writing.
A real worker syscall interposer now writes one receipt byte and exits abruptly:
the old direct-to-canonical writer fails the regression, while the atomic pending-
name publication keeps retry and recording deletion recoverable. A second abrupt
exit after canonical linking but before pending unlink preserves the exact prepared
payload inode through retry. This proves process interruption handling, not sudden
power loss. Review findings are resolved; fixture and source hashes remain generated
and no new public operation is claimed.

Own closeout also found that one unsafe staging entry stopped cleanup of later
independent intents. Its red-to-green test now proves those later entries retire
while the first failure and recording deletion marker remain visible. Focused
[process/native results](video-intent-tests.txt), [cache/deletion/worker results](video-intent-neighbors.txt)
and [managed-directory results](video-intent-managed.txt) retain their actual terminal
outcomes. The interrupted-receipt [red result](video-intent-receipt-red.txt) and
[restored results](video-intent-receipt-tests.txt) document the review correction.

Final independent review found that external-file readability unnecessarily gated
private cleanup. A generated destination with mode 000 reproduced the obstruction;
recording deletion now retires only its identity-validated private staging without
classifying the external output. Its inode, permissions, size and bytes remain
unchanged, and the recording/intent metadata disappears. Unsafe private staging
still blocks deletion. The reviewer's filesystem-only tests passed; its generated
preview fixture did not reach ready inside its sandbox, so the host integration
runs above supply that part of the evidence.

The unreadable-output [red result](video-intent-unreadable-red.txt) and
[restored result](video-intent-unreadable-tests.txt) retain the actual mode-000
regression receipts.


## Root integration

Main 45b5c23 rebuilt all eight workspace build tasks. The freshly bundled release
worker passed all 32 native/service publication and video-intent tests in 8.34 seconds;
30 cache/deletion/worker neighbors passed in 3.11 seconds. The merged native router
retains both the new package-workspace and external-directory operations. Receipts:
[native/process checks](video-intent-merged-tests.txt),
[shared-owner checks](video-intent-merged-neighbors.txt).
