# 19 — Match selected dialogue and expose makeup gain

Status: complete; public real-speaker matching, strict master and scoped review verified. Depends on: [04](04-wait-and-json-delivery.md), [18](18-reliable-mastering.md).

## Contract

An agent can request clip-level matching and author explicit gains without hand-calculating every source level.

## Seam and ownership

Task-side/pure proposal over measurement receipts; existing gain/compressor/normalization schema/executor owns audio behavior.

Current owners and starting checks:

- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [apps/service/src/audio-processing.ts](../../../apps/service/src/audio-processing.ts)
- [apps/service/src/loudness.test.ts](../../../apps/service/src/loudness.test.ts)
- [packages/core/src/audio-processing-evidence.test.ts](../../../packages/core/src/audio-processing-evidence.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Caller selects clips, target, bounds and peak policy. Return per-clip measurements/gain proposals with short/unmeasurable exceptions and pinned occurrences. Apply only through explicit edit revisions. Expose compressor makeup in the existing recipe rather than a hidden service post-gain. Keep dialogue matching distinct from full mix/master and music masking.

## Runnable checkpoint

Real different-speaker clips matched with before/after bounded audio, makeup settings and master measurements.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Quiet/peaky speakers, silent/too-short clips, retimed occurrences, source gaps and repeated clips. A global LUFS pass cannot hide a quiet host. Verify ordered processing and no source mutation.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Proposal UI/helper shape and measurement grouping preserving selection. No universal -20 LUFS policy beyond fixture brief.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Explicit scope, processing order and same prepared-domain execution remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.

## Materialized checkpoint

The pure [dialogue helper](../../../skills/yap/scripts/dialogue-proposals.mjs)
consumes delivered processed-clip loudness JSON and preserves exact occurrence,
revision, range, recipe and audio-generation pins. Caller targets/bounds/peak
policy remain explicit; refused selections have no gain draft. A capped peak
proposal reports that its loudness target is unmet. New drafts omit engine IDs;
caller appends explicitly to the whole existing stack. Predictions describe only
the measured selection, not every clip sample or the mix.

Optional compressor makeup is post-compression dB in the existing recipe; omitted
means unity and bypass remains dry. [Evidence](../assets/19-dialogue-matching/README.md)
records native red/green scaling, two real processed-speaker matching via the
public CLI, preserved ordered compression and complete independently measured
strict mastering. No source mutation, automatic edits or second processor owner.
