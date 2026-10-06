# 09 — Replicate local alignment before selecting a provider

Status: planned. Depends on: [01](01-certified-corpus.md), [08](08-bounded-speech-preparation.md).

## Contract

A measured local alignment recipe is frozen before any product adapter or dependency claim.

## Seam and ownership

Existing speech feasibility harness and feature research evidence; use available prepared runtimes. This spike never creates a second production speech engine by default.

Current owners and starting checks:

- [packages/test-harness/speech/feasibility/README.md](../../../packages/test-harness/speech/feasibility/README.md)
- [packages/test-harness/speech/protocol.md](../../../packages/test-harness/speech/protocol.md)
- [helpers/mac/Package.swift](../../../helpers/mac/Package.swift)
- [packages/core/src/models.ts](../../../packages/core/src/models.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Compare a small available candidate set using correct/wrong text, repeated words, numerals, partial words, omitted utterances and contextual/abrupt edges. Inspect pinned FluidAudio versus current unsupported Qwen candidate; CTC requires emissions/vocabulary/timebase, not TDT words. Record runtime/model/license/footprint, preprocessing, missing-token behavior, score semantics and observed cost. Select exactly one accepted provider before slice 10. Recommend missing necessary capability; no default download or install.

Use independently constructed phrase/word support and planted truncated/intact joins as controls. Energy can certify activity/quiet support, not lexical identity or every connected-speech internal boundary. The other tool's transcript is comparison text, not independently labeled truth. Evaluate whether an available recognizer/aligner actually preserves fortun- and other partial fragments. If lexical fragment recovery is unproven, publish unknown activity evidence honestly and record the lexical gap; do not mark partial-word recognition shipped. Reslice a provider experiment if that required capability cannot be established.

## Runnable checkpoint

Frozen reference runner, inputs/outputs and selection verdict with hashes, plus mismatch/false-start controls.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Independent known-offset/edited-support controls supplement real project evidence. Wrong text cannot always be forced into successful timed words. Native scores remain uncalibrated unless calibration is established; no arbitrary 95% claims. Failed reproduction records a blocker/reslice, not a successful stub.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Provider selection among candidates meeting this gate, with explicit rationale. Provider inputs/settings freeze before porting.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

No consumer installs, no cloud upload fallback, no edit mutation or rewriting source observations.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
