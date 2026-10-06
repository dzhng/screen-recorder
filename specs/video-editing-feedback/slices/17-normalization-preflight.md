# 17 — Prepare audio before expensive picture rendering

Status: complete. Focused checks and independent review passed. Depends on: [04](04-wait-and-json-delivery.md).

## Contract

Requested normalization constraints can be evaluated/prepared before a full video export.

## Seam and ownership

Core audio measurement/preparation and complete processing-state domains, service typed audio executor.

Current owners and starting checks:

- [packages/core/src/audio-measurement.ts](../../../packages/core/src/audio-measurement.ts)
- [packages/core/src/audio-inspection.ts](../../../packages/core/src/audio-inspection.ts)
- [apps/service/src/audio-processing.ts](../../../apps/service/src/audio-processing.ts)
- [apps/service/src/audio-processing.test.ts](../../../apps/service/src/audio-processing.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Extend existing audio.prepare rather than introducing a parallel preparation operation. It already prepares the full revision output without picture. Add the selected tap/domain feasibility/readiness needed for preflight, pin revision/input PCM and requested targets, and retain reusable complete prepared results. Read-only feasibility may borrow existing audio.measure/preparation facts; it must not claim a dynamic result before execution. Edit admission stays cheap; do not transcribe/render inside edit.apply. Ensure export resolves required valid audio preparation before expensive picture encode; reproduce current ordering first.

## Runnable checkpoint

Impossible gain-only request fails with constraints before picture worker invocation; successful prepared output is reused by export.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Below-gate/null loudness, missing support, different clips/mixes, changed processing order and stale pins. Reuse complete-domain measurements; an excerpt is not a new full-program normalization verdict. Verify no expensive picture work before known refusal.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Operation arrangement over existing preparation; no alternate state scheduler.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Strict measurement postconditions, unavailable-support distinction and state continuity remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.

## Implemented verdict

`audio.prepare` now accepts the existing processing-tap contract. Omission selects
processed output. Complete selected domains, literal tap, revision inputs and
ordered processing recipe remain pinned through execution, reuse and portable
adoption. Another tap never substitutes for the final movie mix.

Existing movie processing already refuses impossible normalization before native
picture encoding. The regression is falsified by invoking picture consumption
first. Existing publication/job diagnostics retain strict refusal details; no
additional scheduler or diagnostic store was added. Native public checks and
portable dry-tap falsification are scoped in [the retained evidence](../assets/17-audio-preflight/README.md).
Dynamic mastering remains slice18; this pass changes no loudness tolerance or
processor algorithm. Synthetic mux frames are not a picture design verdict.
