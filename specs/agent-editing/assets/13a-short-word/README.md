# Familiar word containment and short-word audition

This packet separates two judgments. Machine-transcript gap midpoints proposed
the selection; no independent word-containment or listening verdict is claimed.
The complete reference sentence is “Okay, so this is the recorder workbench.”

1. Listen to the [full sentence with two deliberate pauses](boundary-annotation-reference.wav):
   “Okay” | “so this is the” | “recorder workbench.” **Do both pauses fall between
   complete words, leaving each of those three groups intact?** Name any cut-off
   word. This is an annotation reference, not a naturalness candidate: exactly
   500ms of digital silence was inserted at each proposed boundary. Every
   original sample otherwise remains unchanged and in order. Confirmation would
   establish conservative whole-word containment, not sample-exact phoneme edges.
   [The mapping](annotation-reference.json) records the inserted silences and
   source-to-output segments. The separate [opening](protected-opening-reference.wav)
   and [ending](protected-ending-reference.wav) spans remain for provenance.
2. Compare the original with [the short-word candidate](short-word-slower-0.8x.wav).
   Only the proposed complete “Okay,” including explicitly selected surrounding
   context, slows to 0.8×; everything after it retains its original samples.
   The transition back is at 0.5875s. **Pass if “Okay” remains complete and natural
   and flows into “so”; otherwise name the clipping, repetition or unnatural sound.**

[report.json](report.json) owns exact ranges, admission, hashes and checks. The
actual frozen default recipe admitted this selection without a preset switch.
The same-count 120Hz tone passes the existing pitch estimator and unchanged
less-than-1% gate; it does not establish speech quality. This one useful short-word
case cannot establish arbitrary shorter selections or an automatic window policy.

[render.mjs](render.mjs) is the exact historical assembler; copy it into a fresh
scratch directory before replay, since it writes beside itself using recorded
checkout paths. Do not run it in this frozen evidence directory. The retained
[commands](commands.json) and tone PCM allow inspection without a new render.
There was no model download, build, hidden source context, added padding, fade,
gain change or public retiming adoption. [Listening feedback](listening.json) records the user's report of no noticeable
difference in “Okay.” This is not an explicit failure or a resolved naturalness
verdict; whole-word containment remains separate.
