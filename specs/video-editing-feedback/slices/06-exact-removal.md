# 06 — Remove exact fractional frame ranges

Status: planned. Depends on: None. This exact-clock contract uses independent authored rational/text/silence controls; it does not depend on inference or real-media certification.

## Contract

Structural removal preserves rational frame endpoints through ripple, linked edits and subsequent projection.

## Seam and ownership

Composition edit schema/reducer, rational partition/ripple/source projection. Reuse selectionRangeSchema and existing exact time arithmetic; no alternate frame timeline.

Current owners and starting checks:

- [packages/composition/src/edits.ts](../../../packages/composition/src/edits.ts)
- [packages/composition/src/partition.ts](../../../packages/composition/src/partition.ts)
- [packages/composition/src/ripple.ts](../../../packages/composition/src/ripple.ts)
- [packages/composition/src/source-projection.test.ts](../../../packages/composition/src/source-projection.test.ts)
- [packages/composition/src/processing-state.test.ts](../../../packages/composition/src/processing-state.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replace integer-only remove ranges with exact rational selections. Preserve surviving source endpoints, caption/attachment support and processing/animation phase. Retain unrelated integer point-control contracts unless this removal requires a named change. Delete old rounding consumers in the same pass.

## Runnable checkpoint

Pure/public edit receipt for one 24fps frame and 30000/1001fps boundaries, with independent expected surviving memberships.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Overlapping selections, adjacent ranges, retimes, linked A/V scope, caption words and existing curves must preserve exact mappings and undo. Use independent rational/sample controls; render only if native lowering changes.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Internal organization and generated control media. No rounding policy invention.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Placement, undo, linked editing and absolute animation/state domains remain unchanged except the explicitly broadened remove contract.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
