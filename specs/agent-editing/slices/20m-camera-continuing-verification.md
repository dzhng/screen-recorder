# Continuing camera verification in the publication owner

Status: the [first production state pass](../assets/20m-camera-continuing-verification/README.md)
is merged and focused publication consumers pass. Both full scanners now consume
continuing value state through the unchanged digest. Range advancement and capture
lifetime integration are in progress; publication still scans complete media after closure.

## Contract

Keep camera picture verification with CameraMedia. Keep the raw and
canonical consumption rules in continuing state, with independent ordered SHA256
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
row has been written, with no synchronous decode on the ingress queue. Observation
synchronization remains with the existing close boundary; speculative eligibility
does not add a per-frame disk synchronization policy.

The first pass preserves existing full-scan consumers, fractional support, partial
source diagnostics, failure order and publication replay. Next connect range
advancement and live ownership through CameraWriter and ClosedCameraSource. Use retained tiny fixtures and saved qualified snapshots; no
source-baseline replay, new capture or full-suite gate. Each coherent pass must
leave the actual production consumer and its tests on the same verification owner.

The complete contract also needs sustained advancement, bounded backlog and the
original completed-stop deadline. State extraction or fixed range equality alone
does not close these requirements or the capture parent gates.

## Current integration regression

The [actual baseline](../assets/20m-camera-continuing-verification/live-baseline-red.json)
fails because the real offline NativeCapture path has no private canonical work
before stop. Its complete before-stop state and terminal failure are retained.
The implementation must make that path advance both physical verification streams
while recording and preserve final publication. A private empty file alone is not
proof that either reader ran or that digest progress was committed.

The [active-prefix failure](../assets/20m-camera-continuing-verification/active-prefix-red.json)
shows an unfinished fragment exposing a later presented sample before intervening
pictures. Qualify an independently complete mapped prefix through its closing IDR;
an incomplete later tail must not invalidate that prefix. Keep all available native
rows in the DTS partition check and retain strict complete mapping at closure.
