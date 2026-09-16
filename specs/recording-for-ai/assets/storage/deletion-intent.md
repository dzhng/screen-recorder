# Capture shutdown before deletion

The [catalog and queue prerequisite](catalog-queue.md) hides a recording and prevents
new producers. Capture quiescence joins existing control work, including pending
starts and recovery, then waits for the app's native terminal operation. It removes
no files. Only after closure is proved does the catalog record canceled capture
state and wake the queue; a later cleanup failure therefore cannot starve unrelated
heavy processing. Intent continues to hide the recording and retain its ownership.

## One terminal owner at each boundary

[CaptureTermination](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureTermination.swift)
coalesces concurrent ending requests onto one task. The operation owns all cleanup;
joining callers only receive its immutable result. The task clears its slot before
resolving. New starts require both idle state and an empty terminal slot, so a late
caller cannot clear or stop a replacement take.

The device operation owns stream shutdown, writer finish/cancel, the terminal journal
note and generation/state cleanup. Interruption seals the writer immediately and
notifies its controller; it does not keep a separate asynchronous stream teardown.
The controller operation additionally owns the finalizing report, pinned receipt,
final unsolicited notification and take cleanup. Its interruption callback captures
the active or pending take identity before scheduling. A callback for a pending take
waits for that exact start to return, then checks the active identity: a refused
start is ignored, and an old callback cannot target a replacement take. Native may
already be recording while its controller's start continuation has not yet resumed,
so checking only the active take would lose that interruption.

A finalizing report describes the beginning of shutdown. It is not a terminal
receipt. Service quiescence checks device status only after the ordered cancel has
joined these owners. A timeout, selecting/finalizing state or the same active take
leaves intent/source ownership intact. An already-finished take needs no native call.

Cursor sampler cancellation does not retract already-queued deliveries. The real
writer now checks its finishing boundary before accepting a cursor reading, including
before recording a display-space change. Media callbacks already obey that boundary.
Apple documents that [cancelWriting blocks until cancellation finishes](https://developer.apple.com/documentation/avfoundation/avassetwriter/cancelwriting%28%29?language=objc);
no extra asynchronous writer-cancellation wrapper is needed.

## Verification

- Core catalog/job tests passed; the full service suite passes 68 tests. Ten service
  capture-lifetime tests cover held start,
  held recovery, native uncertainty, finished targets, closure releasing unrelated
  heavy work while source files/intent remain, and cancel joining terminal completion.
- The native executable harness passes with the real writer/journal fixture. Removing
  only the finishing guard makes a late cursor append after seal and fails the byte
  assertion. Restoring it passes both seal and cancel scenarios.
- A held-operation test exercises the shared terminal owner. Removing its join branch
  runs concurrent discard during finalization and fails the explicit assertion;
  restoring the owner passes, including failure/retry and old waiter/new take cases.
- The real [controller race fixture](../../../../apps/macos/tests/capture-terminal.test.mjs)
  uses a fake service to hold the finalizing-report reply. The app, native capture and
  writers remain real, recording only the app's own window with both audio roles off.
  Concurrent cancel must join; replacement start must refuse until the report is
  released. Both callers receive identical pinned receipts. A subsequent take records
  while the old journal stays unchanged. Bypassing only the controller's shared owner
  changes the held native state from recording to finalizing and fails the assertion.
- All eleven existing own-window capture-service tests pass, including cancel/restart,
  ordinary quit, service loss, no-decodable-media and held/lost start outcomes. These
  checks reap their owned processes. They do not prove physical audio or display/region
  capture, power-loss behavior or public recording deletion.

Independent native-lifetime review identified the separate interrupted teardown and
controller report-await races; both were corrected through the shared owners above.
Final independent Codex review found no actionable defects (static review; runtime
proof is the executed fixtures above).

The [pending-start regression](../../../../apps/macos/tests/capture-start-interruption.test.mjs)
compiles the actual controller with only its native constructor bound to a scripted
external boundary. It holds native return after an interruption and proves both
successful-start finalization and failed-start/replacement preservation. Removing
either pending identity selection or the exact-start wait fails the lost-interruption
assertion; restoration passes. No production test hook or device protocol was added.
Independent review found no actionable defect; its sandbox could not compile the
fixture, while the host run passed. The rebuilt app also passed four focused
own-window start/quit/service-loss checks and the real held-report controller race.
This is controlled boundary evidence, distinct
from physical source-loss or microphone-disconnection capture.

The CLI/MCP delete coordinator, owned lease/cache cleanup and disk usage still belong
to later passes. This evidence supplies their capture shutdown prerequisite rather
than claiming the complete deletion feature has shipped.

## Reviewed choices

**Sound, medium confidence — first terminal operation wins.** If interruption/stop
already owns finalization, cancel waits for that operation and receives its pinned
finished receipt. Ordinary service cancel/restart then refuses `INVALID_STATE` and
retains the finished recording, following the existing rule that library deletion
removes finished takes. If cancel owns shutdown first, ordinary canceled behavior
remains. Deletion quiescence accepts either closed outcome and uses the deletion-only
catalog settlement. Adding complete-to-canceled lifecycle transitions would erase
this distinction and is deliberately avoided.

**Sound, high confidence — one shared joining primitive, two lifetime owners.** Device
shutdown and controller reporting finish at different times. The same small task
primitive serves both boundaries, while each owns its real state and side effects.
An additional interruption teardown would require a third lifetime to drain; sealing
and notifying keeps that work in the existing stop/discard operation.

**Sound, high confidence — same-package writer tests and an external service hold.**
The writer is visible within its Swift package, not public to product consumers. Its
existing executable test target needs no XCTest/Swift Testing framework (neither is
available in this host's command-line toolchain). The controller regression holds
its existing service pipe, avoiding a production debug hook, environment flag or
new test target. Both tests exercise the actual owners rather than a copied model.
