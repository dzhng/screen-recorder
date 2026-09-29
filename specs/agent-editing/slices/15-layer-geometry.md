# 15 — Layers, crop and pointer geometry

Status: verified for static layers, crop/fit/transform/opacity and source-attached
pointer geometry, including delivered edit/history/output paths. The
[scoped encoded acceptance](../assets/09b-encoded-appearance/acceptance.md) documents
permitted codec loss and remaining whole-editor limits. Dependencies: [09](./09-first-preview.md).

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


## Ownership and evidence

One geometry processor owns crop, fit, destination rectangle, scale, clockwise
rotation and normalized pivot. Opacity stays a separate ordered step. Composition
compiles sampling clamps, affine transforms and bounded polygon coverage; native
executes those records rather than interpreting a second transform language.
Fixed transparent project-canvas intermediates preserve nested alpha. Background
is applied before output processing; nonopaque final H.264 pixels refuse without
an implicit matte, while PNG preserves alpha.

The [fixture oracle](../assets/15-layer-fixtures/README.md) and
[native geometry evidence](../assets/15-layer-geometry/README.md) establish
asymmetric orientation, support and transform controls. Public
[static layers](../assets/15-layer-public/README.md),
[processed edits](../assets/15-layer-edits/README.md) and
[moving-source edits](../assets/15-layer-edit-motion/README.md) deliver the named
operations through the shared CLI/MCP path.

[Sampling cells](../assets/15-sampling-cells/README.md) and
[finished-canvas sampling](../assets/15-composed-border/README.md) retain exact
source/support corrections. [Whole-chain pointer alpha](../assets/15-pointer-alpha/README.md)
proves clip/track/nested-group/output geometry across both canvases with shifted
and missing-pointer negatives. [Pointer lifecycle](../assets/15-pointer-lifecycle/README.md)
retains replacement/reset/rollback, padded holds, trimming, immutable history,
undo/restore and exact combined-worker PNG checks.

[Opaque output-stage geometry](../assets/15-output-geometry/README.md) verifies
pictures, full/range movies, export and unchanged narration on both canvases.
[Fresh product-skill use](../assets/15-pointer-skill/README.md) proves discoverable
public operation. The [acceptance audit](../assets/15-acceptance-audit/README.md)
links the original findings to their subsequent proofs; the
[complete encoded cohort](../assets/09b-encoded-appearance/README.md) and fresh
visual critique support the scoped disposition above.

The invalid flattened-source oracle, strict color failures and writer/decoder
localization remain in [their original research leaf](../assets/15-pointer-chain/README.md).
They are not silently repinned. Animated transforms, speech quality, continuous
playback and scale remain outside this static geometry slice's acceptance.
