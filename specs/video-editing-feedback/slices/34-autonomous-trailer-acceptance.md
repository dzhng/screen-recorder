# 34 — Prove a complete autonomous trailer workflow

Status: planned. Depends on: [01](01-certified-corpus.md), [02](02-capability-first-skill.md), [03](03-published-work-contract.md), [04](04-wait-and-json-delivery.md), [05](05-atomic-export-replacement.md), [06](06-exact-removal.md), [07](07-speech-timing-admission.md), [08](08-bounded-speech-preparation.md), [09](09-alignment-replication.md), [10](10-alignment-and-boundaries.md), [11](11-rendered-speech.md), [12](12-contextual-join-verification.md), [13](13-decode-replication.md), [14](14-picture-statistics.md), [15](15-face-observations.md), [16](16-subject-reframe.md), [17](17-normalization-preflight.md), [18](18-reliable-mastering.md), [19](19-dialogue-matching.md), [20](20-sync-replication.md), [21](21-synced-angles.md), [22](22-styled-text.md), [23](23-timed-word-captions.md), [24](24-blend-modes.md), [25](25-tone-controls.md), [26](26-immutable-luts.md), [27](27-basic-transitions.md), [28](28-whip-zoom-trajectory.md), [29](29-motion-blur.md), [30](30-delivered-scenes.md), [31](31-speaker-continuity-replication.md), [32](32-speaker-labeling.md), [33](33-editing-references.md).

## Contract

A fresh editing agent delivers and reproduces a checked trailer using the installed public CLI, without user QA or undocumented scripts.

## Seam and ownership

Existing public/installed journey and consumer skill eval infrastructure. Reuse isolated service/caller lifecycle; no new orchestration framework.

Current owners and starting checks:

- [packages/test-harness/personal-release.mjs](../../../packages/test-harness/personal-release.mjs)
- [packages/test-harness/editing/acceptance.mjs](../../../packages/test-harness/editing/acceptance.mjs)
- [packages/test-harness/editing/source-evidence-fixture.mjs](../../../packages/test-harness/editing/source-evidence-fixture.mjs)
- [evals/run.mjs](../../../evals/run.mjs)
- [package.json](../../../package.json)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Use an explicit short fixture brief spanning co-hosts/raw cameras, known intended wording, framing/style, captions, transition and sound targets. Plant one undisclosed speech defect and require the agent to discover/investigate/repair it. Save capability inventory, source hashes, selections, requests/receipts, exact revisions, external assets/recipes and actual verification coverage. Repeat from clean managed state and a different root path; compare decoded frame/PCM identities or explicit justified codec tolerances. Distinguish instruction parity from real rebuild and media identity from container timestamps.

Require speaker-labeled dialogue from both a mixed-recording multiwindow case and
known per-person raw sources. The final view must preserve a planted slot permutation
control, overlapping voices and unknown names without guessing. Slices 31–32 are
required prerequisites, not an optional diarization deferral.

## Runnable checkpoint

Final short video, self-contained machine/agent review report, per-video README/build recipe and second-state replay receipts.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

One full repository run at completion, then only required affected native/installed/media checks. No repeated full-source jobs or unnecessary six-variant rebuilds. Exact old-render parity is claimed only for frozen matched inputs/recipes; user-directed improvements have named differences. No human gate, hidden setup or unresolved blocked slice labeled done.

Variable: whole-workflow composition after all individual variables passed. Compare final against brief and frozen references, with per-region masks and opening/ending/joins explicitly covered.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Editorial decisions within explicit fixture brief, reversible polish and report presentation. Any new product contract/policy change requires spec reslicing.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

All required slice verdicts passed; reference/critique gates complete; originals and frozen failed evidence unchanged; delivery state truthful.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
