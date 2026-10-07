# 33 — Teach complete workflows and external interchange

Status: complete for the declared routing/reference scope — focused launch,
podcast/interview and teaser references plus case-selected routing are
implemented and replayed. Media-aware fresh-agent examples and final delivery
acceptance remain with slice 34. Depends on: [02](02-capability-first-skill.md), [12](12-contextual-join-verification.md), [16](16-subject-reframe.md), [19](19-dialogue-matching.md), [21](21-synced-angles.md), [23](23-timed-word-captions.md), [26](26-immutable-luts.md), [29](29-motion-blur.md), [30](30-delivered-scenes.md), [32](32-speaker-labeling.md).

## Contract

The consumer skill uses the complete toolkit and available external tools to make launch/podcast/teaser outputs end to end.

## Seam and ownership

skills/yap/SKILL.md routes to focused references and existing helpers. Task workspace holds briefs/source manifests/recipes/decisions; no new product editorial database.

Current owners and starting checks:

- [skills/yap/SKILL.md](../../../skills/yap/SKILL.md)
- [skills/yap/references/video-use-cases.md](../../../skills/yap/references/video-use-cases.md)
- [skills/yap/references/creative-workflows.md](../../../skills/yap/references/creative-workflows.md)
- [skills/yap/references/editorial-checks.md](../../../skills/yap/references/editorial-checks.md)
- [skills/yap/references/media-workflows.md](../../../skills/yap/references/media-workflows.md)
- [evals/README.md](../../../evals/README.md)

This pass adds the focused routing references:

- [Launch and demo videos](../../../skills/yap/references/launch-videos.md)
- [Podcast and interview videos](../../../skills/yap/references/podcast-videos.md)
- [Teasers and episode cold opens](../../../skills/yap/references/teaser-videos.md)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Keep use cases in their own references (launch/demo, podcast/multicam, teaser/intro) with short routing from the existing use-case index. Put cross-cut QA, acoustic verification, picture QA and audio finishing in their relevant focused references without duplication. Include source/full exchange understanding, raw-vs-edited clocks, styled/native caption patterns, ProRes4444 advanced overlay interchange, reference/music analysis, reproducible external asset recipes, no default external-tool installs, default preparation of needed first-class Yap models and autonomous repair. User goals drive style: question-end teaser strategy is optional and truthful; avoid unrelated welcome and false reaction context. Keep FEEDBACK per collection and README/build per video; originals out of project Git, generated assets/hashes/recipes retained.

Teach mixed-recording speaker labeling as well as per-person sources. Consume the
public stable turn/name-binding contract from 32, preserve overlap/unknowns in the
compact transcript, and never equate camera ownership or local diarizer slots with
a known person. Use names supported by the brief/source evidence; otherwise retain
anonymous labels. No human naming/QA step is required.

Update each capability's owning reference/example when its product slice lands;
do not defer discoverability until this final integration slice. This slice
consolidates the complete workflows and removes duplicated procedure text.

## Runnable checkpoint

A case-selected routing helper now gives a fresh agent the exact focused
reference, provenance hashes and review checklist for each use case. It is
documentation/eval evidence only: it does not claim caption/music interchange
or media delivery. Media-aware examples remain the slice 34 gate.

Run the helper from the installed skill with one of these requests:

```sh
printf '{"useCase":"launch"}\n' | node skills/yap/scripts/use-case-routing.mjs
printf '{"useCase":"podcast"}\n' | node skills/yap/scripts/use-case-routing.mjs
printf '{"useCase":"teaser"}\n' | node skills/yap/scripts/use-case-routing.mjs
```

The retained [routing receipt](../assets/33-editing-references/routing-receipt.json)
records the three case identities. The model-eval cases are
`launch-reference-routing`, `podcast-reference-routing` and
`teaser-reference-routing` in [evals/cases.json](../../../evals/cases.json).

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Fresh-agent trials run actual helper examples and make/verify specified edits. No human-QA recommendation, invented capabilities, default installs, fixed ASR delay or universal trailer targets. External alpha frames remain exact through trimming/repeats; stochastic assets reproduce from retained bytes, not a promise of regeneration.

Variable: external-overlay interchange/visibility if example renders visuals. Mask: overlay alpha/text band on both dark/light backgrounds, with timing fixed.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Reference split/names and example storytelling from fixture brief. Advanced generation remains external; missing tools may be recommended specifically.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Single procedure owner, discoverable current contracts and per-video reproducibility remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
