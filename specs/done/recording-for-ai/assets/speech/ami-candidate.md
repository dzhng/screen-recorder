# Human speech fixture candidate

AMI TS3003c, speaker B, is available locally under
`/tmp/screenrec-speech-fixture-evidence`. Meeting metadata maps B to headset channel 1.
The downloaded audio is 2570 seconds, 16kHz mono; its transcript contains 1363 timed
word entries, including 309 entries exactly matching um/uh case-insensitively.
Hashes, file sizes and mapping provenance are in `ami-candidate.json`.

The [official corpus site](https://groups.inf.ed.ac.uk/ami/corpus/) releases audio
and transcripts under CC BY4.0. The local annotation archive includes that licence.
The [transcription documentation](https://groups.inf.ed.ac.uk/ami/corpus/transcription.shtml)
describes human verbatim transcription but automatic word/phoneme timing from forced
alignment. Therefore these timestamps are not independent manually verified timing
truth for the current acceptance gate.

This is a candidate for calibration and manual annotation, not a passed fidelity
fixture. The next step is to select natural single-speaker clips, check channel
bleed and audible fillers, then manually validate at least 40 held-out filler
boundaries and required repetitions/false starts. Keep those reviewed boundaries
separate from the corpus's automatic alignment. Do not feed the current XML directly
into the gate as manually labelled truth. No model selection or ASR score was made.

The Opus research run reached its $8 exploration cap before producing a final
report. Root verified the downloaded files and primary-source timing provenance.
Audio remains outside the repository; no personal recording was read or made.
