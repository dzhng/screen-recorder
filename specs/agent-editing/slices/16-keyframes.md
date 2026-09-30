# 16 — Keyframes and convenience zooms

Status: opacity and every numeric geometry field have scoped public PNG, edit-preservation and fresh visual evidence; matched encoded samples preserve trajectory/clocks with documented edge/color loss; [muted offscreen continuous playback](../assets/16-continuous-playback/README.md) is verified; physical display and perceived smoothness are not inferred. Opacity retained-index boundaries are verified. Unit-rate gain has scoped public PCM/edit evidence; explicit fade/zoom conveniences have scoped public delivery evidence; [unit-rate denoise transitions](15a3b-denoise-transitions.md) are verified; delivered retime+gain and full-slice journeys stay open. Dependencies: [14](./14-retiming.md), [15](./15-layer-geometry.md), [16a](./16a-curve-primitives.md), [16b](./16b-scalar-program.md).

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

## Convenience transition expansion

`fade` and `zoom` are reducer conveniences inside the existing atomic edit batch.
They append one ordinary processing step at the addressed target and return the
complete resulting stack through the existing normalized change receipt. They do
not persist a macro or create another mutation/storage owner. Existing steps and
their order remain intact; later get/set can edit, move or bypass the expanded step.

Both take an explicit `window` using the existing anchor, scalar `from` and `to`,
and optional outgoing `interpolation` (linear by default) and step `label`. The
two generated keys occupy the anchor's start and end in its existing domain:
source microseconds, project microseconds or clip fractions. The second key is
hold. Outside the half-open window the step is dry; within it the ordinary curve
rules apply. A fade 0→1 over a clip's full normalized [0,1] smoothly enters; a
fade 1→0 over [3/4,1] leaves at the clip end. A fade 1→0 over [1/4,1/2] returns
to dry gain/opacity one at 1/2: that explicit temporary window is not a request
to mute the rest of the clip. Agents needing a held terminal value use ordinary
keys over a larger window. No implicit pre-roll, post-roll or smoothing is added.

`fade` requires `mediaKind: "audio" | "video"` to choose gain or opacity,
including at mixed output targets. Gain is linear amplitude, opacity linear alpha;
their existing full-curve domains remain authoritative. A crossfade is two
explicit fades in one atomic batch on already overlapping tracks; the engine does
not create overlap, choose curves, attenuate other tracks or normalize the result.

`zoom` generates equal x/y scale curves. Its optional `geometry` exposes the
existing typed geometry settings other than scale/type: crop, rect, fit, pivot
and rotation. Omission uses existing geometry defaults; it never rewrites an
earlier geometry step. Geometry still consumes the preceding image in stack order,
so a caller choosing a crop must account for that domain. Nonuniform or independently
keyed scale remains available through ordinary `processing.set`.

[Convenience evidence](../assets/16-conveniences/README.md) owns the scoped public
CLI/MCP/native journeys and remaining acceptance. Whole-microsecond endpoints are
required for project/content convenience windows because ordinary curve keys in
those domains use integer microseconds. Fractional activation remains available
with ordinary processing keys; the macro does not round an endpoint.

The public gate compares macro media against independently authored ordinary edits,
including dry neighbors, interior samples, target compatibility, exact receipts,
split/trim/move, bypass and ranged output. Crossfade controls must distinguish
alpha-over composition from summed audio amplitude. This convenience pass does
not establish denoise wet/dry transitions, retimed PCM, or complete slice16 readiness.


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
identities before advertising this vertical as ready. Geometry consumers below
share this timing owner; gain uses the numerical execution seam below.


The [opacity evidence](../assets/16-opacity/README.md) retains exact public PNG
controls/split preservation, scoped movie comparisons, static-layer preservation,
failed attempts and reviews. [Retained-index integration](../assets/16-opacity-index/README.md)
now proves tap-aware boundary selection, direct/retained PNG equality and fresh
visual review. The service/native projection is shared with direct worker harnesses;
no authoring easing is sent for native reinterpretation. Gain has its own delivery
gate below; denoise transitions and full-slice journeys stay open.

## Animated zoom vertical

Geometry scale x/y accepts the same typed number-or-Curve values as opacity. Scalar slots
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
and full/range preview/export correspondence. Position and rotation use the same
owner below; gain and explicit conveniences have their own scoped gates.


The [zoom evidence](../assets/16-zoom/README.md) retains 39 exact public PNG checks,
166 passing composition tests, static/opacity preservation and independent code
review. Root reproduces all 39 PNGs exactly; the original fresh visual review recorded movie
edge fringes and darker gray. The later [matched encoded checkpoint](../assets/16-animated-appearance/README.md)
adds color-managed review, exact packet clocks and discriminating trajectory negatives. Direct PNG versus encoded movie maximum
channel error reaches **240** despite passing the inherited mean-RGB membership
criterion; strict encoded color/edge parity is not claimed. The [writer probe](../assets/16-zoom/writer/README.md)
localizes these differences after matching pre-append pixels, without selecting an
encoding/decoding cause or production quality profile.
Full/range movie membership and exact preview/export bytes do not establish strict
color parity. This scoped zoom pass does not close full slice 16.

## Animated position and rotation vertical

Rectangle x/y and clockwise rotation accept the same number-or-Curve contract as
scale. Their existing units, pivot and transform order remain authoritative; there
is no additional translation object. Each scalar uses the same step window and
retained clock, but keeps its own curve program. Full-curve values must stay finite,
and sampled geometry still passes the numeric compiler's existing precision checks.
The remaining crop/dimension/pivot fields share that clock as described below.
Gain and explicit conveniences have separate scoped evidence; denoise transitions remain open.

[Public pose evidence](../assets/16-pose/README.md) retains exact animated/static
frames and move/split/trim/window preservation, plus independent pivot/angle
landmarks that reject a deliberately swapped coordinate. Encoded edge/color limits
remain explicit. Fresh scoped geometry review and independent code review pass;
the later matched encoded checkpoint retains and reviews movie edge/color loss.

## Complete geometry scalar domains

Crop coordinates and dimensions, rectangle dimensions and pivot coordinates now
use the same clock and retained scalar programs as position/scale/rotation. Keep
each field's static domain across the whole curve, including cubic extrema:
strictly positive dimensions, normalized pivots in [0,1], and finite coordinates.
There is no new inside-source/inside-canvas requirement: static geometry admits
outside rectangles and its sampled numeric compiler remains responsible for joint
matrix representability. Do not clamp an invalid curve or defer scalar violations
until one preview happens to sample them.

[Geometry scalar evidence](../assets/16-geometry/README.md) owns the public
combined-geometry journey, independent corner/pivot controls and rejection of cubic
interiors with otherwise legal endpoints. Public delivery and independent code
review pass; fresh scoped geometry review and the later matched encoded checkpoint
retain measured movie edge/color loss. All 64 public static tap PNGs retain prior bytes. Tiny-coefficient
extrema normalization rejects subnormal interior-zero sizes; final public
confirmation preserves every reviewed picture and verifies seven curve refusals.
Gain and explicit conveniences have separate scoped evidence; this is not whole-slice16
acceptance.


## Ordered gain delivery

Gain accepts the same number-or-Curve shape and step activation window as the visual
parameters. A gain curve must remain nonnegative and within native Float32 gain
bounds across its full value function, including cubic interior extrema. There is
no automatic normalization, ducking, clipping or smoothing of authored hold jumps.

The inspection manifest retains authored settings. The execution window lowers
audio steps through the same temporal owner into numeric scalar programs and
half-open sample activation spans. Activation floors exact endpoints using the
existing PCM clock; key selection uses ceil. The first active sample can precede
a fractional cut, so its value phase still comes from the original curve rather
than clamping to that cut. The [canonical program](16b-scalar-program.md) owns
numerical execution and its finite-domain contract.

Native evaluates one gain per global PCM frame, applies it equally to both channels
at the existing ordered clip/track/group/output stack position, and uses dry gain
one outside activation. Whole-target constant gain retains its existing Float32
loop. Native has no author anchors, handles or interpolation labels to reinterpret.

The live gain journey must verify linear/cubic/hold envelopes, exact sample counts
and channel layouts, every target scope, bypass and taps, fractional activation,
full/range equality, move/split/trim preservation, whole-curve refusal and movie
preview/export wiring. Compare an independent analytic envelope and source PCM,
not merely another render through the same compiler. Measure actual mixer cost and
preserve the constant baseline. Retimed phase is checked through the edit reducer;
delivered retime+gain PCM is the current follow-up now that14 is verified.
Replace the obsolete NOT_READY harness expectation with complete preserve/follow
PCM against independent analytic envelopes for normalized/content/project clocks.
Retain fractional activation, full/split/range equality and unchanged duration.

The remaining visual journey uses moving counter footage through move, retime and
split, with a fixed project-anchor control and complete encoded-frame trajectory
checks. A separate bounded muted AVPlayer probe must observe actual playback
progress and completion. Decode-only evidence cannot close that gate; muted
execution does not establish human-perceived smoothness or audio quality.


The [gain evidence](../assets/16-gain/README.md) retains actual debug/release native
PCM journeys, independent envelopes, deliberate wrong-phase failure, constant-path
preservation and bounded mixer-cost measurements. The final release journey also
checks movement to a fractional sample boundary. Independent code review is clean.
The broad core runs encountered wall-clock timeouts; each remaining affected case
passed unchanged in isolation, with those separate results retained explicitly.

[Combined-root gain confirmation](../assets/16-gain/root-integration.json) passes
all17 public checks with a fresh native build and exact retained release PCM
hashes. Prepared-audio and gain tests pass together; the [fresh animated-gain consumer](../assets/16-gain-skill/README.md) now verifies
explicit linear-window authoring, complete PCM comparison, exact split preservation,
replay and wrong-clock refusal. Its limited numerical usability check does not
replace existing conformance or establish listening/retimed-audio acceptance.
