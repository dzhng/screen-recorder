# 16 — Keyframes and convenience zooms

Status: not started. Dependencies: [14](./14-retiming.md), [15](./15-layer-geometry.md).

## Contract

Explicit keyframes animate visual parameters and gain; convenience zoom/fade commands produce inspectable ordinary edits.

## Seam and ownership

Composition owns Curve validation, easing and compilation. Native executes compiled primitives with conformance vectors; no second authoring evaluator. Macros expand in the reducer and persist the resulting effects, not opaque special objects.

## Work and review surface

Add supported window/transition and Curve parameters to the same processing registry/get-set lifecycle at every target scope. Clip anchors follow existing content/normalized/project semantics; nonclip windows use project time. Prove exact full-function restriction across split/trim/padded replacement, dry output outside activation and no duration extension.

Expose activation/transition boundaries and key times through composition to the
[project retained-index selector](10d-frame-inspection.md#project-retained-index-selection-contract).
Verify a short visual activation between periodic samples is represented, without
a second anchor or curve evaluator in inspection.

Implement hold/linear/cubic segments, clamped endpoints and duplicate-key rejection. Animate position/scale/rotation/opacity and gain. Preserve source-time keys for content anchors, normalized fractional keys for held/still clip anchors and project-time keys for fixed anchors. Split/trim by restricting the original function, including cubic control handles; boundary values alone are insufficient.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/keyframes.mjs --case moved-split-zoom
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Conformance at exact endpoints and interior samples; no jump after split; moved/retimed content carries its animation; fixed anchors stay fixed. Match native execution to compiler samples. Inspect explicit gain ducking and fades without making the engine decide where ducking belongs.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **animation trajectory and timing**, using accepted layer geometry across a fixed sequence of timestamps; fonts and static layout are frozen. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

A macro that cannot be expressed as ordinary effects indicates missing primitives; fix the primitive seam rather than add a second effect engine. Reject invalid easing instead of guessing.

Delegated: Numerical solver and curve compilation optimizations within declared tolerances. Key domains and interpolation semantics are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
