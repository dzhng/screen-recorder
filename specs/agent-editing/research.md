# Research and evidence boundaries

Planning research, 2026-09-27. These sources establish available mechanisms;
they do not prove that this application's new editor or audio quality works.
No media runtime or model is selected by a marketing claim.

## Existing evidence

Repository baseline inspected: `d0b1dca7d1225728d4c6c3353ff26675e33e084f`.
Discovery documentation and the product skill are additional working-tree files.
The [discovery map](MAP.md) records the bounded code survey and user decisions.

The [narrated workbench](../../fixtures/narrated-workbench/README.md) contains the
user's real voice, fillers and a repeated phrase, with a capture journal. Reuse
it in an isolated library; never mutate the source fixture or a personal library.
Read-only ffprobe inspection during planning found a 3120×1970 H.264 video lasting
134.025574 seconds and mono 48 kHz float PCM narration lasting 133.973333 seconds.
Those unequal stream durations are a real synchronization test, not an error to
hide by making all tracks equal. The video reports a non-integral average frame
rate; sample timestamps, not an assumed 30 fps source clock, own decoding.

Existing [speech boundary measurements](../recording-for-ai/assets/speech/boundaries/README.md)
missed the requested accuracy on real speech, including boundaries inside speech.
Amplitude detection was confused by typing/clicking. Keep the measurements and
their small-sample limitation; do not relabel current ASR as word-perfect or
guaranteed to retain every filler. A transcript omitting a filler is not evidence
that there is nothing to remove.

## Primary-source research

| Mechanism | Source and finding | Consequence for the plan |
| --- | --- | --- |
| Editorial data model | [OpenTimelineIO structure](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/otio-timeline-structure.md) describes clips, tracks and application-specific effects; [project documentation](https://opentimelineio.readthedocs.io/en/latest/) distinguishes timeline interchange from media storage. | Use it as a vocabulary/reference, not a render engine or a second canonical project representation. OTIO interchange is not required for this release. |
| Native retiming | [AVMutableComposition scaling](https://developer.apple.com/documentation/avfoundation/avmutablecomposition/scaletimerange(_:toduration:)) maps source durations to target durations. [AVAudioUnitTimePitch](https://developer.apple.com/documentation/avfaudio/avaudiounittimepitch) exposes independent rate and pitch. | Reproduce a native offline stretch before choosing its production use. Duration scaling alone does not establish pitch-preserving quality. |
| Offline audio | Apple's [offline processing sample](https://developer.apple.com/documentation/avfaudio/performing-offline-audio-processing) drives audio rendering from the application without speaker output. | Use an offline sample-based probe, not real-time playback, for bounded and repeatable stretching experiments. |
| Native video | [AVVideoComposition](https://developer.apple.com/documentation/avfoundation/avvideocomposition) and [custom composition requests](https://developer.apple.com/documentation/avfoundation/avvideocompositing/startrequest(_:)) are candidate native execution mechanisms. | Native replay/seek, color/orientation and multi-input composition need a runnable reproduction before expanding the existing renderer. Keep edit semantics in core. |
| Audio and visual inspection | [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) document waveform/spectrogram generation, tempo adjustment, overlay and audio mixing. | Use the installed tool as a research comparator and independent fixture inspector. Its presence does not add a production dependency or prove a distributable build. |
| Alternate stretching | [Rubber Band](https://breakfastquay.com/rubberband/) and its [licensing options](https://breakfastquay.com/technology/license.html) describe a separate stretch implementation and distribution terms. | A candidate if the native baseline fails; evaluate the actual implementation and license before adopting it. No purchase or new dependency is authorized by this spec alone. |
| Local voice synthesis | [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS), its [fine-tuning guide](https://github.com/QwenLM/Qwen3-TTS/blob/main/finetuning/README.md), and [MLX Audio's implementation](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/tts/models/qwen3_tts/README.md) document reference-audio synthesis and, separately, training. | First reproduce reference-conditioned inference using the actual selected audio and text. Fine-tuning is a fallback experiment, not a required enrollment step. |
| Alternate alignment | [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) documents a separate forced-alignment model. | Candidate only if the current word-boundary/filler evidence gate fails. Alignment can refine timing of supplied text; it does not prove discovery of words the transcript omitted. |

Apple documentation was read through its published `.md` representations where
the regular pages required JavaScript. Model, code and dependency versions must be
pinned by the implementing experiments; moving documentation links are context,
not immutable execution evidence.

## Local feasibility envelope, not performance claims

The observed host is Apple M5 Pro with 48 GiB memory. FFmpeg 8.1.2 and ffprobe
are installed. The local FFmpeg reports GPL-enabled build options; do not copy it
into the product as an incidental packaging step. No model was downloaded, trained,
benchmarked or evaluated during planning. The Mac's RAM is not proof of acceptable
latency, memory use or voice similarity.

## Freeze each accepted experiment

Every research slice produces an evidence manifest containing:

- input SHA-256 hashes, source selection/ranges and relevant generation identities;
- exact source commit, dependency locks, model revision and weight hashes;
- invocation, parameters, output hashes and hardware/OS/runtime versions;
- expected observations, measurements, actual outcome and quality limitations;
- a runnable reference entry point and the production slice that adopts it.

Production integration compares matched inputs at its real entry point against
that frozen reference. For deterministic timing/geometry, compare complete plans
and decoded values. For stochastic synthesis, compare the computed request,
reference audio identity and acceptance metrics; do not require identical waveforms
unless the selected runtime demonstrates deterministic generation.

Do not reimplement a successful experiment from its prose description. Keep its
known configuration and behavior until parity is proved. A different native port,
quantization, model, or inference parameter is a new experiment, not cleanup.

## Explicit feasibility exits

A failed research gate does not silently remove user scope or become a passing
mock. Record the failure, try the bounded alternative named by that slice, and
reslice the failing seam if neither works. Unrelated dependency-ready work can
continue. Keep the capability incomplete and report the exact limitation.
