# 20e — Prepare selected-device clock reproduction

Status: offline implementation verified; [evidence](../assets/20e-selected-device-probe/README.md).
A user-authorized physical take is retained in [fixtures](../../../fixtures/screen-camera-timing/README.md);
its [physical timing analysis](../assets/20-physical-sync/README.md) does not close
parent20 acceptance. [20e2](20e2-camera-presentation.md) supersedes20e1's nominal-gap
policy and verifies saved-take recovery plus public consumers. No further capture
is authorized.
Dependencies: [20a](20a-offline-clock.md), [20b](20b-exact-capture-audio.md),
[20c](20c-sparse-capture-materialization.md), [20d](20d-capture-publication.md).

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
tail, or invent an acquired source picture. [20e2](20e2-camera-presentation.md)
distinguishes picture acquisition from ordinary native display hold; nominal
callback durations do not establish outages. `CaptureInputSession.stop` remains
physical-input drain only. Its probe media
joins NativeCapture's existing termination operation through explicit default-nil
`finalizeMedia(clock:failure:) -> CaptureFailure?` and default no-op `discardMedia()`
hooks. Camera results stay in separate probe evidence; no camera role enters
production CaptureResult tracks. Earlier failures retain precedence, and all
screen/microphone result fields remain authoritative. Stop
seals writer ingress, drains inputs, finishes the screen/audio writer (including
an open pause), then finalizes camera from the final shared clock before caching
the closed result and publishing audio. Publication retries must not repeat media
finalization. Discard and failed startup cancel probe media, never finalize it.
A typed queue-owned ingress snapshot includes both CaptureClock and acceptance
state: sourceTime alone does not reject post-seal samples. Camera callbacks must
honor the writer seal gate. Partial starts and device loss retain the same owner.
Stream raw PTS,
converted host PTS, callback host time, role, placement/drop reason and clock
observations to bounded append-only evidence rather than accumulating a take.

## Offline acceptance

- Pure malformed/incomplete request, explicit selection miss and denied/unknown
  authorization tests prove no source activation or implicit permission request.
- Prerecorded callbacks exercise the same conversion/ingestion seam, including
  late camera start, pre-origin samples, pause crossing, stop while paused,
  post-seal delivery, discard, partial startup and publication retry.
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

Parent [20](20-camera-reproduction.md) owns physical follow-up. The user already
provided the retained approximately four-minute take after revising the requested
duration to roughly 200 seconds. Use its originals, journals, recovered sources and
telemetry first; this slice does not schedule another capture or permission prompt.
Keep shared-event timing, one declared initial alignment, offsets, interruption,
pause/resume and actual shutdown as separate claims. A missing scenario or an
uncertain measurement is reported precisely, not inferred from compilation or
prerecorded inputs. Any new live action needs a concrete missing fact and separate
authorization after retained evidence is exhausted. Physical visual verification
inherits parent 20's comparison and final unprimed critique.

Delegated: internal file arrangement and reversible diagnostic formatting. Any new
capture policy, clock correction, device fallback or production camera role requires
rescoping before implementation. No persistent authorization token is introduced.

Plan review: an independent read-only owner audit found that physical input stop
cannot also finalize camera media: discard uses that same stop path, and the
writer closes an outstanding pause afterward. The lifecycle above resolves that
finding. A failure-only closure result keeps camera evidence from replacing
production screen/microphone metadata; finalization errors are cached outcomes,
not reasons to repeat media closure on publication retry.

[Prerecorded stop measurement](../assets/20e-selected-device-probe/stop-scale/README.md)
verifies accumulated-media closure beyond the quit fallback using actual native
writers and publication. It adds no physical capture, AppKit termination verdict
or shutdown-policy change.
