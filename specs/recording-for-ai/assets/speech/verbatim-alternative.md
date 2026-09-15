# Verbatim alternative: CrisperWhisper

Status: research-only runtime prepared; diagnostic execution in progress, no engine
selection. Checked 2026-09-15.

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

The pinned model and an isolated Python runtime are now prepared outside the
repository. License suitability for deployment, offline Apple Silicon performance
and independent fidelity remain unresolved. Do not adopt Opus's
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
It produced no transcript. A bounded retry uses Transformers 4.49.0 from the
upstream documented compatible series; all other inference settings stay fixed.
The same four AMI clips are used without reference text or filler prompts. Each
clip has a fifteen-minute deadline. Results, manifests, exact installed versions
and failure logs are retained in `/tmp/screenrec-crisper-evidence`.

This evaluation is permitted by the research license. It does not resolve the
separate operational-deployment restriction or justify integrating the model into
the app. Generated transcripts remain research artifacts outside the repository.
