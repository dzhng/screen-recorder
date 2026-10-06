# 18 — Meet feasible dynamic targets without relaxing them

Status: planned. Depends on: [17](17-normalization-preflight.md), [01](01-certified-corpus.md).

## Contract

A frozen bounded mastering recipe meets feasible requested targets or reports measured reasons for failure.

## Seam and ownership

Existing service audio-processing and Core normalization admission; bundled FFmpeg recipe and independent loudness oracle.

Current owners and starting checks:

- [apps/service/src/audio-processing.ts](../../../apps/service/src/audio-processing.ts)
- [packages/core/src/audio-measurement.ts](../../../packages/core/src/audio-measurement.ts)
- [packages/test-harness/editing/audio-recipes/normalization.py](../../../packages/test-harness/editing/audio-recipes/normalization.py)
- [packages/test-harness/editing/loudness/README.md](../../../packages/test-harness/editing/loudness/README.md)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replicate undershoot on peaky music/dialogue under current runtime. Freeze a bounded correction strategy before porting; preserve strict requested LUFS/LRA/peak checks and before/after evidence. No silent target changes, tolerance expansion or mode substitution. Agent may explicitly revise a treatment within delegated brief. Separate PCM peak guarantees from actual encoded-export measurements and document meter differences.

## Runnable checkpoint

Audio-only peaky mix correction report, each iteration operand and independent final measurements; then one encoded-export check.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Feasible peaky mix, infeasible peak/range, silence, different channels/sample rate and no-progress solving. Cap work using named iterations and measurable progress; never repeat unchanged failure. Meet current declared tolerances or truthful strict refusal.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Correction recipe selected by reproduced evidence; freeze exact runtime/resampling/iteration budget before changing production.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

No export-wide late surprise when preparation could know it, and no successful publication with silently unmet explicit targets.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
