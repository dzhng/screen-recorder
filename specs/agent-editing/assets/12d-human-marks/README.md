# Independently marked sentence and filler boundaries

Status: the user saved all ten requested boundaries and confirmed completion on
2026-09-30. The [unaltered human export](human-marks.json) now owns this clip's
audible sentence, two filler and two protected-word ranges. It is separate from
the frozen ASR proposal and accepted candidate; none of those bytes changed.

[Root verification](root-verification.json) rehashes the source, clip and original
annotation packet, rebuilds the saved export through the [shared annotation clock](../../../../packages/test-harness/editing/speech/annotation-time.mjs)
owner and checks every marked edge against exact sample positions. All ranges
remain bound to the original recording clock, with no double-added track offset.
Every sample in the marked “paragraph” and “this” ranges is unchanged in the
accepted candidate, after accounting for the removed interval. Both ranges avoid
the cut and its ramps. The opening “um” also remains sample-identical.

The frozen cut retains 15 ms of the independently marked middle filler and
removes 40 ms after its marked end. It therefore cannot be described as exact
removal of the entire labeled filler. The earlier “clear and natural” listening
verdict still applies to those same frozen bytes. No revised candidate, new
audition, recipe selection or broader cleanup acceptance is inferred.

The opening filler was omitted by the frozen proposed text. Its marked onset is
at this clip's boundary; preceding extent outside the clip is unknown. The
inventory explicitly remains incomplete and repetition/removal intent remains
unlabeled. Sentence endpoints supply no unmarked internal word boundaries.
This fulfills 12d's scoped sentence/neighbor-label requirement; parent 12's
corpus labels and timing/precision/recall acceptance, and dependent 12b, remain
open. The original failed baseline scores are not recalibrated from this subset.

The [independent reconciliation](independent-review.md) agrees on source/clock
integrity, scoped completion and the cut discrepancy. Focused shape/diff/docs
review retains the already banked policy: preserve raw human evidence separately
and keep accepted outputs unchanged. No production code, new test mechanism,
model, capture or playback was added. [Manifest](manifest.json) pins the retained
human record, checks and reviewer report. The next speech evidence is broader
independent lexical/filler coverage and acoustic/protected-word boundaries under
parent12. The scoped12d packet is verified; personal repetition intent is not a
development gate under [editorial control](../../architecture.md#editorial-control).
Historical reports retain their original incomplete-inventory/intent fields
without making them active requests.
