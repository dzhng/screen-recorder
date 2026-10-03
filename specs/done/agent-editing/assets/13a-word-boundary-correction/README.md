# Revised full-sentence boundary reference

The user reports that the previous first pause splits “Okay.” This reference moves
only that first pause 180.125 ms later, into a measured lower-energy region. The
second pause stays unchanged. A low-energy region is not proof of a word boundary;
[The user accepts the revised pause placement](listening.json), while reporting
the digital-silence pauses as abrupt. This does not accept a natural editorial
join or either background-audio treatment. Corrected stretch selections still
need their own verification.

Listen to [the revised reference](boundary-reference.wav). Does the first pause now
follow the complete “Okay,” and does the second sit between “the” and “recorder”?
Name any split or misplaced word. The pauses start at about 0.65 s and 2.41 s in
this file. Judge word placement only, not whether the deliberately paused sentence
sounds natural.

Every original sample stays unchanged and in order, with two 500 ms silences added.
[The report](report.json) pins identities, timing, sample equality and the measured
energy comparison. [The assembler](assemble.py) reproduces these bytes from the
hash-pinned original. No speech model or stretching engine is used here.

The earlier [failed boundary verdict](../13a-short-word/boundary-listening.json)
and naturalness verdicts remain scoped to their original files. They do not approve
this new candidate or establish the old selections as whole-word edits.

Independent read-only verification confirms the WAV/header identities, exact
source samples, coordinate maps, both inserted silences and numerical energy
measurements. Mechanical checks and the scoped placement verdict are separate
from speech naturalness and background-continuity acceptance.
