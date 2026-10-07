# 30 — Inspect scene changes in exported pixels

Status: partial — the portable delivered-scene report helper and focused public-operation tests are implemented; the retained native planted flash/hold and physical empty-edit-list delivered-export checkpoints now have inference-free replay checks. A separate retained native audio crossfade receipt now has an inference-free PCM replay, but no combined scene/audio detector or association is claimed. Broader transition/audio and visual review gates remain open. Depends on: [13](13-decode-replication.md), [04](04-wait-and-json-delivery.md).

## Contract

Agents can distinguish authored joins from observed visual changes in the delivered file.

## Seam and ownership

Existing asset import/source-scene/index evidence with an export-origin association; coordination stays in helper unless a shared operation is needed for durable reuse.

Current owners and starting checks:

- [packages/core/src/scene-processing.ts](../../../packages/core/src/scene-processing.ts)
- [packages/core/src/source-scenes.ts](../../../packages/core/src/source-scenes.ts)
- [packages/composition/src/project-cuts.ts](../../../packages/composition/src/project-cuts.ts)
- [skills/yap/scripts/review-bundle.mjs](../../../skills/yap/scripts/review-bundle.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

After export, inspect its actual file as an immutable asset using existing scene reads. Return delivered timestamps/observed transitions and matching authored cut references as a report; do not relabel timeline.events as export scenes. Preserve detector sampling/missed-frame coverage and intentional holds/flash/overlay changes. Add no parallel scene engine if source observation already supplies it.

Delivered audio transitions remain a separate evidence surface. The retained
public/native crossfade receipt at
[`assets/27-29-transitions/crossfade`](../assets/27-29-transitions/crossfade/README.md)
proves processed PCM landmarks and exact two-source gain arithmetic through
`audio.get`; [`transition-audio-replay.mjs`](../../../packages/test-harness/editing/transition-audio-replay.mjs)
replays that artifact without rerunning native inference. The current public
scene contract has no audio-scene detector, so this pass deliberately does not
invent one or associate audio transitions with visual scene rows.

## Runnable checkpoint

Authored joins versus actual delivered scene report, with planted extra flash/gap and deliberate hold controls.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Source file unchanged hash, encoded timestamp mapping, mismatch at authored join, graphics-only change, physical empty-edit support and detection gaps. Detector candidates are observations, not editing permission.

Variable: scene-change coverage/timing. Mask: change windows and full frame for planted flash/gap; look matching out of scope.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

The next experiment for a combined claim is one small committed A/V export
whose video stream is inspected by `deliveredScenes` and whose audio stream is
read through the existing public `audio.get`/export path. It must retain one
source-bound clock, decoded PCM landmarks and the unchanged scene detector
rows before any cross-plane association is proposed. A failure must remain a
refusal; do not infer an audio transition from a picture scene boundary.

## Delegated choices

Report association and convenience wrapper after current capability reproduction.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Existing scene/model identity, exact clocks and no product edits remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
