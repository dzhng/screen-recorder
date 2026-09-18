# Word boundary timing on real narration

Slice [08](../../slices/08-transcript-processing.md) P6, measured 2026-09-19 on the checked-in
narrated take (`fixtures/narrated-workbench`, 2 min 14 s, 306 words, this person's own voice in
their own room). The [verification target](../../verification.md) is a median word boundary error
of 100 ms and a p95 of 250 ms.

**The target is not met, and the transcript is usually — not always — wrong in the safe
direction.** Measured over 15 hand-marked boundaries: median 135 ms, p95 578 ms, worst 590 ms. A
phrase's reported start runs **early** by a median of 183 ms and its reported end **late** by
105 ms, so a word's span usually brackets the sound rather than clipping it, which is why
[the narrator judged such a cut clean](../personal-journey/audition.md) by ear.

**Three of the fifteen fall inside the speech**, where a cut would clip a word: the end of `E2.`
by 60 ms, the end of the filler `uh` by 100 ms, and the start of `easier` by 75 ms. Two of those
are word endings this repository's own trim moved, so the trim can overshoot the last sound by
around a tenth of a second. Nothing here claims every boundary is outside the speech; what the
audition establishes is one cut, on one take, judged by the person who recorded it.

## What this found and fixed

The first measurement said phrase ends ran nearly a second late. The cause was ours, not the
engine's. Parakeet ends a sentence with a punctuation token of its own and places it wherever it
decided the sentence was over — on synthetic narration whose silence is digitally exact, `"."`
landed 630 ms after the last sound. The CLI's merge, which this repository ports verbatim so word
grouping matches the evaluated engine, puts that token in the preceding word, and the word's span
ran to the end of it.

A word now carries two times: the engine's own, kept so the record still compares token for token
with the evaluated CLI, and the extent of its tokens that carry speech, which is what every read
and edit is aimed by (`WordTimingMerger`, `EngineWord.spokenStart`/`spokenEnd`). On the synthetic
check that moved phrase-end error from +948/+956/+610 ms to +308/+316/+290 ms; on this real take
sentence-final words now land within about 100 ms.

Two further defects that measuring this found are fixed in the same place: a word ends at its
latest token rather than its last one, and no word's span may run into the next word's. This
engine puts several tokens on one frame, so a contraction like "I'm going" was reported with the
first word's span containing the second whole — and a span is what a cut removes, so cutting
`I'm` deleted `going` from the take and from the transcript with no trace. Core now refuses
overlapping words outright rather than trusting the worker.

What remains is inside the engine's own tokens: its last spoken token of a phrase runs about
300 ms long, and its first begins about 200 ms early. Nothing here can tighten that without an
acoustic detector deciding where speech is, which would make every reported boundary a guess of
ours rather than the engine's answer — and would risk clipping a quiet word edge, the one failure
this take's narrator would notice. Left as is, deliberately; see the
[choices ledger](../../choices.md).

## How it was measured

`node packages/test-harness/speech-boundaries.mjs` draws each boundary as a spectrogram at one
millisecond per pixel, ruled every 50 ms, with the transcript's own boundary as the blue line.
Only boundaries with a real pause beside them are drawn: inside connected speech there is no
moment anybody can point at, by eye or by ear. Marks are millisecond offsets from that line,
negative when the speech begins or ends before the transcript says.

A detector was tried first and abandoned. This narration was recorded while its narrator clicked,
typed and moved a mouse, and every threshold that separated those from speech changed the answer
by more than the thing being measured. The eye is the reference here, the pictures are committed
so the marks can be checked, and `--score` only ever reads the marks.

- [`marks.json`](marks.json) — every drawn boundary and its mark, with the panel it was read from.
- [`scored.json`](scored.json) — the distribution above.
- [`sheet-0.png`](sheet-0.png) … [`sheet-7.png`](sheet-7.png) — the panels, two boundaries each,
  in the order `marks.json` lists them. Two ends were read from a 2400 ms redraw, because the
  speech had stopped before the 900 ms panel began.
- [`transcript.json`](transcript.json) — the take's transcript as the fixed pipeline reports it.

Marks are read to about ±25 ms, which is well inside the effect being measured but is not a claim
of millisecond accuracy. One boundary of the sixteen is unmarked: its panel is room noise
throughout, with no edge to read. Fifteen marks is a small sample, and the quantiles are
interpolated between the values either side rather than rounded up to the next one — a p95 of
fifteen numbers is an estimate, not the worst case, which is reported separately.

Acquired time that no word covers is attributed to nothing at all: trimming raised that from 18%
to 29% of this take, and a `transcript.get` whose range falls entirely in it answers with no rows.
Gaps name only audio that was never acquired, so silence between words has no row of its own.

## Resources

[`resources.json`](resources.json): the same narration concatenated to 6 min 42 s, transcribed
twice through the worker. Each run took about 1.7 s — 0.004× real time against a target of 1× —
and peaked at 147 MB resident against a target of 4 GiB. Both runs load the model, so the second
is not cheaper than the first; loading it is simply not what this costs.
