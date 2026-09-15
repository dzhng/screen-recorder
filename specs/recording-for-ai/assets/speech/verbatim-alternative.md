# Verbatim alternative: CrisperWhisper

Status: research only, no download or engine selection. Checked 2026-09-15.

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

No new runtime/model is installed. License suitability, offline Apple Silicon
performance and independent fidelity remain unresolved. Do not adopt Opus's
suggested intermediate recall threshold as acceptance: the spec's existing fidelity
gate still applies. Training overlap with our AMI clips is not established, so a
future result on those clips alone would remain diagnostic.
