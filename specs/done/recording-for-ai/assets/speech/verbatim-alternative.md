# Verbatim alternative: CrisperWhisper

Status: research-only offline diagnostic complete; no engine selection. Checked 2026-09-15.

Opus identified this candidate from existing project research, but its restricted
research session could not fetch primary sources or write its requested artifact.
Root checked the current upstream pages directly. The report's recollected license
and causal claims about stock Whisper are not used as evidence.

The current [upstream repository](https://github.com/nyrahealth/CrisperWhisper)
describes CrisperWhisper 2.0 as trained for controllable verbatim transcription,
including fillers and false starts. It documents a PyTorch path for macOS. Its
published disfluency results motivate investigation, but are not our independent
filler or timing acceptance evidence.

The [model license](https://huggingface.co/nyralabs/CrisperWhisper2.0_large/blob/main/LICENSE.md)
separates MIT inference code from restricted weights and outputs. Its definition of
non-commercial use excludes production or operational deployment; a separate
license is required for those uses. A research benchmark would not establish that
this model can ship in the personal app. The
[older model card](https://huggingface.co/nyralabs/CrisperWhisper) labels v1 CC BY-NC
4.0 and superseded. It is not a permissively licensed substitute.

The pinned model and isolated Python runtime remain outside the repository. The
local diagnostic does not establish deployment suitability or acceptance fidelity. Do not adopt Opus's
suggested intermediate recall threshold as acceptance: the spec's existing fidelity
gate still applies. Training overlap with our AMI clips is not established, so a
future result on those clips alone would remain diagnostic.

## Local preparation and first failure

The model revision is `f4334f6e8193f2691212d49b20fa12d370e13896`; runtime source is
`0f5f694d0e3f568b5095020857e1a41542a64479`. Hub verification checked all fourteen
remote files. The additional local files were download-cache metadata.
Model assets are under `/tmp/screenrec-speech-models/crisperwhisper-large`; the
isolated environment is `/tmp/screenrec-crisper-venv`.

The first network-disabled run loaded the model on MPS with float16 weights, then
failed in Transformers 5.17.0 with an `EncoderDecoderCache.layers` attribute error.
It produced no transcript. The bounded retry with Transformers 4.49.0 from the upstream documented compatible
series completed all four clips; other inference settings stayed fixed.
The same four AMI clips are used without reference text or filler prompts. Each
clip has a fifteen-minute deadline. Results, manifests, exact installed versions
and failure logs are retained in `/tmp/screenrec-crisper-evidence`.

This evaluation is permitted by the research license. It does not resolve the
separate operational-deployment restriction or justify integrating the model into
the app. Generated transcripts remain research artifacts outside the repository.

## Diagnostic result

The run emitted 183 timed `um`/`uh` tokens. The same text-alignment method used for
prior engines matched 164 of 185 reference fillers (88.6%); six reference fillers
were deleted and fifteen substituted. Nineteen emitted fillers were unmatched:
two aligned as insertions, thirteen over content words, and four as `um`/`uh` swaps.
These classifications are relative to the transcript, not independent judgments
about what was audible in the headset's room/crosstalk.

The 633-token comparison has 48 substitutions, 21 deletions and 15 insertions
(13.3% token error rate). Eight of 23 truncated words were deleted. Text and timed
word results contained the same filler count, and every returned word range stayed
inside its clip; neither fact validates acoustic boundary accuracy.

The shared process loaded the model in 4.1 seconds. It then processed clips in the
order 04/02/03/01, in approximately 4.5/4.4/11.3/64.8 seconds. The final clip spans
241 seconds. Process peak RSS exceeded the spec's 4 GiB target; this is one run on
a host doing other work, not an isolated warm-performance acceptance measurement.
Upstream emitted attention-mask and attention-output warnings; no model/source
patch was made to suppress them.

The run is stronger filler evidence than the prior candidates, but it does not
establish the required ≥95% manually verified precision/recall, canonical fixture,
boundary timing, or audible cut quality. Training overlap remains unknown. The
operational license restriction remains independently unresolved. Stop this bounded
model experiment here; do not silently convert its improvement into engine selection.
