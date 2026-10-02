# Continuing camera verification in the publication owner

Status: [focused production consumers](../assets/20m-camera-continuing-verification/live-integration.json)
verify live range advancement, same-candidate publication, delayed and fractional
clocks, retry, discard and permanent-failure cleanup. Both full scanners and live
work consume continuing state through the unchanged digest. [The retained
250-second prerecorded replay](../assets/20m-camera-continuing-verification/retained-stop.json)
preserves all 4,428 pictures, starts 47 ranges per reader before Stop, and reaches
its durable result in 6.683 seconds, within the
original ten-second target. Peak sampled RSS is 173,277,184 bytes; the published
movie is the same private candidate inode observed before Stop. This completes
the controlled implementation/measurement scope. Physical input drain, device
synchronization, AppKit shutdown and general performance remain parent gates.

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

Written observation boundaries never regress when file events race capture rows.
An unchanged media version and already-considered written boundary cause no new
snapshot work. Mapping snapshots isolate the written prefix with the same owned
filesystem-clone primitive; only the private clone is truncated. Optional work
that cannot advance retains full-scan publication, with a diagnostic explaining
the fallback.

Existing full-scan consumers, fractional support, partial-source diagnostics,
failure order and publication replay remain preserved. Range advancement and live
ownership now run through CameraWriter and ClosedCameraSource. Use retained inputs
and saved qualified snapshots; no source-baseline replay, new capture or full-suite
gate. The retained replay supplies complete digest/support acceptance, resource
observations and elapsed stop time for this production owner.

The retained replay observes sustained advancement and bounded final tails;
the owner still permits only one worker and one replaceable pending request.
This is one complete prerecorded result, not a distribution or proof of physical
capture shutdown. State extraction or fixed range equality alone could not have
closed these requirements, and capture parent gates remain open.

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
