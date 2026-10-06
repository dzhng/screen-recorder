# 05 — Replace explicitly owned exports atomically

Status: planned. Depends on: [03](03-published-work-contract.md).

## Contract

An explicit new export can replace its unchanged Yap-owned destination without risking the previous good output.

## Seam and ownership

Existing export intent and Publication/native publication owner. Replacement identity and opt-in belong in the pinned export intent, not a CLI filesystem workaround.

Current owners and starting checks:

- [apps/service/src/exports.ts](../../../apps/service/src/exports.ts)
- [apps/service/src/publication.ts](../../../apps/service/src/publication.ts)
- [apps/service/src/publication.test.ts](../../../apps/service/src/publication.test.ts)
- [helpers/mac/Sources/YapWire/PublicationOperation.swift](../../../helpers/mac/Sources/YapWire/PublicationOperation.swift)
- [helpers/mac/Tests/publication.test.mjs](../../../helpers/mac/Tests/publication.test.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Default replacement is allowed only when the live destination matches a trusted Yap publication receipt. Modified formerly owned content is foreign. Foreign replacement requires overwrite:true. Stage on the destination filesystem, validate before atomic replacement, preserve old bytes on failure, and bind recovery to the expected destination. Reusing exportId recovers the same intent; a different revision needs a new identity. Never target original source media.

## Runnable checkpoint

Fault-injected public export/re-export journey retaining old/new hashes and lost-acknowledgement recovery.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Test cancellation/crash before commit, lost acknowledgement after commit, concurrent publisher, changed destination, foreign file, symlink changes, and retry of an older intent after a newer publication. Previous good output must remain before commit.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Publication bookkeeping and test fault barriers using current owner. No new janitor, migration or publication queue.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Atomic visibility, source preservation, explicit foreign opt-in and replay semantics remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
