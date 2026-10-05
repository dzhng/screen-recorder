# 23c — Validated optional boundary evidence

Status: open; primary human-corrected word annotations and bounded original
audio/clock bindings are retained. Stereo attribution, lexical scoring treatment
and the [22](22-speech-feasibility.md) provider gate remain pending. No alignment
provider is selected or executed for acceptance.

## Next bounded checkpoint

Reuse existing real speech or permissively licensed public speech. Bind complete
independently listened word starts/ends and neighboring words to original source
hash, sample rate, channel and clock. Candidate timestamps and AMI forced-aligned
word times are not those labels. Preserve ambiguous/unmarked boundaries explicitly;
no new recording or invented placeholder may certify quality. Freeze provider,
license/runtime and untouched confirmation before evaluating coverage at least 95%
and p95 absolute word-endpoint error at most 50 ms, with the cost budget from 22.
Missing words remain in the denominator; their timing error is unknown, not zero.

## Implementation contract after a passed gate

Keep original transcripts unchanged. Retain optional additive alternative word
boundaries with source/channel/range/confidence/model/generation and unknown or
partial support, through existing model/runtime/jobs and evidence owners. A caller
explicitly chooses whether to use a boundary; evidence cannot automatically
replace word truth or authorize a cut. Exact composition projection retains
repeated/retimed/partial occurrences through the shared typed reads.

## Proof before calling it implemented

Compare an actual accepted real labeled word and full neighbors, source-clock
binding, omitted/ambiguous words, unavailable model, generation replacement and
stale pages. Then prove exact repeat/retime mapping and catalog/package preservation.
Keep current versus alternative bounds separate; a tighter endpoint is not
permission to edit. A small proof cannot claim multilingual/general boundary
accuracy, native cut sound quality or release installation. Unlistened sound
quality stays explicit; no playback on the personal machine.


## Reference authority checkpoint

The [additional source inspection](../evidence/boundary-source-candidates.json)
finds no admitted fixture. The L2-ARCTIC mirror declares noncommercial terms and
has no endpoint fields in its advertised data; its primary site blocks this
connection, so neither original permissions nor complete manually corrected
neighbor timing is inferred. Buckeye’s mirror names word/phone endpoints, but
its card restricts noncommercial reuse and leaves the annotation procedure
unspecified. A field named start/stop is not independent human boundary authority.
No original audio was acquired, no model ran, and no labels were invented.
Those candidates remain unadmitted; accessible metadata alone cannot close the
human-reference prerequisite.

A later [primary DoReCo inspection](../evidence/boundary-doreco/README.md) finds
explicit manual correction of word start/end times and complete original master
word sequences, with CC BY 4.0 covering the selected English annotations and audio.
Automatic phone refinement follows that correction; phone endpoints are not human
reference truth. Complete primary pages, original annotation members, licenses and
neighbor rows are retained. The subsequent bounded source checkpoint below admits
original bytes and physical clocks while retaining the stereo question. No inference or quality claim follows
from this reference finding.


## Bounded original-source admission

The [source admission record](../evidence/boundary-doreco/source-admission/README.md)
binds the six windows selected before audio acquisition to all four primary
original WAV streams. Complete streams were hashed under the frozen ten-minute
cap; only selected original PCM and independently fetched headers are retained.
Exact byte lengths, unchanged server/header identity, PCM16 framing and 44100 Hz
physical clocks pass admission. Complete originals were never stored as additional
media copies. Selected EAF values, annotation IDs, original millisecond endpoints
and immediate neighbors retain exact source/member/sample bindings. Rational
sample positions preserve the original clock without pretending millisecond
human labels have sample precision.

There are two development and four untouched confirmation windows, each 30s.
Their 487 intersecting original rows include 475 fully contained rows and 12 clipped
rows; 12 immediate outside neighbors also remain. These include pauses and marked
material, so the counts are not a lexical scoring denominator. Scoring must freeze
special-label/partial/missing-word treatment before provider inference. Nothing
is rewritten into a cleaner word list.

EN01 is original mono. All three selected EN03 stereo windows have unequal channel
bytes. Both channels remain intact and attribution is explicitly ambiguous; no
energy heuristic, channel selection or downmix is admitted. Provider/license/runtime
and any declared channel interpretation remain separate prerequisites. No speech
model, playback, recording, endpoint accuracy or sound-quality acceptance occurred.
