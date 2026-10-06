# 27 — Author reusable crossfade/dip/flash recipes

Status: partial — public composition lowering and a native delivered crossfade picture/preview receipt are green; dip/flash, audio delivery and visual critique remain open. Depends on: [06](06-exact-removal.md), [24](24-blend-modes.md).

## Contract

Explicit transition requests lower to the ordinary graph and expose required overlap/support.
`edit.apply` now accepts `transition` recipes for crossfade, dip and flash. A
crossfade names two distinct targets and creates opposing gain/opacity ramps;
dip and flash name one target and create a bounded three-point pulse. The
recipe never adds media, retimes a clip or reaches outside its supplied window.
Dip/flash project and source anchors use whole-microsecond endpoints with an
even midpoint; clip anchors retain exact fractions. The native rendering path
still treats these as ordinary alpha/gain curves, so the canvas/background or a
caller-selected overlay determines the visible dip/flash color.

## Seam and ownership

Composition convenience edit lowering, opacity/gain curves and shared compiler/executor. Use existing primitives before introducing new ones.

Current owners and starting checks:

- [packages/composition/src/edits.ts](../../../packages/composition/src/edits.ts)
- [packages/composition/src/curve.ts](../../../packages/composition/src/curve.ts)
- [packages/composition/src/compiler.ts](../../../packages/composition/src/compiler.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Caller supplies participants, exact window/duration, media plane and curve. Provide crossfade, dip and flash recipes, one separately verified at a time. SFX is an optional caller-selected asset/placement, never generated/acquired implicitly. Insufficient handles or required overlap returns explicit constraints; no hidden retiming or unrelated audio fade.

## Runnable checkpoint

The focused composition checkpoint is
`packages/composition/src/convenience.test.ts`; it records opposing ramps,
three-point pulses and the explicit midpoint refusal. A delivered transition
receipt in [crossfade evidence](../assets/27-29-transitions/crossfade/README.md)
now proves one explicit picture crossfade through public import, authoring,
native frame reads and preview export. Dip/flash, audio and final visual critique
remain required before this slice is promoted to a complete native verdict.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Exact start/end, one-frame duration, insufficient handles, independent A/V, alpha and no-gaps. Verify rendered samples/audio landmarks, not only authored keys. No constant-brightness/loudness claim unless independently established.

Variable: each transition's continuity. Mask: its window/perimeter; grade/captions/music design frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Reversible default parameter examples and lowering organization. Media selection and handle policy explicit.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

One renderer/clock, undo and source support; no unrequested transitions outside window.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
