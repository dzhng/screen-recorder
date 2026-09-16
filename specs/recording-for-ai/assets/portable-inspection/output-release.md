# Reusable package output lifetime

The actual retained ZIP harness uses one open context for more than 32 successful
native frame requests and failed decodes. Every confirmed disposal returns its
output count/bytes to zero and removes the UUID output leaf. A held read continues
reading valid PNG bytes after retirement, while new reads fail. WAVE output release
is exercised after the unchanged full audio-inspection byte comparison.

Concurrent media and output releases share one native-call lifetime. Automatic
failed-write disposal and explicit release join one per-output promise. Closing
with a held retired read revokes it and drains cleanup without a cycle. A replaced
output symlink causes real native removal failure: its charge stays held and the
external sentinel remains unchanged. A failed creation with no admitted identity
keeps its reservation until full close; this pass does not claim all failures are
individually recoverable.

[Machine receipt](output-release.json) records the native binary/source hashes and
bounded progress results. Removing native serialization produces four simultaneous
worker calls; removing read draining enters cleanup with a held file; returning
credit before removal fails the unchanged-charge assertion. All three mutations
were restored. The automatic/explicit cleanup race also reproduced an ENOENT error
before both paths shared their retirement promise. Final independent review found
no actionable regressions; it reran the focused file-lifetime tests. The native
evidence above comes from the separate pinned-binary runs.

306 core tests, 97 service tests, type checks and 38 actual archive regressions pass.
The delivery-owner child independently passed its review and tests. Root integrated
that seam as 7402fd3: 25 focused tests, an eight-check bundle build, and actual
CLI/MCP preview inspection/deletion revocation (2.44 seconds) passed. Root owns those
integration receipts; no separate public package route is claimed here.

Registry storage admission, admitted archive input handles, copied ZIP accounting
and retryable full-context recovery remain 14c3b2. This pass reports output sizes
last confirmed through admitted descriptors; it is not a complete package disk scan.


## Merged host verification

Main 86104dd rebuilt all eight workspace build tasks and passed the actual retained
ZIP matrix against the newly bundled release worker in 17.33 seconds. The command
explicitly sets SCREENREC_NATIVE to dist/ScreenRecorder.app/Contents/MacOS/screenrec-native;
the initial invocation accidentally selected an older default debug worker and
failed on the new removal operation. No assertion or product behavior changed;
the rerun corrected the tested binary. [Retained ZIP receipt](output-release-merged-tests.txt),
[delivery/deletion/operation receipt](delivery-owner-merged-tests.txt), and
[bundled public preview receipt](delivery-owner-public-tests.txt) retain the scoped results.
