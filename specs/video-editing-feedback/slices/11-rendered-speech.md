# 11 — Recognize actual revision audio

Status: complete; public real-Parakeet and retained-read checkpoints pass. Depends on: [08](08-bounded-speech-preparation.md), [03](03-published-work-contract.md).

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

## Accepted implementation

The [rendered-speech owner](../../../packages/core/src/rendered-speech.ts) chains
immutable extraction with fresh recognition inside one project job. A parent attempt
never joins an ordinary source transcript job, including for byte-identical PCM.
[Public declarations](../../../packages/protocol/src/operations.ts) own preparation,
explicit prerequisite retry and generation-pinned retained reads. Missing selected
source support refuses before ASR and retains unavailable intervals in failure detail.

[Accepted evidence](../assets/11-rendered-speech/README.md) records real CLI/MCP
recognition, independently placed exact sample landmarks and restart reads with
rendering/inference unavailable. Controlled regressions cover failed original
transcription, model absence, source gaps, cancellation, explicit extraction recovery
and generation/revision refusal. Mapping, gap refusal and dependency retry were
falsified and restored; the byte-identical source-job regression was red before the
fresh-attempt correction.

Parakeet completed the word “trend” after a cut inside its retained source-word estimate. This checkpoint proves
new measured evidence and its consumed PCM, not that ASR detects or certifies a
clipped word. [Slice12](12-contextual-join-verification.md) still owns contextual
boundary judgment and repair. No whole-spec, package-portability or release claim.

Independent Codex review found a missing transcript-policy cache pin. The existing
transcript execution owner now supplies its existing source policy to rendered identity.
A seeded stale publication reused historical-policy output before the fix and
admitted fresh work afterward. All review findings are resolved; retained
[review and regression evidence](../assets/11-rendered-speech/README.md#scoped-review)
records the exact scope.
