# 15 — Layers, crop and pointer geometry

Status: compiler/native geometry, [public static layer delivery](../assets/15-layer-public/README.md) and [processed split delivery](../assets/15-layer-edits/README.md) verified; [native evidence](../assets/15-layer-geometry/README.md). Pointer adoption, remaining edit-operation journeys and wider visual/profile acceptance remain open. Dependencies: [09](./09-first-preview.md).

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

The [public delivery checkpoint](../assets/15-layer-public/README.md) runs the
same independent geometry oracle through actual CLI/MCP project editing,
frame taps, bounded previews and full exports. Source removal and project lifetime
checks exercise owned media rather than stale catalog rows. Pointer adoption and
wider output profiles remain separate acceptance gates.

## Source-attached pointer contract

Pointer is an ordinary ordered clip processor `{type: "pointer", trailUs}`.
The integer source-time duration is explicit, from zero through ten seconds;
zero draws the current eligible pointer, positive values also draw history.
Composition owns that authored limit and core's trail policy consumes it; scene
analysis and execution work budgets stay with their existing core owners.

Registry-owned target compatibility restricts pointer to video clips with an
explicit acquisition binding. Missing acquisition rejects authoring and preserved
replacement atomically, including disabled steps; explicit processing reset can
remove the incompatible step. A present acquisition with unavailable cursor or
geometry observations produces a readiness diagnostic, never invented evidence.
Combined targets have no unique source authority and must reject this processor;
do not silently distribute a parent step to children.

Allow pointer at any clip-stack position. Its compiled operation references only
backward indices of already-compiled geometric primitives, retaining rasterization
boundaries and excluding previous opacity/pointer operations. Rasterize source-local
pointer pixels, replay that same geometric prefix through the shared primitive
executor, composite them at this step, then apply remaining operations normally.
Opacity before pointer affects earlier imagery; opacity afterward affects both.
No second native crop/fit/anchor interpreter or recursive overlay graph is allowed.

History comes from immutable acquisition/stream support rather than a clip's
trimmed source start. A trail can therefore include capture immediately before the
portion selected for playback. Pure split/trim/move/duplicate preserve that source
history; retime changes the sampled source instant and hold freezes its pointer
and trail age. Pause, geometry, scene, unknown/outside cursor and physical gaps
still reset history through the existing eligibility owner. Replacement resolves
the replacement binding's history, never copies observations from the old source.

Use the existing exact presentation-evidence writer and reader with explicit
selected asset/stream and source-history bounds. Generalize first-track/legacy
revision assumptions at that owner; do not fabricate recording revisions or use
nearest-picture inspection. Exact intervals supply the compositor's actual sample
and physical-gap reset floors. A continuity boolean between coarse scene probes
cannot locate a short gap. Source-local glyph sizing then follows the same geometry;
there is no independent thumbnail compensation.

Implementation checkpoints remain separate: (1) schema/registry/compiler references
and atomic compatibility tests, execution unbound; (2) queued exact preparation,
shared native replay, provenance/cache identity and overlay allocation admission;
(3) independent transformed masks, resets/emptiness, repeated/retimed/held uses,
pure-edit invariance, actual CLI/MCP preview/export and fresh visual review.

Preserve legacy API defaults and event schedules. Their stills default to two
seconds while movies show pointer-only event states, so new projects require an
explicit duration. Project output retains its fixed compiler frame clock. Compare
legacy/project pointer state at identical compiler-selected source instants and
physical sample support; do not claim whole-file identity across distinct schedules.
Preparation must bound/cancel records, bytes, observations and output-occurrence
work; exhausted or damaged evidence publishes nothing. Existing guards remain
provisional until slice 24 measures release-scale behavior.

Checkpoint 1 now has [authoring/compiler evidence](../assets/15-pointer-contract/README.md):
registry-owned scope/acquisition compatibility, atomic replacement rules, complete
backward geometry references and pure-edit identity retention. Execution remains
unbound; exact source-history preparation and native replay are the next checkpoint.
