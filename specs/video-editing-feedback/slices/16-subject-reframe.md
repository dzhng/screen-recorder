# 16 — Author constrained subject geometry

Status: implemented geometric delivery — real host views, full source-perimeter masks, explicit conflicts, pinned hold motion and public split/repeat/retime are verified. Source full-face quality remains open in15. Depends on: [15](15-face-observations.md), [06](06-exact-removal.md).

## Contract

Explicit reframe requests create ordinary geometry around a selected subject while reporting infeasible centering/content constraints.

## Seam and ownership

Composition geometry/curve/edit owners consuming pinned face observations; native picture executor consumes ordinary compiled programs.

Current owners and starting checks:

- [packages/composition/src/geometry.ts](../../../packages/composition/src/geometry.ts)
- [packages/composition/src/geometry-temporal.test.ts](../../../packages/composition/src/geometry-temporal.test.ts)
- [packages/composition/src/edits.ts](../../../packages/composition/src/edits.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Caller selects track/subject, target point, zoom bounds, margins and preservation policy. Compute explicit geometry proposal and violations. Full-frame preservation uses contain/placement; crop requires explicit permission in the brief. Do not silently solve low-framed Lily by removing content. Missing/ambiguous tracks preserve declared hold/no-change behavior; curves use current absolute phase.

## Runnable checkpoint

Before/after real host views with visible source perimeter, target trajectory and zoom limits.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Low face plus zoom cap, movement, lost subject, retime/split/repeat, source corners and black-gap controls. Compare authoring geometry and delivered frames. Expose centering/preservation conflict rather than claim both passed.

Variable: framing. Mask: subject trajectory and full source perimeter. Freeze color/captions/audio; no grade judgment.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

[Delivered evidence](../assets/16-subject-reframe/README.md) separates accepted geometry from refused proposals and the source detector's red full-face gate. The [face-localization replay](../../../packages/test-harness/editing/face-localization-replay.mjs) keeps that upstream 27-frame failure bound to its retained boxes and zones. Partial or unavailable landmark coverage is surfaced as a framing violation while retaining the caller's explicit geometry proposal; no detector box is expanded to hide that uncertainty. Independent linear-light references pass all contain perimeter pixels under unchanged tolerance; the earlier encoded-space reference failure remains retained. Explicit unsmoothed hold curves, planted missing-observation hold and public occurrence operations preserve geometry.

## Delegated choices

Smoothing algorithm satisfying frozen bounds and reversible presentation of violations. Target/preservation choice belongs to caller.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

No source modification, no duplicated geometry clock and identical preview/frame/export evaluation.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
