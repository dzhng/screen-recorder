# Familiar sentence with an internal speed change

This pair tests joins inside an understandable complete sentence, rather than
repeating the accepted whole-sentence speed comparison. Only the proposed phrase
“so this is the” is slowed; the surrounding “Okay” and “recorder workbench” retain
their exact original samples.

Listen to [original.wav](original.wav), then
[internal-slower-0.8x.wav](internal-slower-0.8x.wav). Both say:
“Okay, so this is the recorder workbench.” The edited portion starts at 0.470s
and ends at 2.270s in the candidate. **Pass if every word stays clear and both
transitions flow naturally; otherwise name the word or transition that sounds
clipped, repeated, abrupt, or echoey.** The user replied **pass** to this rubric; [the listening record](listening.json)
pins that verdict to these exact candidate bytes.

The selection boundaries are explicitly authored midpoints of inherited ASR
(machine transcript) gaps, not independently confirmed word edges. No protected
whole-word timing labels are established. The [report](report.json) owns source,
worker, selection, output identities and numerical invariants. Exact duration,
unchanged neighbors and excluded-source isolation do not prove natural speech.
This comparison does not enable public retiming or settle short-speech treatment.

[render.py](render.py) is the exact historical scratch assembler, retained to
explain how these bytes were made. It uses the pinned existing native parity
worker and no added processor context, fade, gain adjustment or model. To replay,
copy it into a fresh scratch directory before running it; it writes its outputs
beside itself and uses the recorded checkout paths. Do not run it in this frozen
artifact directory. [commands.json](commands.json) records the actual invocations.

[Remaining acceptance](acceptance-status.md) separates banked numerical proof from
pending listening, protected-word annotations and useful short-speech evidence.
