# Room tone and tighter joins

The user rejected the speaker-only conditioning mode as much worse, still heard
excess margins, and identified the missing original background hum. This audition
keeps the closer original generation and mixes in a quiet region from the same
recording. It does not generate artificial ambience or claim to remove echo.

[Extraction provenance](extraction.json) identifies the pause and source bytes.
Its stable interior supplies the [room tone](room-tone.wav), looped with short
overlaps at its recorded RMS level. [Assembly](assemble.py) records explicit
generated crops and original replacement boundaries in the [recipe](report.json).
Dry and room-tone contexts differ only in the added background. Both use 5ms
crossfades into original context; all original samples outside those declared
transition/replacement windows remain exact.

The shorter generated clips with room tone pass the [isolated word check](lexical.json).
A [first sentence check](context-before-boundary-adjustment.json) dropped “is”
before “paid,” prompting a boundary adjustment. The [revised sentence check](context-lexical.json)
retains “this is paid” and the requested phrase. The unchanged final fragment is
recognized differently (“in”/“here”), illustrating that these checks are not
proof of perfect pronunciation or protected-word preservation. Listening remains
the quality gate. The [user review](../listening-review-2026-09-30.md) accepts the current word
and shortened phrase contexts but hears a voice blip in the pause. Its speech-free
source-region gate fails; the retained interior may include that blip and must not
be treated as approved ambience.

Audition [word](word-room-context.wav) and [phrase](phrase-room-context.wav).
[Dry word](word-dry-context.wav) and [dry phrase](phrase-dry-context.wav) retain
the same new timing and transitions for a controlled background comparison.

Independent Codex review re-extracted the pause from the original file and
reconstructed all four contexts. Time-origin conversion, PCM, crop/gain/loop
math, transition windows and hashes match. It found no actionable defects and
did not infer listening acceptance from those checks.
