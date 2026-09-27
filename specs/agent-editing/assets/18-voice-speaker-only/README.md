# Speaker-only conditioning audition

Status: rejected by the user as “way worse.” Retained as negative research
evidence; this mode is not the selected candidate.

The user described the reference-conditioned generation as more echoey than the
original take. The pinned local runtime supports a second path: supplying
reference audio without its transcript extracts a speaker representation without
conditioning on the full reference speech sequence. This is a hypothesis test
for the acoustic mismatch, not a claim that the mode removes reverberation.

The model, reference bytes, seed and effective repetition penalty match the
initial experiment. [Generation evidence](generation.json) and the
[generator](generate.py) preserve the two outputs. The generator takes the
prepared model directory as its sole argument; the observed run used OS network
denial and offline model flags. No model downloads or fine-tuning were performed.

[Assembly](assemble.py) applies local level matching, explicit conservative
crops and short generated-only edge ramps. The [recipe](report.json) records
those choices and exact original-context preservation. Both [raw](raw-lexical.json)
and [assembled](lexical.json) word checks pass. Identity, room sound, prosody and
join quality require listening and remain unaccepted.

Audition [word](word-context.wav) or [phrase](phrase-context.wav). Compare against
the [tighter original-mode samples](../18-voice-joins/README.md); delivery and
generation length differ, so this is a mode comparison, not an isolated numerical
reverberation measurement.
