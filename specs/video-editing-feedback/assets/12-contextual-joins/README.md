# Contextual join evidence

## Public contextual report (12B)

`join.verify` is a read-only operation over a pinned revision, processing tap and
prepared audio publication. It returns the exact two-sided boundary, project and
source ranges, optional retained alignment and rendered-recognition observations,
missing coverage, nearby candidate mappings, and bounded waveform/spectrum evidence.
It never prepares a model, runs inference, renders media or authors an edit. Matching
text and conditional alignment remain observations; `phoneticCompleteness` is
explicitly unknown.

The implementation keeps the prepared asset identity-bound through
`PreparedAudioStore.open`, maps project times with the shared exact sample clock,
propagates request cancellation to bounded readers, and refuses unavailable PCM
spans or sub-sample contexts instead of presenting zero-filled data as measured
quiet. The example response shape is in [join-verify-report.example.json](join-verify-report.example.json).

[12B verification](join-verify-verification.json) records the focused service tests,
typecheck, formatting and the clean independent review. The reviewer’s own native
test was sandbox-blocked by its temporary-directory policy; the same focused tests
passed in the writable worktree.

## Exact two-sided boundaries

The existing [composition cut owner](../../../../packages/composition/src/project-cuts.ts)
resolves explicitly selected review points with the same source clock calculation
as authored cuts. A point may be an opening, ending, continuous split or candidate
coordinate. It is evidence of placement, never evidence of acquired media or
speech identity. Authored cut enumeration remains unchanged.

[Focused behavior tests](../../../../packages/composition/src/project-cuts.test.ts)
check retimed opening/ending source endpoints, both sides of a continuous split,
fractional candidate mappings, the exact terminal rather than its rounded extent,
foreign-track refusal, and unavailable media versus an authored gap. The [retained falsification report](report.json) and
logs show that replacing an ending source endpoint with the opening coordinate,
or admitting the rounded tail past a fractional ending, makes the corresponding
assertion fail. Each mutation was restored before the complete file passed.

[Independent review](independent-review.md) found repeated linear lookup and missing
gap coverage. Lookup now searches the existing sorted, nonoverlapping placements
without another index or cache. The new gap test preserves a source mapping where
media is unavailable, while a gap in authored placement returns null sides.
[Conflating availability with placement](availability-conflation-red.json) makes
that assertion fail. This is source-coordinate proof, not an availability verdict.

Scope: this checkpoint adds no public operation or editorial policy. Retained
contextual reporting and the real-media exercise are accepted as evidence; no
clean-cut verdict is inferred. Autonomous repair remains open in
[slice12](../../slices/12-contextual-join-verification.md).

## Explicit repair and changed-output recheck (12C/12D)

The consumer-side [join-repair helper](../../../../skills/yap/scripts/join-repair.mjs)
keeps editorial authority outside the product. It accepts one caller-authored
`edit.apply` request pinned to the inspected revision, refuses a response that
does not advance that revision, optionally prepares the changed revision's audio
tap with a bounded poll budget, and calls `join.verify` with the new revision and
prepared resource. It performs no candidate selection, wording inference, blind
retry or automatic fade. The focused test proves both the ordered public calls
and the stale-revision refusal; the helper receipt is retained in
`repair-verification.json`.

## Real media exercise (12C)

[`contextual-join-fixture.mjs`](../../../../packages/test-harness/editing/contextual-join-fixture.mjs)
replays the four required cases in a private managed home. It imports the retained
`fortunate` PCM fixture, authors separate clipped, intact, repaired and intentional-
jump revisions, prepares the pinned first-class Parakeet model, renders each output,
and drives the repaired revision through the public `join-repair` helper before
recording exact prepared sample support plus the read-only `join.verify` report.
The accepted receipt is [media-fixture-report.json](media-fixture-report.json).
The intact and repaired outputs are both recognized as `Fortunately,`; the clipped
output is recognized as `'Kay.`. This is retained as the frozen word-completion
limitation, not a lexical clean-cut verdict. The intentional jump refuses rendered
recognition because a word estimate exceeds the delivered interval, while the join
report retains its two-sided source jump, acoustic evidence and `unknown` phonetic
completeness.

Checkpoint D still requires a fresh agent to discover the defect without a timecode
hint and drive the bounded caller-owned repair helper.

The read-only [fresh-agent audit](fresh-discovery-audit.md) confirms the clipped
case is discoverable from the retained receipt and derives the explicit repair
inputs. It could not replay that repair because the receipt does not retain a live
managed service/home or original request payload, so the runnable 12D gate remains
open.

The [independent follow-up](followup-review.md) accepts the implementation. Its
remaining receipt wording finding is resolved: eight tests and three retained
mutation proofs. The follow-up completed with exit0 and `turn.completed`.
