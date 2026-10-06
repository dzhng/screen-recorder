# 07 — Retain pathological speech timing honestly

Status: planned. Depends on: [01](01-certified-corpus.md).

## Contract

Estimated timing overlaps do not discard otherwise usable speech or get silently converted into alleged audible truth.

## Seam and ownership

Native WordTimingMerger/SourceTranscript and Core TranscriptStore; the single speech observation admission policy and all transcript consumers change together.

Current owners and starting checks:

- [helpers/mac/Sources/YapSpeech/WordTimingMerger.swift](../../../helpers/mac/Sources/YapSpeech/WordTimingMerger.swift)
- [helpers/mac/Sources/YapSpeech/SourceTranscript.swift](../../../helpers/mac/Sources/YapSpeech/SourceTranscript.swift)
- [packages/core/src/transcript.ts](../../../packages/core/src/transcript.ts)
- [packages/core/src/asset-transcript.test.ts](../../../packages/core/src/asset-transcript.test.ts)
- [packages/core/src/source-transcript-read.test.ts](../../../packages/core/src/source-transcript-read.test.ts)
- [packages/core/src/text-seeds.test.ts](../../../packages/core/src/text-seeds.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

First replay current raw timing and coincident instantaneous-word controls; record whether native clamp/one-microsecond indexing causes the real failure. End state permits overlapping estimated word intervals, retains original recognition/spoken spans and ordinal/token identity, and distinguishes instantaneous observations from invented duration. Remove destructive blanket non-overlap rewriting/enforcement. Invalid nonfinite/reversed/out-of-support operands remain structured diagnostics/refusals; deterministic invalid evidence is nonretryable. Query/search/seed/project consumers must handle overlapping estimates without equating them with authored cut support.

## Runnable checkpoint

Tiny/25-second real-case reproduction plus deterministic raw-row replay and published transcript diagnostics.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Same-start words, zero-width points, contraction overlaps, segment ends, punctuation delay, reversed and nonfinite rows, source gaps and project repeats. Include offending indexes/times in errors; preserve all valid lexical occurrences and raw operands. Do not drop words or certify timing accuracy from ASR agreement.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Indexer/data representation for instant/overlapping rows after replay; public semantics above are fixed. Reopen/reslice if replay disproves the suspected cause.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Generation/ownership/pagination/source-clock and word ordinal contracts remain exact, with a hard cutover for changed persisted evidence.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
