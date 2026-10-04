# Auditioning a cut made from transcript evidence

The narrator of the [checked-in take](../../../../../fixtures/narrated-workbench/README.md) listened
to the same five-second playback window, 71.5 s to 76.5 s, in two revisions: the original, where
the sentence "this is free" is spoken, and the revision an agent produced by cutting the three
word IDs `transcript.search` returned for that phrase.

Their verdict, in their words: "cut-join sounds as clean as orginal-phrase, just with something
cut."

That is the audition this release needs a person for. The cut boundaries came from word timings
the engine produced, not from hand-placed marks, and the words either side of the removed phrase
survived without a clipped syllable at the join.

## What this does and does not establish

It establishes that one cut, derived from real narration, joins audibly cleanly, and that the
five-millisecond ramps at a join do not swallow neighbouring speech.

It does not measure word boundary error. That separate measurement is recorded in
the [boundary evidence](../speech/boundaries/README.md), using independent visual
marks rather than letting the engine's own timings grade themselves. One listener,
one cut and one take are also not a distribution. The approval here applies to
the exact historical cut in `journey.json`; it does not transfer automatically to
different boundaries from a later transcription generation.
