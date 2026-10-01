# 21 — Integrate synchronized webcam capture

Status: [passive discovery and permission facts](21a-camera-discovery.md) are
verified in controlled public/native fixtures. [Closed camera source/publication](21b-camera-source-publication.md)
and [selected input](21c-selected-camera-input.md) are verified through actual
controlled NativeCapture. [Durable source adoption](21d-captured-source-adoption.md)
passes current native/public retry and portable verification, including a read-only
retained-take check. [Caller-authored projects](21e-capture-project-adoption.md)
pass merged public media, replacement/undo and portable-history verification.
Selector-free capture integration, independent publication and camera clock/support
are merged-verified. Atomic public selection and physical acceptance remain open.
Implementation dependencies: [04](04-projects.md), [09](09-first-preview.md) and
the verified clock/materialization/publication owners in
[20a](20a-offline-clock.md), [20d](20d-capture-publication.md) and
[20e2](20e2-camera-presentation.md). Synchronized physical acceptance additionally
depends on [20](20-camera-reproduction.md); it is not a prerequisite for isolated
schema/lifecycle/finalization preparation.

## Contract

A recording can capture screen, optional camera and audio into independent assets
with exact shared-clock provenance. The external caller constructs a synchronized
project through existing project and edit operations.

## Seam and ownership

Extend the existing capture selection/device/permission boundary and native
capture lifecycle. Optional camera selection is explicit, with no device fallback,
implicit activation or startup permission prompt. Reuse the same capture clock,
termination, asset admission and project owners. Preserve independent media and
raw clock/support provenance. Publication retry must not repeat physical closure.
Finalization adopts separate assets and returns their source/time mappings.
It does not create a composition or choose the first visual source, video order,
visibility, layout or synchronization membership. The external caller supplies
canvas, tracks, placements and links through existing `project.create` and
`edit.apply`; documented single-AV placement defaults retain their scope.
Do not invent capture-start authoring settings or another authoring surface.

## Implementation graph

[21a](21a-camera-discovery.md), [21b closed source/publication](21b-camera-source-publication.md)
and [21c selected input](21c-selected-camera-input.md) are complete in controlled
scope. [21d durable source adoption](21d-captured-source-adoption.md) is verified.
[21e caller-authored project integration](21e-capture-project-adoption.md) is
verified. Next is [21f](21f-public-camera-selection.md#implementation-checkpoints):
capture facts, durable admission and fresh coordination are merged-verified.
Independent publication and camera clock/support are merged-verified; atomic public
selection follows the new [crash-source recovery prerequisite](21f3c-source-publication-recovery.md). The verified21c/21e prerequisites do not
permit a selector that cannot reach that complete path.
Each child has one owning seam and a separate verification packet. Parent21
stays open until its implementation children and actual physical/lifecycle
acceptance pass.

## Work and review surface

Expose camera discovery/selection in CLI/MCP while retaining current menu-bar recording controls. Preserve pause, cancel, restart, interruption/recovery, microphone/system selection and raw cursor evidence. Do not introduce an editing UI. Camera media stays independent for later agent-selected layouts.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/webcam.mjs --case capture-to-project
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Verify public-entry parity with the existing capture/clock owners, absent/denied/
disconnected camera cases, repeated finalization and restart. Reuse the retained
screen/camera/microphone take for admission, recovery, project adoption and
independent audio/video replacement fixtures with preserved raw timing. Do not
mandate another tutorial recording. Controlled device responses and prerecorded
media can prove public wiring, not actual device acquisition, physical clocks or
live shutdown. Keep those acceptance claims separately pending under 20 until the
existing evidence proves them; any genuinely new live action needs its own
concrete purpose and authorization after retained evidence is exhausted.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **capture-to-project synchronization**, using shared event landmarks across the produced sources; composition styling is out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

A mock permission response or prerecorded camera clip does not pass physical capture acceptance. Record missing physical evidence and continue other slices rather than weakening recovery/sync semantics.

Delegated: Camera-device enumeration and native buffer organization. No automatic presenter layout or recording of unselected devices.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
