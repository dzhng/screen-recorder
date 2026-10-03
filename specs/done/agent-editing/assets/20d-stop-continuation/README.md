# Stop acknowledges ownership before durable completion

Stop records and returns the existing finalizing transition while the existing
termination task closes media. The exact acknowledgment is retained while a later
terminal report is in flight, so repeated stop cannot attach an older state to a
newer sequence. Status and cancellation can use the service queue during this work.
Consumers must await the stored terminal take before reading duration or media.

Packed publication retains the closed writer result for explicit retries. Explicit
cancellation reaches the same termination task, including a request before native
shutdown starts or while encoder closure is in flight. Cancellation after canonical
availability is settled may leave optional cleanup pending; it cannot turn a
completed take into a discardable one. The optional CaptureResult.cleanupFailure is
separate from capture failure, which retains precedence. Recovery, not repeated stop
on an already settled take, owns cleanup retry.

This checkpoint does not enable schema2 capture. The real controller fixture uses a
scripted acquisition owner; its held-report and held-close races do not establish
actual NativeCapture/writer/publisher integration or physical permission behavior.
The next gate extracts physical input lifetime, including live cursor sampling, so
prerecorded buffers can exercise those real owners without devices. Canonical source
admission/package closure, typed unavailable audio outcomes, actual public work over
old 10s/30s deadlines, recovery budgeting and layout activation remain open in20d.

The old controller fails the new held-stop acknowledgment check at its existing 5s
subprocess deadline; its original pending-start cases still pass. The final controller
passes five deterministic modes: original start interruption/refusal plus finalizing
acknowledgment/terminal race, publication cancellation, and cancellation while the
initial report precedes native stop. Native termination tests independently retain
cancellation through closure and preserve settled availability during cleanup.

Native default, actual EFBIG preservation, app build, controls tests, and35 focused service/core
lifecycle tests pass. The service test proves queue responsiveness with a scripted
native peer. Live capture harness callers were updated to wait for terminal stored
recordings and syntax checked; they were not executed. No screen, microphone, camera,
cursor acquisition, permission prompt or installation was performed.

Independent review found two defects: early cancellation could be lost before the
native task existed, and physical harness consumers still expected synchronous stop.
Follow-up review also found unproved-start recovery treating the acknowledgment as
closure. It now retains native-proved finalizing, including the legitimate
preparing-to-finalizing transition, and accepts the eventual terminal report without
a service-authored recovery sequence overriding it. All three are corrected. Review
logs retain the findings and follow-up verdict. Shape
review keeps task ownership in CaptureTermination and outcome in CaptureResult; no
new registry, endpoint, deadline or alternate clock was added.

Reproduce from the repository root (live capture harnesses are deliberately excluded):

```sh
swift build --package-path helpers/mac --product ScreenRecorderCaptureTests
helpers/mac/.build/debug/ScreenRecorderCaptureTests
SCREENREC_JOURNAL_FAILURE_OUTPUT=/tmp/capture-stop-journal-check SCREENREC_CAPTURE_GAP_CORPUS="$PWD/specs/agent-editing/assets/00-corpus" helpers/mac/.build/debug/ScreenRecorderCaptureTests
node --test apps/macos/tests/capture-start-interruption.test.mjs
swift build --package-path apps/macos --product ScreenRecorder
swift run --package-path apps/macos ScreenRecorderControlsTests
node_modules/.bin/vitest run apps/service/src/capture-finalizing.test.ts apps/service/src/capture-lifetime.test.ts packages/core/src/library.test.ts
node_modules/.bin/turbo run build --filter=@screenrec/cli --filter=@screenrec/service
node apps/cli/dist/main.js capture.stop --help
```

Frozen logs, the old controller/driver and actual journal-failure media retain exact
bytes in gzip/tar archives. verification.json records the worker hash and bounded
claims; artifact-hashes.json binds the retained evidence. Build products are local.
