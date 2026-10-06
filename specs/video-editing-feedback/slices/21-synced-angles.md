# 21 — Declare angle clocks

Status: partial — explicit angle-session declaration/removal, source/range validation, source-bound accepted-evidence admission, and compiler-level ordinary-placement switched-view replay are implemented; the sync estimator and delivered switched-view render remain open. Depends on: [20](20-sync-replication.md), [03](03-published-work-contract.md).

## Contract

Explicit source-session relationships let an agent switch synchronized cameras without conflating angle identity with audible speaker identity.

## Seam and ownership

Core source relationship metadata and existing exact placement/source projection. Existing syncGroups stays linked editing. [32](32-speaker-labeling.md) owns speaker name bindings and labeled transcript views; angle metadata does not duplicate those facts.

Current owners and starting checks:

- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [packages/composition/src/source-projection.ts](../../../packages/composition/src/source-projection.ts)
- [packages/core/src/speaker-evidence.ts](../../../packages/core/src/speaker-evidence.ts)
- [packages/core/src/source-speakers.ts](../../../packages/core/src/source-speakers.ts)
- [skills/yap/scripts/compact-transcripts.mjs](../../../skills/yap/scripts/compact-transcripts.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Add declaration of session origin, selected asset/streams, valid range and rational offsets referencing accepted sync evidence. The evidence receipt must carry an accepted status, generation/fingerprint, and exactly the declared member source identities; the origin member's offset is zero. `angle.declare` owns this relationship separately from linked-edit `syncGroups`; `angle.remove` removes it explicitly. Declare raw-source participants as relationship identities, not automatic audible-speaker assignments. Speaker display names and word attribution are owned by 32. Consumers plan ordinary placements; constant-offset declarations report drift/discontinuity as unsupported, not retime.

## Runnable checkpoint

Three-angle session declaration and switched-view ordinary edit. The composition
compiler checkpoint replays three explicit sequential camera placements and checks
the selected source in every frame; it does not claim native delivered-render
fidelity. Labeled dialogue is the later 32 checkpoint.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Wrong/foreign sync evidence, unlike session, changed raw offsets and microphone bleed. Preserve exact offsets/relationship identities through new-format packages/undo and per-occurrence reads. A camera participant does not automatically identify every audible voice.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

The composition checkpoint is green for explicit declaration, accepted source-bound evidence,
source identity/range validation, exact offsets and removal, plus ordinary-placement
compiler replay of a three-angle switch. It does not promote the failed waveform hypothesis in [20](20-sync-replication.md)
or claim a delivered switched-view render. A spike passes with a frozen accepted recipe/reference,
or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback
is not implementation completion.

## Delegated choices

Relationship representation and angle names. Angles/offsets remain explicit inputs; speaker naming is deferred to its single owner in 32.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

One clock mapping owner, no second timeline and no automatic identity inference or camera edit.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
