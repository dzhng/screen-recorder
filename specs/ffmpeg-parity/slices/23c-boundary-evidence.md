# 23c — Validated optional boundary evidence

Status: open; [22](22-speech-feasibility.md) lacks independent complete human
word-neighbor labels. No alignment provider is selected or executed for acceptance.

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
