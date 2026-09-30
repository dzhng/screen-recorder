# Familiar word containment and short-word audition

The [boundary check failed](boundary-listening.json): the user reports that the
first pause splits “Okay.” These retained files are historical evidence, not
verified whole-word selections. The prior naturalness pass applies to the exact
candidate bytes; a complete-word short edit still needs a corrected selection.
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
   The opening selection slows to 0.8×; it was proposed as complete “Okay” but
   the boundary check disproved that label. Everything after it retains its
   original samples.
   The transition back is at 0.5875s. **Pass if “Okay” remains complete and natural
   and flows into “so”; otherwise name the clipping, repetition or unnatural sound.**

[report.json](report.json) owns exact ranges, admission, hashes and checks. The
actual frozen default recipe admitted this selection without a preset switch.
The same-count 120Hz tone passes the existing pitch estimator and unchanged
less-than-1% gate; it does not establish speech quality. This short selected passage
cannot establish whole-word editing, arbitrary shorter selections or an automatic
window policy.

[render.mjs](render.mjs) is the exact historical assembler; copy it into a fresh
scratch directory before replay, since it writes beside itself using recorded
checkout paths. Do not run it in this frozen evidence directory. The retained
[commands](commands.json) and tone PCM allow inspection without a new render.
There was no model download, build, hidden source context, added padding, fade,
gain change or public retiming adoption. [Listening feedback](listening.json) records the user's acceptance: “Okay” is
complete and natural, including its join into “so.” The earlier report of no
noticeable difference is retained. Independent boundary containment remains
separate; this verdict does not approve other rates or arbitrary shorter words.

Use the [revised boundary reference](../13a-word-boundary-correction/README.md)
for the next check; retain these original artifacts and verdicts unchanged.
