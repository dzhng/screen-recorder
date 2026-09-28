# 16a — Scalar curve compiler primitive

Status: implemented and verified as an in-process compiler prerequisite; public/native activation remains in 16. Dependencies: [01](./01-composition.md), [03c](./03c-processing-stacks.md).
Consumer [16](16-keyframes.md) still depends on retiming and layer geometry.

## Contract

Composition owns scalar key validation, interpolation and exact project activation
windows. Integer content/project keys and reduced normalized clip keys follow
[the curve contract](../contracts.md#visual-and-audio-parameters). The outgoing key
owns hold, linear or cubic Bézier easing; endpoints clamp within active windows.
No parameter values are returned outside the anchor or across acquisition gaps.

`createCompiler(...).curve(curve, anchor)` resolves the existing anchor and source
clock once. Its sample function returns a scalar or null outside activation. Its
restriction function intersects exact project windows while retaining the complete
original function and clock. Splitting at a fractional boundary therefore cannot
restart easing or replace a cubic with a straight line. This is the in-process
compiler seam for slice 16 parameter compilation, not a native wire format.

This pass does not add curve fields to the processing registry, advertise runnable
animation, or change persisted compositions. Slice 16 consumes this seam for
processing parameters, exposes activation/key boundaries to inspection and binds
native execution with transport conformance and delivered-media journeys.

## Verification

Conformance tests through the compiler cover anchor-domain validation, outgoing
interpolation, clamping, cubic inversion including stationary x derivatives and
overshoot, exact fractional split/restriction, moved/retimed content, normalized
held/still clips, fixed project anchors and source-unavailable gaps. Existing
composition tests must remain green. Deliberately substituting linear interpolation
for cubic easing must fail the relevant tests before restoration.

The numerical execution contract is owned by
[the canonical program](16b-scalar-program.md). Tests use analytic cubic points and a 1e-10 absolute tolerance on unit-scale values;
exact key values and pure restriction comparisons remain exact. This tolerance is
for this in-process numerical seam, not an accepted native rendering tolerance.

The [retained verification](../assets/16a-curve-primitives/verification.json) records
149 passing composition tests, the expected failing cubic mutation, restored
focused/type checks and independent review without actionable findings. An added
still-image source control also passes. This closes only the pure compiler seam;
no delivered-animation or actual edit-reducer split claim is made here. Slice 16
must retain the original function/clock when authoring edits restrict its window,
then prove the resulting persisted edits and native output agree.
