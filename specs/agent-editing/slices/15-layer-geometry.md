# 15 — Layers, crop and pointer geometry

Status: compiler/native geometry checkpoint verified and under final review; [evidence](../assets/15-layer-geometry/README.md). Pointer adoption, public journey integration and wider visual/profile acceptance remain open. Dependencies: [09](./09-first-preview.md).

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
## Authoring and compiled geometry checkpoint

Use one `geometry` processor with optional `crop` and `rect` rectangles
(`x`, `y`, `width`, `height`), `fit` (contain/cover/stretch), `scale` (`x`, `y`),
`rotationDeg` and normalized `pivot` (`x`, `y`). Defaults mean full preceding
image domain, full project canvas, contain, unit scale, zero rotation and center
pivot. Positive rotation is clockwise in top-left coordinates. Fit into a local
rectangle, apply scale/rotation around its pivot, then translate by `rect.x/y`;
there is no second equivalent position control. Opacity is a separate ordered
`{type: "opacity", opacity}` step with values from zero to one.

Composition compiles crop/fit/placement into sampling clamps, affine transforms
and bounded destination polygon coverage;
the native executor never interprets authoring geometry. Clip input dimensions
are the oriented dimensions already established by media probing. Each geometry
step ends on a fixed transparent canvas; opacity before the first geometry still
operates in source space. A source-space clip stack gets one final baseline
contain. Track/group inputs flatten before parent effects, preserving nested
opacity; final background appears before output processing only.

Project frame receipts retain every selected layer's physical provenance in
`pictures` order. Empty stacks preserve existing raster evidence except the
explicitly demonstrated source-edge correction below. PNG output
retains any post-output-stack alpha. The current opaque H.264 profile must refuse
nonopaque final pixels explicitly rather than silently fill a background after
the output stack. That refusal is a checkpoint limitation, not closure of full
output-scope/export acceptance. Source-attached pointer rasterization joins in
the subsequent checkpoint before the same compiled transforms.

### Crop coverage seam

Source sampling and geometric support are separate. Core compiles a source
sampling clamp, affine placement and destination polygon. The native worker
rasterizes only those polygon coordinates on the bounded output canvas. Cropping
must exclude colors outside the admitted sample region; scaling a crop must not
blur its geometric alpha merely because an intermediate texture has a boundary.
Subsequent authored geometry may resample the preceding fixed canvas as an
intentional stack stage. A compiler-emitted rasterization primitive makes that
stage explicit; it does not authorize native fit/placement decisions.

The previous CI crop/affine experiment is not accepted: its boundary alpha
changed with downstream composition and output ROI. Required holdouts now include
explicit default geometry, full-domain and fractional crop, rotated crop,
outside-color poison exclusion and grouping invariance. Point-in-polygon tests
alone cannot judge fractional pixel coverage.

A shared source-sampling correction is justified independently: frozen native
rendering of an opaque white source over white produced a dark fringe (minimum
225); clamping encoded samples to pixel centers before the existing orientation
raised the minimum to254, the decoded white. Changed pixels are retained in
`/tmp/screenrec-source-edge-white/report.json`. This narrowly corrects an incorrect
baseline; it is not a legacy/layer compatibility mode. Source stills, legacy
recording frames/movies, composition frames/movies and derived scene evidence all
inherit this owner and need new renderer/cache policy identities at integration.

The earlier36-case/80-frame matrix passed its then-current raster-mask reference,
and fresh blind inspection confirmed the old white fringe and clean corrected
control. The added full-domain crop holdout exposed that reference's incorrect
transparent-edge model. Preserve these attempts as research evidence, not slice
acceptance. The destination-coverage variant passed the expanded matrix and fresh
visual review; current commands and evidence live in the linked checkpoint.
Public preview/export and pointer gates remain open.

The compiler/native checkpoint also bounds aggregate encoded-source area,
materialized canvas area and live coverage-mask bytes before allocation. Inactive
clip taps are transparent without opening a reader. Their native red/green and
smaller-request recovery evidence is linked in the checkpoint; these provisional
bounds do not close slice24 scale acceptance.
