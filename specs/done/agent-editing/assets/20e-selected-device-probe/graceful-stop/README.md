# Graceful selected-probe stop

The real take exposed a lifecycle omission: AppDelegate's quit handler only knew
about the ordinary recording controller, while the selected-device probe kept its
capture local. SIGTERM therefore exited without running the probe's existing
physical drain, media closure and result publication.

The app now retains the selected probe and its task. Quit requests a graceful stop,
which wakes scheduled recording/pause/startup waits, then uses the same
NativeCapture stop and publication path. Repeated requests add no terminal action.
A stopped delayed start does not activate the camera afterward. This is a probe
lifecycle correction, not a production webcam operation or a second capture state
machine. The existing no-service ten-second quit fallback remains: an unresponsive
finalizer can still leave interrupted, recoverable originals. Stop is not task or
publication cancellation.

Offline tests use the actual selected-probe run with prerecorded physical input.
Recording and paused cases preserve one drain and finalization, do not publish a
result before physical drain, save the exact returned result before settling, and
ignore repeated stop requests. Separate delayed-wait checks cover stop before and
during the wait. Removing stored stop intent makes the regression fail at “Stop
did not wake the scheduled wait”; restored tests pass. These tests do not prove
physical selected-input integration or the AppKit/SIGTERM path on a live take.
The real app compiles in an isolated scratch directory; it was not launched,
installed or explicitly signed. Frozen workers and the signed physical probe
were untouched. Swift package dependencies were resolved from existing caches;
no new model/runtime was installed.

Fresh independent read-only review found no actionable defect and retained those
verification limits. The configured CLI review model was unavailable before its
review began; the failure log is retained without changing configuration.
`evidence.tar.gz` and its member manifest preserve builds, tests, mutation refusal,
source snapshots and offline results. `verification.json` records binary/source
identities. This pass does not claim to fix the separate camera recovery decoder
hang; its original samples and raw/candidate files remain retained.

[Root integration](root-verification.json) matches all six source snapshots to the
combined tree, verifies all30 members across stop/diagnostic archives and both
built binaries, and reruns the offline stop gate successfully. The ten-second
fallback can still end a long camera publication; this is verified stop wiring,
not a claim that physical camera recovery or full probe shutdown now passes.
