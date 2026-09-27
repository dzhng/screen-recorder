# 21 — Integrate synchronized webcam capture

Status: not started. Dependencies: [04](./04-projects.md), [09](./09-first-preview.md), [20](./20-camera-reproduction.md).

## Contract

A recording can capture screen, optional camera and audio into independently editable, synchronized assets and a project.

## Seam and ownership

Extend the existing capture selection/device/permission boundary and native capture lifecycle. Finalization adopts source assets via the shared asset owner and creates linked project clips using the frozen slice 20 mapping.

## Work and review surface

Expose camera discovery/selection in CLI/MCP while retaining current menu-bar recording controls. Preserve pause, cancel, restart, interruption/recovery, microphone/system selection and raw cursor evidence. Do not introduce an editing UI. Camera media stays independent for later agent-selected layouts.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/webcam.mjs --case capture-to-project
```

## Acceptance

Production-entry parity with slice 20, existing capture/recovery suites, absent/denied/disconnected camera, repeated finalization and restart. Record one real screen/camera tutorial; prove independent audio/video replacement afterward and preserved raw source timing.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **capture-to-project synchronization**, using shared event landmarks across the produced sources; composition styling is out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

A mock permission response or prerecorded camera clip does not pass physical capture acceptance. Record missing physical evidence and continue other slices rather than weakening recovery/sync semantics.

Delegated: Camera-device enumeration and native buffer organization. No automatic presenter layout or recording of unselected devices.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
