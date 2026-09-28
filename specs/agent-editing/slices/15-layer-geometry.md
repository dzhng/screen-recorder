# 15 — Layers, crop and pointer geometry

Status: not started. Dependencies: [09](./09-first-preview.md).

## Contract

Agents can layer imported footage, place presenter overlays and apply static crop/fit/transform/opacity while preserving pointer geometry.

## Seam and ownership

Typed visual effects compile in composition; the selected native executor composites ordered layers. Captured pointer/trail evidence becomes an ordinary source-attached presentation effect through the same geometry transform.

## Work and review surface

Execute one ordered stack on every visual target, including nested combined groups and output. Use fixed transparent project-canvas intermediates and the coordinate-domain rules in processing.md. Verify parent opacity against overlapping translucent children, crop/transform order with asymmetric landmarks, no intermediate background fill and pointer mapping through the whole chain.

Implement the transform order and coordinate system in contracts.md. Prove contain/cover/stretch, source orientation, pivot/rotation, opacity and layer ordering. All layout parameters are agent-selected. Do not make presenter or B-roll layouts mandatory policies.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/layers.mjs --case presenter-and-screen
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Asymmetric landmarks and alpha regions land at expected pixels across two canvases. Crop/fit/rotation do not invert pointer coordinates. Whole-source identity transforms preserve existing pointer/movie evidence. Compare project frame, range preview and export geometry.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **layer geometry**, using presenter rectangle, screen landmarks and pointer target masks; animation, typography and color grading are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If pointer composition needs its own crop/scale calculation, consolidate it into the compiler transform. Unsupported blend/mask features must be reported as unsupported rather than approximated silently.

Delegated: Native pixel-compositing primitive and resource reuse. Layer order, geometry, fit defaults and explicit editorial choice are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


## Fixture and reference prerequisite

[Authored inputs and independent geometry/alpha oracle](../assets/15-layer-fixtures/README.md)
verify asymmetric decoded source pixels, orientation metadata and reference-control
sensitivity. This helper checkpoint does not accept new native or public layer
execution. The actual CLI geometry request still supplies a retained negative
control; compositor/profile, complete public journey and fresh visual gates remain.
