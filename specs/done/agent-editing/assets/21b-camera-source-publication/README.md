# Closed camera sources and publication

Physical closure and canonical publication have different lifetimes. Closing a
camera drains its encoder once and retains its independent directory, journal
lease, common clock, counters and complete raw/observation byte identities.
NativeCapture keeps that snapshot while publication is unfinished. Explicit stop
retry consumes the snapshot; discard ends its lease authority without closing an
already closed input or encoder again.

The [camera media owner](../../../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift)
retains the accepted native presentation mechanism. It verifies every represented
picture's exact timestamp and decoded BGRA identity, positive start, shared pause
mapping and physical terminal support. Its receipt permits canonical replay without
reencoding. Success is verified again while primary audio remains retryable; a
terminal media conflict cannot become successful after another source retries.
Independent sources can make publication progress even if another encounters an
operational error. Global completion and both lease releases wait for settlement.

[Verification](verification.json) records the exact fixture/runtime identities and
gates. The default suite is the native CaptureTests executable, not the entire
native repository. [Root merged verification](merged-verification.json) compares
142 Swift source/test files and repeats the complete 20-case camera packet using
the pinned binary; its [log](merged-camera-packet.log) records the passed result.
[The manifest](manifest.json) indexes the complete packet in
`evidence.tar.xz`, including generated source media, native results, closure-boundary
counts, raw/canonical media, rational observations, journals, receipts, retries,
refusals and regression controls. The fixture replaces only physical input:
NativeCapture, the camera encoder, shared clock/ingress and publication are real.
Closure counts measure the input's stop and close-media boundary calls; the actual
camera close owns one encoder finish within that boundary. No test-only production
counter or hook was added.

The existing selected-probe, exact cadence/picture, screen/microphone/system,
cursor, pause and recovery gates retain their scopes. Public camera selection is
still rejected. Device acquisition, library source admission, project construction
and app cutover belong to the following 21 children. The probe's UUID journal
identity and `probe-camera` source kind are preserved; allocation binding is 21d.

No hardware discovery, permission request, live capture, audible playback, model
execution/preparation, installation or app switch was performed. The frozen native
worker was rehashed unchanged. These checks do not establish one-frame physical
synchronization or the ten-second completed-stop acceptance. Codex CLI review was
not retried: its unchanged configured model was already known to be rejected;
root's independent collaboration review replaces that unavailable check.
