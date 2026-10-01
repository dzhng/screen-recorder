# 21c — Selected camera input through the shared lifecycle

Status: planned isolated implementation. Dependencies: [21b](21b-camera-source-publication.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

## Contract

An explicitly selected camera participates in the ordinary input session and its
shared clock/termination order. Screen-only input performs no camera action.

## Seam and ownership

Extract the selected probe’s camera-session acquisition and clock ingress into
shared capture input owners. `CaptureInputSession`, `NativeCapture`, `CaptureClock`
and `CaptureTermination` remain the single lifecycle/timing owners; the probe
retains only measurement orchestration. Preserve exact selected identity,
authorization preflight and refusal without fallback or permission prompting.

Ordinary capture retains cursor sampling and system-audio routing. Probe-only
frame-rate/delay/stop controls remain measurement inputs, not public settings.
Public `cameraDeviceId` stays rejected until 21f; this pass verifies the internal
input seam with controlled device boundaries.

## Work and review surface

Run scripted acquisition and actual native lifecycle fixtures for omitted,
selected, denied, absent and disappearing camera, startup failure/interruption,
stale callbacks, pause/resume, cancel/discard and repeated termination. Assert
exact device selection, no unselected activation, physical drain once and unchanged
screen/microphone/system/cursor evidence. Negative controls must catch ignored
selection and lost system/cursor routing. Preserve terminal source outcomes from 21b.
Keep live hardware/pause/shutdown acceptance separately pending under20.

## Acceptance

Keep the relevant [preservation gates](../verification.md#preservation-matrix) and
[single-owner rules](../architecture.md) green. Record the bounded fixture result,
source/runtime identities, failures and limitations under this child’s assets and
in the parent handoff. Prepared wiring, actual media parity and physical acceptance
are distinct verdicts. The one-frame synchronization and ten-second completed-stop
gates remain unchanged. No new capture, audible playback or installed switch.

## Failure boundary and discretion

Delegated: internal names, compact typed result structure and fixture organization
within the existing owners. No editorial policy, second lifecycle/catalog, silent
fallback, weakened preservation gate or fabricated physical verdict. A failure
reslices its actual owner rather than broadening into unrelated work.

User feedback changing the named contract requires updating this child and its
dependents before expansion. Existing accepted auditions and the selected 200 ms
room-tone recipe retain their exact-media scope and are not repeated here.
