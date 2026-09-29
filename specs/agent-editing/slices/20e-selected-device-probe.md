# 20e — Prepare selected-device clock reproduction

Status: planned implementation; no physical capture authorized or performed.
Dependencies: [20a](20a-offline-clock.md)–[20d](20d-capture-publication.md).

## Contract and boundary

Make slice20's concrete screen/camera/microphone reproduction runnable under an
explicit app identity, while proving its request and activation boundary offline.
This is a feature-owned probe, not slice21's production webcam API. The parent20
physical gate remains open regardless of compilation or synthetic test results.

The explicit probe capture action supplies selected screen/window/region, camera
uniqueID, microphone uniqueID or disabled, empty destination, output fps, duration,
pause schedule and camera start delay. It is invocation intent, not a persistent
claim of human consent. Reject incomplete/invalid requests before device discovery
or construction. Capture checks OS permissions and refuses missing grants; it never
requests them. Selection never falls back to another device. Discovery and explicit
permission requests are separate app-identity probe actions, not startup behavior.
The agent may invoke none of those live actions in this implementation pass.

## Ownership

The app's existing `--probe` dispatch hosts the reproduction and camera usage text;
normal launch and public CLI/MCP recording contracts gain no camera operation.
The native capture package owns probe request validation and physical input glue.
Reuse NativeCapture's input-session injection, generation, interruption and shared
CaptureTermination rather than introducing another live capture state machine.
Screen/microphone media continue through CaptureWriter's accepted PCM journal,
canonical materializer and publication. Observe/convert source synchronization-clock
PTS at a narrow input seam before normal writer ingestion. Production capture keeps
its existing path until parent20 measures the candidate mapping.

Camera is a separate video-only probe sink with its own dimensions, using the same
screen-established clock snapshot and serial ingestion queue. It records the
existing journal shape for its independent video source, not a new production role
or audio writer. It must not re-zero late camera frames, hold a disconnected camera's
tail, or invent a source picture across a gap. One stop drains inputs before closure;
partial starts and device loss use existing terminal ownership. Stream raw PTS,
converted host PTS, callback host time, role, placement/drop reason and clock
observations to bounded append-only evidence rather than accumulating a take.

## Offline acceptance

- Pure malformed/incomplete request, explicit selection miss and denied/unknown
  authorization tests prove no source activation or implicit permission request.
- Prerecorded callbacks exercise the same conversion/ingestion seam, including
  late camera start, pre-origin samples, pause crossing, failure and teardown.
  Check separate playable output, exact canonical microphone PCM/support and
  common source origin; simulated clocks never count as physical drift proof.
- Preserve existing capture writer/clock/journal/termination/recovery gates and
  offline camera reproduction. Verify normal app dispatch remains unchanged.
- Build only with an isolated Swift scratch path and bounded jobs, preserving
  frozen workers, existing app bundles and installation. No device enumeration,
  permission reads/prompts, recording, playback, signing/install or downloads.
- Review shape, diff, docs and independent Codex review before acceptance. Retain
  executable hashes, commands, output and scoped results under slice assets.

## Physical follow-up and review surface

After offline review, present the exact app identity, selected IDs, local destination
and schedule for explicit user authorization. Device discovery may then assist
selection if separately authorized. Parent20 still requires ten active minutes,
shared visible/audible landmarks, one declared initial alignment, pause/resume,
nonzero offsets and separate physical interruption/permission scenarios.
No silence or successful build authorizes any of those actions. Physical visual
verification inherits parent20's compare-screenshots and final unprimed critique.

Delegated: internal file arrangement and reversible diagnostic formatting. Any new
capture policy, clock correction, device fallback or production camera role requires
rescoping before implementation. No persistent authorization token is introduced.
