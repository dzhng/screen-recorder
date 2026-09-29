# 20 — Prove screen and camera timing

Status: [offline clock/separate-source prerequisite](20a-offline-clock.md) verified through its exact PCM/recovery/publication children; [selected-device probe preparation](20e-selected-device-probe.md) is the next offline-buildable prerequisite; real ten-minute capture and physical interruption gates remain unverified. Dependencies: [00](./00-corpus.md).

## Contract

Establish a measured shared-clock strategy for simultaneous screen, camera and microphone capture before integrating webcam support.

## Seam and ownership

Feature-owned native capture reproduction using ScreenCaptureKit and AVCaptureSession candidates. Emit separate source tracks plus timing observations; no presenter layout is baked into captured pixels.

## Work and review surface

Reproduce documented device capture with an explicit selected camera. Measure start offsets, pause/resume and drift with a shared visible/audible event. Retain raw timestamps and gaps. Use supplied prerecorded media for plumbing while real device permission/input is unavailable, without claiming the physical gate passed.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/camera-reproduction.mjs --case shared-clock
```

## Staging

[20a](20a-offline-clock.md) proves only controlled timestamp conversion, the existing
pause mapping and independent writer/recovery plumbing using prerecorded inputs.
Its production PCM requirement is verified through [20b](20b-exact-capture-audio.md),
[20c](20c-sparse-capture-materialization.md) and [20d](20d-capture-publication.md).
Together with their publication/recovery children, these preserve exact placement,
canonical recovery and safe publication. None
validates actual device clocks or passes this slice's physical gate. After
that checkpoint, use explicit selected camera/microphone/screen identities and an
authorized capture identity for the shared flash/audible-event take. Keep one
declared initial alignment; do not fit away residual drift or flatten the sources.
The [audit](../assets/20a-offline-clock/planning-audit.md) names required user setup,
permissions, ten minutes of active capture and separate interruption scenarios.

## Acceptance

Real ten-minute screen/camera/audio take has measured relative drift within one output frame after declared initial-offset alignment. Exercise interrupted camera, missing microphone, pause/resume and non-zero capture offsets. Confirm clean separate source media and recoverable partial results.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **cross-source synchronization**, using shared flash/event regions in screen and camera frames; presenter layout and image aesthetics are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If clocks cannot be reconciled directly, reproduce explicit measured source offsets/alignment and freeze that approach. Do not hide drift by baking a webcam overlay into the screen video or substitute imported footage for the capture gate.

Delegated: Native capture synchronization mechanism selected by measurements. Separate sources, truthful gaps and existing recording controls are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

