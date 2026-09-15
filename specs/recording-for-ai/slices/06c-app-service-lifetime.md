# 06c — App-owned service lifetime

Status: candidate implemented; startup ownership/deadline regressions reproduced
and correction in progress. See [review evidence](../assets/service-lifetime/review.md). Dependencies: 00 and 06b. This extracts the idle process-lifetime
boundary from 06; capture reconciliation and durable jobs remain in the parent.

## Contract

Ordinary menu-bar app launch starts one Node service child, which owns the existing
private Unix socket listener. The app and child communicate through inherited
bidirectional JSON-lines pipes. The child exits and closes its listener when the
app's pipe closes; normal app quit shuts the child down within a bounded deadline.
A service startup failure is visible and actionable, never a hidden retry loop.
Launching the app or reading service health must never start recording or prompt
for screen/microphone permission.

The implementation must compose `listenLocal` and shared protocol framing; it must
not add a second socket implementation or another metadata store. Keep stdout for
control messages and stderr for diagnostics. Correlate concurrent requests, bound
frames and pending calls, and reject/settle pending calls on EOF, child death,
malformed control data or startup timeout. Use the existing ten-second startup
budget. Do not fabricate capture state while this child only owns service lifetime.

## Scope and ownership

- A real service entrypoint in `apps/service`, using the existing transport.
- Swift child-process/control-channel ownership in `apps/macos`.
- Build integration that places the executable service artifact in the `.app`.
  Node 24 remains the explicit personal-host prerequisite; resolve and validate it
  without relying on a Finder-launched app inheriting the developer shell's PATH.
- Health round trips across real app → child → local client. The operation is
  useful runtime health, not a second fixture-only domain registry.
- Explicit duplicate-owner and failed-start behavior. Preserve the established
  no-live-socket-unlink rule and never kill an unrelated process to claim the socket.

Capture control, recording allocation, journal ingestion, recovery scanning, client
app auto-launch and durable processing jobs are separate remaining 06 integration
work. This pass does not close 06 or claim service-death-during-capture acceptance.

## Verification

Use the actual packaged app and temporary SCREENREC_HOME. Verify launch and health,
normal quit, abrupt parent death, child death, malformed/oversized control messages,
startup failure, and a second attempted owner. Check real process termination and
socket state, not only mocked callbacks. Pure framing tests supplement these tests.
Retain logs and exact launch commands in the owning evidence report. No screen or
audio recording is needed for this process-lifetime gate.

Review the implementation with repository-local review and audit-choices, rerun
transport checks, and leave the current app build runnable. Extend the existing
normal app path rather than shipping a parallel lifecycle demo.
