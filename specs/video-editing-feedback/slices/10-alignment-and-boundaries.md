# 10 — Publish alignment and acoustic boundary evidence

Status: planned. Depends on: [09](09-alignment-replication.md), [08](08-bounded-speech-preparation.md).

## Contract

Known supplied text can be aligned to selected PCM with unmatched tokens and measured edge context retained.

## Seam and ownership

Core alignment evidence using existing jobs/models/publication/pagination; service/native adapter for the accepted recipe. Acoustic observations share selected PCM.

Current owners and starting checks:

- [packages/core/src/models.ts](../../../packages/core/src/models.ts)
- [packages/core/src/audio-inspection.ts](../../../packages/core/src/audio-inspection.ts)
- [packages/core/src/word-kind.ts](../../../packages/core/src/word-kind.ts)
- [packages/core/src/transcript.ts](../../../packages/core/src/transcript.ts)
- [packages/test-harness/speech/feasibility/source-clock.test.mjs](../../../packages/test-harness/speech/feasibility/source-clock.test.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Explicit alignment preparation pins literal text, source/tap/range, PCM identity and provider. Read rows retain token/word index, estimated bounds, matched/unmatched status and provider score interpretation. Report nearby quiet/activity intervals with resolution and measured noise context; no waveform-only lexical label. Preserve partial/disfluent fragments only when observed; otherwise expose unexplained speech/ASR mismatch as unknown, not invented words.

## Runnable checkpoint

Production-entry-point parity against frozen alignment reference, including trend versus turn and fortun- support.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Before expensive inference, compare complete native requests and parsed outputs with accepted spike. Gaps, wrong text, unknown fragments, repeated words, unmatched dictionary tokens and source/project mapping remain explicit. Known text is not an independent timing oracle.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Small module names/storage structure and bounded evidence representation; lexical detector capabilities require separate successful proof before claiming them.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

One retained evidence owner, no independent transcript vocabulary/clock, raw-source integrity and exact revision projection remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
