# 15 — Detect and track subjects explicitly

Status: partial — complete native sampled-window delivery, planted controls, retained association and landmark-coverage evidence are verified; the frozen full-face localization gate fails 27 Graham occlusion/pose frames and remains open. Its retained failure is now an executable replay gate that recomputes the frozen IoU/center evidence without widening boxes. Separate revision-1 and revision-2 detector experiments are replayable and refused after the same nine remaining IoU failures plus static raster drift. Depends on: [14](14-picture-statistics.md).

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

Each face may also carry the landmark groups Vision actually returned and a
`core`/`partial`/`unavailable` coverage state. This is a bounded quality signal,
separate from detector confidence: `core` means the required landmark groups were
observed, not that a complete head silhouette was recovered. A missing or partial
landmark result therefore remains visible to callers and cannot silently widen a
rectangle or authorize a crop.

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

The retained-observation and native delivery checkpoints are green for exact sampled clocks, movement, multiple/edge/oriented faces, explicit no-face gaps, scene/provider resets and ambiguity. The [retained evidence](../assets/15-face-observations/README.md) and its [failure audit](../assets/15-face-observations/failure-audit.json) keep the red full-face overlap gate separate: 27 Graham hand/pose frames do not satisfy it even though all centers remain inside the authored region and the landmark-aware replay reports core groups on the contracted boxes. The [face-localization replay](../../../packages/test-harness/editing/face-localization-replay.mjs) recomputes those failures and refuses edited boxes, thresholds, source bindings or promoted status. The executable revision probe replay also binds refused Vision revisions 1 and 2; each leaves nine late frames below the unchanged gate and fails the frozen crop-center raster identity check. An independent landmark-envelope probe maps contour points back through the detector rectangle and fails all 72 frames, retaining the visible-face versus complete-head distinction without widening boxes. Do not certify full-face localization from continuous association, native confidence or landmark-group presence. A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Tracker sampling/association thresholds after replication, frozen with cost and gap limits; no named-person inference.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Decoded picture recipe and exact timestamps remain green. No downloaded face model or second frame decoder.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
