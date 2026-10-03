# Phrase entrance adjustment

The user found the room-tone phrase ending acceptable but still heard too much
time before the new voice. This audition removes 120ms from that existing wet
phrase and rebuilds only its 5ms entrance crossfade. Every sample after the new
entrance is identical to the corresponding previous sample: voice level, room
tone, phrase ending, exit crossfade and original trailing context are preserved.
The word audition is unchanged. The [user review](../listening-review-2026-09-30.md) now accepts this exact shorter entrance; preserve the accepted output and ending.

[Assembly](assemble.py) and [measurements](report.json) record the exact splice
and byte hashes. [Local transcription](lexical.json) retains the requested words
both alone and in context. This is a lexical safeguard, not listening acceptance.

[Audition the shorter entrance](phrase-shorter-lead-context.wav).

Independent read-only review reconstructed the entrance and checked all 97,952
samples after it against the previous audition. They match exactly; file hashes
and lexical artifact associations also match. No listening acceptance is inferred.
