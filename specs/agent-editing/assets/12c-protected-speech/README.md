# Protected-speech review packet

This packet makes the remaining word/onset/end review concrete. It does **not**
repeat the candidate-choice question: the user's [learned-filter preference](../12c-matched-noise/audition/README.md)
stands. No audio was auditioned during assembly, and no speech-quality verdict or
confirmed word boundary is recorded here.

The [user review](user-review.json) found these tiny unfamiliar excerpts confusing.
The user heard nothing obviously weird but could not understand the words. This
supplies a scoped no-obvious-artifact observation; intelligibility and word
retention remain unverified. No further action on these clips was requested.
Future user comparisons should use complete meaningful sentences from the user's
recording with one clear listening question. Do not re-present this crop packet
as required user QA.
A [complete familiar sentence](../12c-familiar-sentence/README.md) now provides
original/processed public outputs and its exact user word-clarity/naturalness
pass. That scoped verdict does not close the broader material/spatial gate.

The original two short pairs remain below as archived evidence; other files
provide optional technical context:

1. Opening: [reference](clean-reference-start-candidate.wav), then
   [learned](clean-rnnoise-reference-start-candidate.wav).
2. Ending: [reference](clean-reference-end-candidate.wav), then
   [learned](clean-rnnoise-reference-end-candidate.wav).

Judge whether consonants and word endings remain intact, and whether pumping,
metallic sounds or echo appear. The candidate words and crop boundaries are
unconfirmed; use the [full reference](clean-reference-whole.wav) and
[full learned context](clean-rnnoise-reference-whole.wav) if either crop cuts a word.
For the existing split vicinity only, optionally compare the short
[original noisy context](original-mixture-split-context.wav) and
[learned context](original-rnnoise-mixture-split-context.wav) for a click, missing
syllable or abrupt change. This is a targeted annotation check, not a request to
listen to all 18 files or choose the preferred filter again.

All new WAVs are mono 48 kHz float PCM at **unity gain**, with no filtering,
normalization, resampling, fades or new inference. Full views reproduce the retained
PCM bytes exactly; short views are exact slices of those full views. Learned PCM
already carries the frozen 960-sample compensation; it is not shifted again.
Original raw gain/clipping evidence remains intact. The earlier separately
RMS-matched [original auditions](../12c-matched-noise/audition/README.md) and
[prepared whole/split auditions](../12c-prepared-output/README.md) remain available;
the new unity-gain views may be quieter, and volume changes must not be mistaken
for a quality judgment.

## Independent clean utterance

The [dataset transcript and source identity](../12c-clean-reference/selection.json)
are retained: “MISTER QUILTER IS THE APOSTLE OF THE MIDDLE CLASSES AND WE ARE GLAD
TO WELCOME HIS GOSPEL.” This is a known transcript, **not** word-level timing.
The complete 5.855-second context is available in every row. Opening/ending crops
are fixed 1.5-second review windows, not asserted complete-word boundaries.

| Signal | Complete context | Opening candidate | Ending candidate |
| --- | --- | --- | --- |
| Clean reference | [Whole](clean-reference-whole.wav) | [0–1.5s](clean-reference-start-candidate.wav) | [4.355–5.855s](clean-reference-end-candidate.wav) |
| Reference through learned filter | [Whole](clean-rnnoise-reference-whole.wav) | [Opening](clean-rnnoise-reference-start-candidate.wav) | [Ending](clean-rnnoise-reference-end-candidate.wav) |
| Reference with known added noise | [Whole](clean-mixture-whole.wav) | [Opening](clean-mixture-start-candidate.wav) | [Ending](clean-mixture-end-candidate.wav) |
| Noisy mixture through learned filter | [Whole](clean-rnnoise-mixture-whole.wav) | [Opening](clean-rnnoise-mixture-start-candidate.wav) | [Ending](clean-rnnoise-mixture-end-candidate.wav) |

Candidate annotation targets are the opening “MISTER QUILTER,” ending “HIS GOSPEL,”
and consonants in “APOSTLE”/“CLASSES” within the full utterance. Their exact locations
and crop containment are **unconfirmed**. Use the whole utterance if a crop cuts a
word; do not accept or reject an endpoint based on an arbitrary crop edge. First
confirm the reference words, then compare reference-only learned output and noisy
learned output for missing consonants/onsets/ends, altered words, pumping or echo.
A quieter noise floor alone does not answer those questions.

## Original recorded cohort and existing split marker

This is the same five-second retained recorded context used by the earlier
matched-noise and preferred audition. The reference includes its original ambience;
it is not a clean studio ground truth. No transcript is assigned to this context:
the voice experiment's separate 1–6s reference transcript does not describe this
71.5–76.5s context excerpt. The packet's authoritative coordinates are local PCM
samples; the earlier recording interval is provenance from its [retained manifest](../18-voice/manifest.json).

| Signal | Full five-second context | Existing split vicinity |
| --- | --- | --- |
| Recorded reference | [Whole](original-reference-whole.wav) | — |
| Reference through learned filter | [Whole](original-rnnoise-reference-whole.wav) | — |
| Reference with known added noise | [Whole](original-mixture-whole.wav) | [Context](original-mixture-split-context.wav) |
| Noisy mixture through learned filter | [Whole](original-rnnoise-mixture-whole.wav) | [Context](original-rnnoise-mixture-split-context.wav) |

The retained pure-split marker is frame 112002 (2.333375s), inside the view
[100002,124002), or 2.083375–2.583375s. This packet creates no cut, splice or new
processing boundary. Prior numerical evidence already proves split/whole equality;
these excerpts expose the surrounding speech for annotation, not another state
experiment. Which words/consonants occupy it remains unconfirmed. Compare against
full context before recording any lost-word or artifact concern.

## Annotation and evidence boundary

[Annotation prompts](annotations.json) deliberately leave boundary confirmation,
observed words and quality judgments empty. Reviewers can record a source-relative
interval and observation, distinguishing uncertainty from a confirmed omission.
No listener is asked to repeat the earlier overall filter preference.

[Manifest](manifest.json) pins every source/report/WAV hash, exact sample interval,
gain, RMS and peak. [Assembler](assemble.py) only decompresses, validates retained
identities and writes WAV headers/slices. [Acceptance audit](acceptance-audit.md)
separates missing behavior from stale handoffs. [Independent metadata review](review.txt) verified all 18 views, source hashes,
headers, gain and compensation; [local preservation checks](verification.json)
also verified exact payloads and readable WAV metadata. Neither judges
intelligibility or naturalness.

The durable preparation owner, public preparation and portable unit-rate/gain
receipts now exist in 14a. Actual RNNoise adoption, target/channel/transition policy,
post-retime/combined speech and independent listening remain open in 12c/15a.
This packet neither advertises a processor nor closes those gates.
