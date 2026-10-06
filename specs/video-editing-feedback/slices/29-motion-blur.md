# 29 — Add bounded blur to authored motion

Status: public/native bounded delivery, matched moving-delivery evidence and cost receipt are implemented. The appearance repair now has a one-pixel envelope against an unblurred authored-trajectory control; strict reference-conditioned parity remains open. Depends on: [28](28-whip-zoom-trajectory.md).

## Contract

Requested motion blur samples one existing authored phase with explicit shutter/cost bounds, rather than creating another motion engine.

## Seam and ownership

Native picture executor consuming composition temporal phase/sample support. A dedicated bounded processor is justified only by replicated missing blur execution.

Current owners and starting checks:

- [packages/composition/src/temporal-processing.ts](../../../packages/composition/src/temporal-processing.ts)
- [packages/composition/src/compiler.ts](../../../packages/composition/src/compiler.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)
- [packages/test-harness/editing/keyframe-appearance.mjs](../../../packages/test-harness/editing/keyframe-appearance.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replicate shutter/temporal samples against frozen trajectory. Declare sample count/shutter interval, required source support and edge behavior. Freeze deterministic recipe and observed render cost; refuse unavailable neighbors rather than reaching outside admitted media. Static and bypass identity remain dry.

## Runnable checkpoint

Matched trajectory blur reference/candidate frames plus short moving output and retained cost report.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Preview crop beginning mid-motion, source edges, cut boundary, repeated/retimed occurrence, deterministic still/movie parity and bounded frame work. Freeze blur appearance separately from trajectory.

Variable: blur appearance. Mask: moving edge at frozen trajectory; path, color and captions out of scope.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. The current receipt proves the public/native seam, bounded four-sample work, delivered opacity and measured local cost. The repaired receipt proves the candidate stays within a one-pixel visible envelope against the same authored trajectory; the fresh critique found no displacement, clipping or transparency defect. The independent [moving reference-parity audit](../assets/27-29-transitions/reference-parity/report.json) remains red for the transition control, so strict reference-conditioned blur/trajectory parity remains open. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Sampling count/shutter defaults selected from replication with explicit cost/quality basis, no unchecked unlimited samples.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

No new clock/backend, no hidden source handles, and identical phase across outputs.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
