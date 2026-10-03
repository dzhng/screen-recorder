# Voice input and numeric admission probes

A one-sample finite reference fails in the pinned speaker spectrogram code before
prefill or generated output. A 1.3-second reference from a complete utterance in
the original recording completes generation. These results support nonempty,
finite reference validation followed by a typed unusable-reference failure when
model preprocessing cannot use it; they do not define a universal minimum duration
or guarantee speaker similarity for every short recording.

The real utterance is “There's actually a bug here.” Existing ASR marks it at
26.689–27.649 source seconds. The experiment extracts decoded seconds26.5–27.8
using the already-used ffmpeg Float32 mono24k recipe, preserving context around
that range. [Provenance](report.json) records source origin, complete source hash,
actual command, executable identity and unchanged source after all trials.
The transcript/range authority is ASR; no new listening acceptance is implied.

All successful probes request the complete sentence “Okay, so this is the recorder
workbench.” The short reference reaches EOS after33 codes. With the original frozen
reference, temperature1e-6 and1e6 both reach EOS and return finite PCM, after39 and65
codes respectively. These are numerical endpoint execution checks, not quality
recommendations or a proof of every intermediate value. Earlier sampler-only
[evidence](../19d-voice-envelope/README.md) retains finite but unusably small
numbers that overflow logits; finite JSON validation alone is insufficient.

The initial scratch controller incorrectly used the reference filename as the
prospective output filename, then tested that the input path was absent after the
expected tiny-reference failure. That assertion failed; the model had already
refused correctly and the input bytes remained unchanged. The corrected controller
uses distinct `.output.wav` destinations. Both attempts are retained. There was
no production defect or model-parameter change hidden by this repair.

[The archive](evidence.tar.xz) contains every request, both new reference WAVs, generated WAVs,
refusal, initial harness failure, corrected controller and process observation.
All files match [the size/hash manifest](artifact-files.json). Runtime/model checks
remain unchanged and inference was serialized after19c released its window; all
processes closed. No production settings, registry identities or limits changed.

The measured joint [resource corner](../19d-voice-corner/README.md), explicit numeric
profile, actual tokenizer/prefill identity, typed unusable-input failure and
no-EOS publication refusal must be brought together in19d adoption. These probes
supply evidence for that contract; they do not themselves enable public generation.

Independent [review](review.log.gz) verified all26 archive members and agreement
between the retained trial receipts and summary; no actionable defects were found.
