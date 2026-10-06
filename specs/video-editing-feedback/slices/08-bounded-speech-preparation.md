# 08 — Prepare transcripts for bounded source ranges

Status: planned. Depends on: [07](07-speech-timing-admission.md), [03](03-published-work-contract.md).

## Contract

Inference scope is explicit, bounded and source-clock preserving; it is distinct from filtering a transcript read.

## Seam and ownership

TranscriptProcessing/TranscriptStore/model owner, selected PCM and native SourceTranscript. Protocol preparation/read seam.

Current owners and starting checks:

- [packages/core/src/transcript-processing.ts](../../../packages/core/src/transcript-processing.ts)
- [packages/core/src/transcript-read.ts](../../../packages/core/src/transcript-read.ts)
- [helpers/mac/Sources/YapSpeech/SourceTranscript.swift](../../../helpers/mac/Sources/YapSpeech/SourceTranscript.swift)
- [packages/core/src/transcript-ownership.test.ts](../../../packages/core/src/transcript-ownership.test.ts)
- [packages/test-harness/editing/selected-source-transcription.mjs](../../../packages/test-harness/editing/selected-source-transcription.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Introduce explicit transcript.prepare execution selection and make transcript.get a retained evidence read. Execution range, context, stream/acquisition, model and decoder participate in generation identity. Omitted execution range means full admitted support processed in bounded windows; unavailable support remains gaps. Retain context ownership and merge diagnostics, avoid duplicate words, and never silently fill gaps. Remove implicit model/inference preparation from reads in one cutover across callers/skill.

## Runnable checkpoint

Tiny and range-only recognition receipts showing decoded work bounds and original source times, plus a long-source chunk/continuation report.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Range inference does not scale decoded memory to full asset length; cancellation, resumed reads, context overlaps, missing support, repeat requests and package retention have explicit behavior. Chunk size/merge recipe is frozen against real cases before production promotion.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Window size and overlap after measured replication; record these as execution recipe, not hidden defaults. No automatic model acquisition.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Source origin, generation pins, exact occurrence projection and read-only pagination remain correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
