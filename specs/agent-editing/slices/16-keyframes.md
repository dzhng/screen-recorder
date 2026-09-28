# 16 — Keyframes and convenience zooms

Status: opacity authoring, scoped native delivery, tap-aware retained-index boundaries and fresh visual review verified. Animated geometry, gain, transitions and remaining full-slice journeys stay open. Dependencies: [14](./14-retiming.md), [15](./15-layer-geometry.md), [16a](./16a-curve-primitives.md).

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


## First delivered vertical: opacity timing

The verified opacity vertical adds opacity curves and optional step `window` through the existing
processing stack lifecycle. `opacity` accepts a number or the contracted Curve.
A clip without an explicit window uses normalized clip time; nonclip curves use
project microseconds. Content and normalized windows must reference their own
clip. Other processors continue to reject windows until their timing is supported.
Opacity curves are validated over their complete cubic value extrema, not only
keys, so an overshoot outside [0,1] is rejected rather than silently clamped.

A step may retain `evaluationRange: {start: Fraction, end: Fraction}` for normalized
clip timing. This records the portion of the original clip clock represented by
the current clip. For example, after a halfway cut the two pieces retain [0,1/2]
and [1/2,1], preserving their entire original curve and normalized activation
window. Structural edits derive these fractions from the existing partitioner's
exact original/retained ranges. No second placement resolver or source timeline is
introduced. Get/set exposes the complete retained range. Whole-target constant
steps do not acquire a redundant range.

Content windows keep source coordinates and intersect the selected source range;
project windows remain fixed. Duplicates remap clip-local references. Replacement
preserves normalized/project settings, rejects old-source windows unless repaired
or reset, and partitions normalized evaluation ranges over hold/silence padding.
Pure split/trim must preserve both the original function and active subwindow.

`createCompiler.processingBoundaries(tap)` exposes exact activation and key
boundaries from the same curve programs that sample opacity. Retained-index
consumers use this seam; they must not implement their own key/anchor math.
Picture compilation resolves opacity at the existing global picture timestamp and
emits the unchanged numeric opacity primitive. Native performs no authoring-curve
interpretation, no new frame clock and no duration-sized sample arrays. Native
integration must prove delivered frame/full-preview/range parity and update recipe
identities before advertising this vertical as ready. Gain and animated geometry
remain subsequent consumers; this pass does not close full slice 16.


The [opacity evidence](../assets/16-opacity/README.md) retains exact public PNG
controls/split preservation, scoped movie comparisons, static-layer preservation,
failed attempts and reviews. [Retained-index integration](../assets/16-opacity-index/README.md)
now proves tap-aware boundary selection, direct/retained PNG equality and fresh
visual review. The service/native projection is shared with direct worker harnesses;
no authoring easing is sent for native reinterpretation. Animated geometry, gain,
transitions and remaining full-slice journeys are next.

## Animated zoom vertical

Geometry scale x/y accepts the same typed number-or-Curve values as opacity;
crop, rectangle, rotation and pivot remain numeric in this pass. Scalar slots
share one step clock, activation window and retained evaluation range. Validation,
edit restriction and temporal-boundary discovery consume the same closed slots;
there is no generic user-facing parameter-path language. Scale retains the existing
finite signed contract, including zero collapse and negative mirroring. Whole-curve
extrema must remain finite; every emitted matrix still passes the existing exact
geometry compiler's finite/safe-number checks. No clamping repairs invalid values.

At each existing global picture timestamp the compiler resolves the numeric scale,
then calls the unchanged geometry compiler. Outside the step's activation it skips
that processor; remaining baseline contain behavior remains unchanged. Native
metadata carries geometry's type/identity only, while numeric matrices and coverage
primitives carry execution. The shared native-boundary projection and recipe IDs
advance together. This pass's public `keyframes.mjs --case moved-split-zoom` journey
must prove actual zoom, exact static controls, movement, split/trim, window activation
and full/range preview/export correspondence. Position/rotation/gain curves and
convenience commands remain explicit unfinished consumers in full slice 16.


The [zoom evidence](../assets/16-zoom/README.md) retains 39 exact public PNG checks,
166 passing composition tests, static/opacity preservation and independent code
review. Fresh visual acceptance is pending. Direct PNG versus encoded movie maximum
channel error reaches **240** despite passing the inherited mean-RGB membership
criterion; encoded color/edge parity remains unresolved, with no established cause.
Full/range movie membership and exact preview/export bytes do not establish strict
color parity. This scoped zoom pass does not close full slice 16.
