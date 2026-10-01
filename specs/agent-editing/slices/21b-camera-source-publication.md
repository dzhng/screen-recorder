# 21b — Closed camera sources and retryable publication

Status: planned isolated implementation. Dependencies: [20d](20d-capture-publication.md) and [20e2](20e2-camera-presentation.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

## Contract

Closing a selected camera produces a typed independent-source outcome. Publication
can be retried without closing the device or encoder again, losing its result or
inventing represented pictures.

## Seam and ownership

`CaptureInputSession`, `NativeCapture` and `CaptureTermination` own the closed
snapshot and terminal ordering. Separate encoder closure in the existing camera
writer from canonical publication in the existing camera media owner. Promote
these verified mechanisms rather than copying them or retaining parallel probe
and production implementations. The selected-device probe consumes the same owners.

The snapshot retains the independent camera directory/journal, closed media identity,
common clock/support facts and bounded failure. The settled result exposes its
verified source outcome separately from screen/audio tracks; camera is video in a
separate acquisition, not a new audio/video interpretation. Preserve existing
probe identities and observations; allocation/admission binding belongs to 21d.
Keep journal leases until publication settles or explicit discard releases them.
Operational failure/cancellation retains the snapshot for explicit retry; terminal
unavailability/conflict remains truthful. Publication does not repeat physical
closure. Screen/audio publication keeps its existing guarantees.

Public camera selection remains rejected. Do not broaden input acquisition,
project construction or installed consumers in this pass.

## Work and review surface

Extend the existing native prerecorded-input gate through actual `NativeCapture`.
Verify first stop and repeated/concurrent stop, positive start, pause/terminal
support, no accepted camera frames, partial prefix, publication failure and retry,
cancellation and explicit discard. Count physical input/encoder closure and prove
retry does not repeat either. Preserve ordered decoded-picture identity, source
mapping, raw files and bounded diagnostics. A negative control that loses the
closed camera result or repeats closure must fail.

Preserve the existing selected probe and screen/microphone/system/cursor cohorts.
Use isolated builds; do not replace frozen workers. Reuse retained media and
controlled small samples. No live devices, capture or playback is required.
The review artifact is the complete native result/retry packet, including source
identities and full-media preservation checks, retained under this child’s assets.

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
