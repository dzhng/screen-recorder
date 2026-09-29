# Canonical publication owns availability; cleanup is optional

The per-role publication owner retains one immutable intent and prepared receipt.
Exact journal-prefix, payload and canonical identities bind the attempt; PCM and
support digests come from the shared materializer verifier. Receipts contain bounded
metadata with decimal-string exact integers, never another sample-placement array.

Publication synchronizes each prerequisite before persisting proof that depends on
it: packed bytes and journal plus their directory entries precede intent; verified
candidate bytes and its directory entry precede prepared receipt; canonical link
precedes final receipt link. Existing NewFile publication refuses replacement and
allows a retry only for the same inode. The journal lease survives across this work.
These are filesystem synchronization/order checks, not tested hardware power-loss
survival.

Cleanup re-verifies actual canonical PCM/support and the packed input before
reclamation. It requires clean decoding of all platform-indexed PCM, no unresolved
diagnostic and A=C=R. Both known accepted/physical disagreements retain working media.
This supersedes the earlier provisional R=C<=A proposal; the root choices ledger
records the correction. There is no forensic claim about arbitrary unindexed mdat
bytes. Candidate/prepared cleanup checks their published hardlink identities, removes
intent last and can resume at an empty remaining attempt directory. An unknown entry
refuses cleanup while verified canonical availability remains intact.

The capture test executable owns the reproducible checks. Restart cases reconstruct
exact filesystem boundaries from verified publications: incomplete private candidate,
prepared candidate and canonical link without final receipt. They also cover repeated
verification, different occupied output, changed journal/canonical bytes, post-payload
verification, both tail-disagreement retention cases, optional cleanup failure/retry,
and canceled shared journal reads. These are actual native PCM/container checks and
filesystem operations, not process-kill or power-cut experiments.

Run from the repository root with a fresh output directory:

```sh
swift build --package-path helpers/mac --product ScreenRecorderCaptureTests
SCREENREC_PUBLICATION_OUTPUT=/tmp/capture-publication-check helpers/mac/.build/debug/ScreenRecorderCaptureTests
helpers/mac/.build/debug/ScreenRecorderCaptureTests
```

This is an offline publisher checkpoint. Ordinary capture still writes schema1.
Cached closed-writer continuation, schema2 callback/layout activation, canonical-only
source export/admission, package closure and live capture remain unwired. They remain
20d requirements; this evidence does not close the slice.

Independent review found two prerequisite-order defects in the initial draft: candidate
bytes must be synchronized before the prepared receipt, and the journal must be
synchronized before mapping-dependent reclamation. Root review also required the
candidate directory entry to precede the prepared proof. The corrected ordering also
synchronizes packed bytes/journal entries before intent. Follow-up independent review
found no actionable defect. Both reports are retained.

Rollout must test actual public operations beyond the current capture.stop 10-second
and media.recover 30-second deadlines, plus cancellation and restart. Owner-only
completion does not establish supported public completion. Use the existing
finalizing/attempt state and operation-specific work deadline; do not widen a global
timeout or repeatedly restart work that cannot finish inside its deadline.

The final matching run uses integrated materializer414eaa62; verification.json records
worker identity and exact commands. run.tar.gz retains raw publication fixtures and
hardlink relationships, with raw file hashes in run-hashes.json. The separate journal
failure archive retains actual EFBIG input/media/receipts. Native default tests pass;
11 service lifecycle checks include the new finalizing-acknowledgment queue test and
existing terminal-cancel preservation. That queue fixture proves only the service
half of the future lifecycle change.
