# 15 — Detect and track subjects explicitly

Status: partial — single-frame localization and a bounded retained-observation tracker are integrated; native multi-frame delivery/coverage evidence remains open. Depends on: [14](14-picture-statistics.md).

## Contract

Selected ranges expose face boxes and temporally associated tracks with gaps and ambiguity retained.

## Seam and ownership

Apple Vision over shared decoded frames; Core retained observation/jobs/cursors. Detection and association remain observation-local, separate from person identity.

Current owners and starting checks:

- [helpers/mac/Sources/YapFrames/README.md](../../../helpers/mac/Sources/YapFrames/README.md)
- [packages/core/src/frame-inspection.ts](../../../packages/core/src/frame-inspection.ts)
- [packages/core/src/source-index-processing.test.ts](../../../packages/core/src/source-index-processing.test.ts)
- [packages/test-harness/editing/source-evidence-fixture.mjs](../../../packages/test-harness/editing/source-evidence-fixture.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Return all faces and detector/OS recipe, top-left oriented coordinates, native scores and no-face/error state. Tracking retains sample times, association/occlusion gaps and scene resets. `trackFaceObservations` owns bounded adjacent-frame association from retained Vision rows; it preserves no-face gaps, marks close competing matches ambiguous, and never assigns a name or interpolates a box across an error/reset. First freeze single-frame localization, then temporal association as separate acceptance artifacts. Never silently select largest face or interpolate across unknown intervals.

Retain the accepted observation generation used to author a reframe. Replay renders
the saved explicit geometry; it never reruns Vision and substitutes new boxes as
the same recipe. Detector repeatability is measured separately from output replay.

## Runnable checkpoint

Annotated frames followed by moving/occluded/multiple-face track overlay and coverage report.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Orientation/edge faces, multiple faces, no detection, scene change, occlusion and tracker drift. Verify position with independently authored boxes/controls plus source comparisons, not only detector confidence. Missing-frame work is explicit.

Variable A: face localization, box masks. Variable B (after A passes): track continuity across same source window. Grade/reframe remain frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

The pure retained-observation checkpoint is green for movement, explicit no-face gaps and ambiguity. Native multi-frame acquisition, occlusion/reset coverage and visual overlay evidence remain open. A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Tracker sampling/association thresholds after replication, frozen with cost and gap limits; no named-person inference.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Decoded picture recipe and exact timestamps remain green. No downloaded face model or second frame decoder.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
