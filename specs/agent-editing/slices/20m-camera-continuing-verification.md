# Continuing camera verification in the publication owner

Status: implementation next. Fixed raw IDR, canonical transfer and ranged digest
proofs are retained; production publication still scans complete media after closure.

## Contract

Keep camera picture verification with CameraMedia. Extract the current raw and
canonical consumption rules into continuing state, with independent ordered SHA256
states and exact mapping ordinal, timestamp and physical-support progress. The
existing full scanners must consume those same rules; preserve the digest byte
representation, raw-first failure selection and every mapping/terminal diagnostic.
No second verifier, alternate hash or test-only production path.

Advancement reads only new qualified ranges from immutable snapshots, preserving
native clocks and endpoint meaning. Commit only independently qualified prefixes;
failed tentative work cannot corrupt committed progress. Finalization completes the
actual tails and checks both complete hashes/support before publishing. Preserve
input-byte binding, receipt replay, cancellation/join, retry, discard and generic
recovery fallback. Capture ingress may trigger work only after its accepted mapping
row is durable, with no synchronous decode on the ingress queue.

Start with the existing full-scan consumers and their focused preservation checks,
then connect range advancement and live ownership through CameraWriter and
ClosedCameraSource. Use retained tiny fixtures and saved qualified snapshots; no
source-baseline replay, new capture or full-suite gate. Each coherent pass must
leave the actual production consumer and its tests on the same verification owner.

The complete contract also needs sustained advancement, bounded backlog and the
original completed-stop deadline. State extraction or fixed range equality alone
does not close these requirements or the capture parent gates.
