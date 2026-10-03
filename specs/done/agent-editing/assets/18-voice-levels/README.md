# Voice level audition

The user auditioned the initial replacements: “Voice is close, but joins sound
wrong,” then identified that the new voice sounds louder. Identity is therefore
promising, while splice quality fails human review.

These gain-only contexts isolate level from timing and delivery. The
[reproduction script](../../../../../packages/test-harness/editing/voice/match-levels.py)
matches generated RMS to the available original audio within two seconds on
either side of the replaced interval. It excludes the original replaced slot,
whose different words and duration make it a less useful local level reference.
Silence affects this measurement; this is a controlled audition rather than a
general speech loudness algorithm or a perceptual acceptance claim.

[Measured gains and preservation assertions](report.json) accompany the
[word](word-matched-context.wav) and [phrase](phrase-matched-context.wav).
Original context samples remain exact. The raw generation remains untouched;
duration, boundaries and fades have not changed. The adjusted auditions still
need listening feedback. No join-quality pass is claimed.
