# 05 — Replace explicitly owned exports atomically

Status: complete; focused contract gates and scoped review pass. Depends on: [03](03-published-work-contract.md).

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

## Frozen native concurrency boundary

Yap publishers hold an exclusive destination-directory descriptor lock; admission
and publication inspect the actual regular leaf through that held directory.
Replacement pins its device/inode, length and SHA-256 in the immutable export
intent and prepared native receipt. An absent destination stays an exclusive
new-file publication. Symlink and non-regular destinations found at admission or the commit check are refused even with
foreign overwrite opt-in. Original imported source identities remain protected.

The macOS primitive is `renameatx_np(RENAME_SWAP | RENAME_NOFOLLOW_ANY)`, not a
pathname precheck followed by a destructive rename. A private hard link retains
the complete new payload; swapping a second link into the destination retains
the displaced leaf inside the same staging lifetime. Before acknowledgement,
the native owner validates that displaced leaf against the admitted identity and
digest. Crash/lost acknowledgement recovery reads the same prepared evidence.
A superseded pinned intent never replaces a newer destination.

The OS offers no expected-inode/digest compare-and-swap against noncooperating
same-user writers. Such writers do not honor the directory lock. If one changes
the leaf between native validation and swap, the owner reports a conflict and
retains the displaced leaf (including a raced final symlink, which rename swaps
without following its referent); it never deletes unknown displaced bytes or swaps
back over a possible successor. This unsupported race can leave the new payload
visible without a committed receipt. Neither an error nor recovery claims the
old destination remained unchanged in that race. Cooperative Yap publishers and
changes completed before the commit check retain the strict refusal contract.
No second publication queue, janitor, migration or compatibility path is added.

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

## Retained checkpoint

[Atomic publication evidence](../assets/05-atomic-export-replacement/README.md)
retains public CLI exchanges, native crash/race red-green proof, source and binary
identities, budget/storage checks and scoped review. The fixture runs only against
scratch state. Parent owns global handoff/traceability and the final feature gate.

Replacement verification budgets include the pinned previous file under the
existing worker cap. Confirmed native evidence survives marker-only interrupted
cleanup, and storage counts shared receipt hardlinks once. Unknown displaced
entries remain through failed abandonment and recovery; public job failure
details explicitly mark destination visibility uncertain. A retained swap symlink
contributes only its own no-follow metadata length; aggregate storage remains
readable and does not traverse or count its referent. The independent whole-change
review's storage finding was fixed test-first and its corrective rereview is clean.
