# 18 — Meet feasible dynamic targets without relaxing them

Status: complete; strict production PCM mastering, measured encoded delivery and independent correction review complete. Depends on: [17](17-normalization-preflight.md), [01](01-certified-corpus.md).

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

## Accepted correction checkpoint

The current two-pass native route genuinely refuses a12-second authored peaky
dialogue/percussion case at about−14.9LUFS for the unchanged−14.5LUFS request.
The independent reference observes−14.9129LUFS. Two additional original-input
offset candidates reach−14.6084LUFS without relaxing peak/range tolerances.
A reconstructed frozen-workflow music case also moves from an independent0.2446LU
miss to0.0078LU. These are numerical fixtures and placeholder reconstruction,
not a claim that the removed original project mix was replayed.

Freeze the existing first-pass inputs and rerender the original complete PCM
with bounded offset correction: at most3 treated candidates, an interior0.1LU
aim, at least0.02LU improvement, and FFmpeg's finite±99dB offset range.
Requested integrated/peak/range targets never change. Range/peak failures,
null support, no progress or exhausted work remain strict measured refusals.
The current strict admission remains the final owner. Safe post-gain eligibility
was inspected but that strategy was not selected or executed.

Retain each candidate's offset and complete after measurement and identify the
delivered candidate with `selectedAttempt`. Hold the best admitted candidate
through correction so a regression cannot discard feasible output. Use existing
artifact lifetimes, with at most three simultaneous candidate handles. The existing
normalization evidence retains operands, including failed-job details. The canonical retained
schema requires those operands; old affected catalogs/packages are refused,
with no reader shim or migration. Algorithm identity changes so preparation
cannot reuse a different recipe. [Frozen research](../assets/18-mastering/protocol.json)
pins the bounded policy and measured scopes. [Production confirmation](../assets/18-mastering/README.md) distinguishes independent accuracy, measured strict refusals, controlled progress lifetime and decoded AAC.

## Closeout

Independent review found admitted-candidate loss; the test-first correction now
keeps the lowest-error admitted PCM through existing artifact lifetimes. The
[corrective review](../assets/18-mastering/review-selection.md) found no further
issues. Root ran the public prepared-output/package adoption case after the
`selectedAttempt` cutover; the native retained output survives excerpt and package
adoption. Canonical publication checks and affected type checks remain green.
Catalog29/package6 deliberately refuse older incomplete candidate evidence; no
compatibility reader or migration was added. Encoded peak remains separately
measured, with the oracle discrepancy retained rather than called compliant.
