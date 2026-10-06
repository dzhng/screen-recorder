# 02 — Discover capabilities before editing

Status: planned. Depends on: None. Capability discovery/help/examples use current public contracts and existing lightweight fixtures; they do not depend on real-media certification.

## Contract

An agent chooses a workflow from capabilities actually available beyond Yap, and can run the existing helpers from examples.

## Seam and ownership

skills/yap/SKILL.md and existing helper scripts/references; consumer evaluations in evals. This inventory is task-side data, not a new service registry.

Current owners and starting checks:

- [skills/yap/scripts/compact-transcripts.mjs](../../../skills/yap/scripts/compact-transcripts.mjs)
- [skills/yap/scripts/timeline-inspection.mjs](../../../skills/yap/scripts/timeline-inspection.mjs)
- [skills/yap/scripts/review-bundle.mjs](../../../skills/yap/scripts/review-bundle.mjs)
- [skills/yap/scripts/caption-proposals.mjs](../../../skills/yap/scripts/caption-proposals.mjs)
- [skills/yap/references/skill-lifecycle.md](../../../skills/yap/references/skill-lifecycle.md)
- [evals/cases.json](../../../evals/cases.json)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Make the first internal question: what tools, skills, models and asset libraries are available beyond Yap? Record CLI/installed skill identities, readiness and provenance. Use available tools; recommend missing capability only when materially useful/required. Prepare/download pinned models for first-class Yap features as needed by default. No default external-tool installs, external model downloads or account setup. Preserve existing help and add minimal complete JSON examples that consume actual returned IDs.

Replace current human-QA advice at this early checkpoint with autonomous investigation,
bounded repair and precise uncertainty, using capabilities that actually exist today.
Do not advertise later planned operations as ready. Examples explain batch-local
labels versus real IDs used by later revisions. Owning references evolve with each
shipped capability; slice 33 consolidates the complete workflows.

## Runnable checkpoint

A controlled agent run inventories Yap plus external tools and executes help/inspection examples without writing an edit or preparing a model.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Execute each example using the installed/bundled Node and controlled CLI replies; check valid inputs, pinned continuation and failed-job handling. Include old installed-skill provenance and required-but-missing AI-video capability cases. No tests that merely assert wording appears.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Reference names, concise inventory presentation and example packaging. Missing-capability policy is fixed.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Current helper contracts and exact evidence pins remain valid. No task is presented as edited merely because discovery succeeded.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
