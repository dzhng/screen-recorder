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

Scope: this checkpoint adds no public operation, inference, edit or clean-cut
verdict. Retained contextual reporting, actual output evidence and autonomous
repair remain open in [slice12](../../slices/12-contextual-join-verification.md).

The [independent follow-up](followup-review.md) accepts the implementation. Its
remaining receipt wording finding is resolved: eight tests and three retained
mutation proofs. The follow-up completed with exit0 and `turn.completed`.
