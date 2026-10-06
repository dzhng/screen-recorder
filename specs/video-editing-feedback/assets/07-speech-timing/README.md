# Speech timing reproduction

The historical Madison input reproduced a destructive clamp: `I` at 0–80 ms
and `just` at 0–160 ms became an instant `I`; the index then expanded it to one
microsecond and rejected `just`. The [tiny fixture](../../../../fixtures/speech-timing/README.md)
is byte-identical to the historical input, with explicit synthetic padding.

The retained requests and native responses distinguish baseline and changed
worker execution. All six changed-worker calls succeeded with network denied:
four tiny controls and two 25-second overlap cases. [Comparison](native-comparison.json)
records unchanged raw token arrays, preserved word counts and changed estimate
operands. No ASR agreement is treated as phonetic truth: nearby starts can still
recognize `prophecy` where a wider input recognizes `privacy`.

The 25-second corpus baseline pairs used derivative WAVs and bounded original
source selections, never whole-file transcription. Their [comparison](bounded-baseline-comparison.json)
establishes exact token identity and every word operand after source-clock
rebasing. These two cases do not certify the entire slice01 corpus. The request
files retain machine-local source paths for audit; the corpus manifest owns
portable media identity.

Run the [replay checkpoint](../../../../packages/test-harness/speech/timing-replay.mjs)
with `--help` for cases. It verifies retained raw hashes and drives current core
admission plus one-row enumeration in scratch. It does not acquire models,
transcribe, import fabricated media or authorize edits. The native requests
remain a separate optional reproduction requiring their explicit prepared model
and source bytes.

[Scoped review](review.md) records the shape/diff/docs verdict, focused red/green
checks and independent review limit. [Choices](choices.md) preserve the conservative
refusal and checkpoint-scope decisions for integration.
