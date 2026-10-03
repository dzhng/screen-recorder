# Tighter generated-speech joins

The user still heard excessive pauses and a more echoey voice after the level
audition. These crops address margins only; they do not prove a reduction in
reverberation. [Recipe and preservation evidence](report.json) records explicit
crop ranges and the unchanged gain. Five-millisecond ramps modify generated
edge samples only; original context remains exact. [Reproduce](reproduce.py)
requires the prepared voice experiment Python environment.

The initial shorter word crop failed the recognizer (paid became page); its
[audio](rejected-short-word/word.wav), [recipe](rejected-short-word/recipe.json)
and [failed check](rejected-short-word/lexical.json) remain evidence against
using ASR boundaries as exact acoustic cuts. Restoring the consonant tail passes
the [lexical check](lexical.json), as does the trimmed phrase. These results are
word agreement, not listening acceptance.

Audition [word](word-tight-context.wav) and [phrase](phrase-tight-context.wav).
The [alternative conditioning comparison](../18-voice-speaker-only/README.md)
tests the echo complaint separately; neither candidate is accepted yet.

Independent Codex inspection reconstructed both candidates from the original
PCM, checked hashes, crops, gains, ramps and the unchanged context, and found
no actionable defects. It also verified that the lexical reports refer to the
retained candidate bytes. It made no listening-quality claim.
