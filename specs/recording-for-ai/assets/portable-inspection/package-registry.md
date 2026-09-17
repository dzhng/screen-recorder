# Internal package registry verification

[Machine receipt](package-registry.json) pins the source/native hashes and scope;
[actual native test output](package-registry-native-tests.txt) retains the 72-check
merged run (16.66 seconds). Twelve registry consumer checks compose real extraction,
workspace cleanup, the shared JobQueue and typed delivery. The same run includes
43 hostile archive checks, eight workspace and eight recovery checks, and the
unchanged native retained ZIP frame/audio/index parity matrix. Core 306 and service
97 tests, service types/build, native build and scoped lint also pass.

## Admission, accounting and continued use

Actual admitted input sizes establish the 64 GiB pool and four-owner boundaries.
The maximum-size numeric case uses a sparse 16 GiB file with the heavy lane paused;
it proves reservation/refusal/cancellation without claiming a 16 GiB extraction.
Three small opens under the default expansion ceiling fill pending capacity; after
validation reduces reservations to copied/expanded bytes, a fourth owner fits.
Cleanup-failed owners keep their slot and byte reservation through explicit retry.

Forty sequential requests reuse one handle by forgetting completed job metadata.
Failed work can retry and canceled queued work does not execute. Thirty-two terminal
admission receipts remain bounded and older IDs expire without creating authority.
Independent opens of identical content have distinct handles and lifetimes.

Real RecordingDeletion removes a same-provenance library recording while both
package deliveries remain readable. Closing one package expires only its delivery;
the sibling still reads. Correctly hashed malformed source rows pass archive,
manifest/history and inventory verification, then fail with INVALID_EVIDENCE through
the existing shared reader. Admission does not claim eager row-semantic validation.

## Cancellation, close and restart

A fixture-only first/partial-read interposer pauses the actual extraction worker.
The registry cancellation check observes partial copied bytes and no published
handle, then verifies actual worker closure before cleanup, zero remaining budget
and unchanged input bytes. An independent held native media worker inherits the
actual source/output/workspace descriptors; queue cancellation reaches RetainedPackage
and process closure precedes directory cleanup and delivery-revocation completion.
That hold occurs before media dispatch: it proves lifetime ordering, while the
retained ZIP matrix supplies successful native decoding parity.

After a killed Node owner, a confirmed stopped native child keeps startup recovery
busy. Its tree and unlocked siblings remain untouched; library heavy jobs still
run. Explicit recovery succeeds after the actual child becomes terminal. Unknown
creation replies permit only empty-child recovery; a nonempty substitute retains
its reservation. Known identities continue to use exact removal authority.

Early-budget-credit and omitted-delivery-revocation mutations fail their consumer
assertions. Removing the fresh workspace lock permits forbidden recovery and fails
the inherited-child check. The shared copy fixture preserves the missing-stamp and
cleanup-failure red proofs. Independent reviews found fixture teardown/early-failure
paths; those were fixed and tested. Actor descriptors remain retained until deliberate
termination, and normal IPC disconnect kills/drains the child before closing handles.
The final merged run has no descriptor-GC warnings or live owned jobs.

Public package selectors, adapter startup/shutdown integration and package export
publication remain outside this internal registry pass.

[Root combined verification](../owner-integration/README.md) covers the merged package, export and storage owners.
