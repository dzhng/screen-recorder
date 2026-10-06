# 11 — Recognize actual revision audio

Status: planned. Depends on: [08](08-bounded-speech-preparation.md), [03](03-published-work-contract.md).

## Contract

Fresh recognition of rendered output works even when source transcription failed, and cannot be confused with source-text projection.

## Seam and ownership

Existing PreparedAudio/AudioExtraction and TranscriptProcessing chained through shared jobs and historical origin mapping.

Current owners and starting checks:

- [packages/core/src/project-transcript.ts](../../../packages/core/src/project-transcript.ts)
- [packages/core/src/audio-inspection.ts](../../../packages/core/src/audio-inspection.ts)
- [apps/service/src/project-service.ts](../../../apps/service/src/project-service.ts)
- [packages/test-harness/editing/generation-transcript-service.mjs](../../../packages/test-harness/editing/generation-transcript-service.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Add explicit rendered-speech preparation selecting project, revision, processing tap/range and rendition. Materialize only requested output through existing audio owner, recognize that PCM and map observations to project time. Retain origin and processed PCM identity. Project transcript projection remains a distinct read contract. No caller-created temporary project or source ID guessing.

## Runnable checkpoint

One revision containing a planted edge truncation: projected words versus fresh rendered recognition, exact origins and sample bounds.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

A failed source transcript must not block rendered preparation. Pinned revision/tap, cancellation, retries, retained output without current model and source gaps have distinct states. Validate mapping with an independently placed audio landmark.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Convenience operation naming and internal chaining; separate evidence kinds and exact mappings are fixed.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Existing prepared-audio state-domain behavior, source evidence and source media remain intact.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
