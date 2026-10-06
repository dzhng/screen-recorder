# 28 — Make whip/zoom motion preserve coverage

Status: composition checkpoint implemented; delivered trajectory/perimeter evidence remains open. Depends on: [27](27-basic-transitions.md).

## Contract

Explicit whip/zoom transition trajectories do not expose accidental black seams or silently crop prohibited content.

## Seam and ownership

Existing geometry/scalar curves and picture evaluation; reuse transition lowering and exact clock.

Current owners and starting checks:

- [packages/composition/src/geometry.ts](../../../packages/composition/src/geometry.ts)
- [packages/composition/src/geometry-temporal.test.ts](../../../packages/composition/src/geometry-temporal.test.ts)
- [packages/composition/src/visual-plan.ts](../../../packages/composition/src/visual-plan.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replicate selected trajectory on asymmetric authored input. Freeze direction/pivot/duration, overlap, overscan/edge policy and source-handle requirements. Coverage failures return constraints rather than invent hidden samples. Motion blur is deliberately frozen off until slice 29.

## Runnable checkpoint

Frame-indexed trajectory/perimeter report and short real-camera motion clip.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Opposite directions, rotations, tiny windows, retime, canvas changes and missing handles. Track source membership/perimeter and exact sample times; no hard black gap at intermediate frames.

Variable: trajectory/coverage. Mask: full perimeter and moving subject; blur/color/text frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Trajectory easing within frozen reference and declared coverage constraints.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Shared geometry clocks and no implicit crop/source extension remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
