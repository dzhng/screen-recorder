# 26 — Apply an explicitly imported LUT

Status: planned. Depends on: [25](25-tone-controls.md).

## Contract

Immutable LUT bytes can be an explicit retained dependency of a grade.

## Seam and ownership

Asset admission/metadata and existing processing dependencies; native shared picture executor.

Current owners and starting checks:

- [packages/core/src/assets.ts](../../../packages/core/src/assets.ts)
- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)
- [packages/core/src/portable-assets.test.ts](../../../packages/core/src/portable-assets.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replicate and freeze a bounded .cube format with domain/size/interpolation/color assumptions. Import bytes by identity, retain through undo/package, and apply an explicit ordered LUT step. Identity LUT must reproduce dry pixels. Refuse malformed/unknown transforms; no ambient global LUT lookup.

## Runnable checkpoint

Identity and independently known numeric LUTs plus real-shot output and relocated-package read.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Malformed grid/domain, unsupported size, missing bytes, ordering, alpha, relocation and declared color interpretation. Byte identity and interpolation parity are distinct from a pleasing grade.

Variable: LUT color response. Mask: chart patches/declared face/neutral zones; other treatments frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Bounded supported grid size/interpolation after reference reproduction; freeze before public schema. No generalized raw filtergraph.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Immutable dependency retention and source integrity; current output interpretation remains correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
