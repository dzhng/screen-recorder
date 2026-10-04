# Generalized video segmentation proposal

Status: future proposal. A caller selects a person, object or region and obtains
a temporally consistent mask for the existing ordered processing stack. Person
cutouts are one use, not a separate person-only product. No model or runtime is
selected and this proposal does not authorize implementation.

## Why a mask is a separate primitive

Segmentation selects pixels; layer placement and creative intent remain the caller's
choices. A mask may reveal another layer without synthesizing missing background.
Soft hair, transparency and motion blur may require refinement beyond object
segmentation, so those quality claims must not be conflated.

Mask coordinates and timing must follow the [composition owner](../../packages/composition/README.md)
through crop, trim, split and retime. Preview, frame inspection and export consume
the same prepared result. Reuse existing model readiness, jobs, cancellation,
immutable identity and portable dependencies rather than creating a second renderer
or an automatically styled presenter mode.

## References and open decisions

The [visual brief](../presenter-effects/README.md) and
[reference audit](../done/agent-editing/assets/reference-style/README.md) establish
composite intent, not the creator's algorithm. [SAM 3](https://github.com/facebookresearch/sam3)
is a candidate mentioned by the user; local execution, availability, terms and
resource cost require a feasibility probe before selection.

When activated, choose supported prompts and correction scope, single versus
multiple-instance behavior, mask representation and ordered processor consumption.
Measure temporal state across occlusion, disappearance and scene changes as well
as moving-edge quality. Define prepared-output retention and regeneration so a
portable revision does not depend on an ambient model cache.

Cloud fallback, silent model substitution, a new editing UI and automatic subject
selection are not implied. Research the target Mac and actual current capabilities,
then turn unresolved seams into independently verifiable implementation slices.

## Acceptance meaning

Use supplied real video with both person and non-person subjects. Independent frame
marks and full-motion inspection must reveal missing subject pixels, background
leakage and flicker; static screenshots cannot establish temporal consistency.
[Verification principles](../../packages/test-harness/README.md) keep that quality
proof separate from ordered execution, bypass, undo, relocation, cancellation and
resource bounds. Establish measured gates when planning implementation rather than
claiming the reference itself proves feasibility.
