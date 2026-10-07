---
license: openmdw-1.1
pipeline_tag: voice-activity-detection
library_name: nemo
tags:
- speaker-diarization
- streaming-sortformer
- speaker-tagging
- transformers
---

# Nemotron 3 Diarization

## Description



**[Nemotron 3 Diarization](https://huggingface.co/blog/nvidia/nemotron-diarization)** is an open-weight speaker diarization model designed to determine "who spoke when" in real-world audio. It supports both streaming and offline inference and handles up to eight speakers. Following Sortformer [\[1\]](#ref-1), the model resolves speaker permutation by ordering its output channels according to each speaker's first arrival in the input audio.

For streaming inference, the model adopts the Arrival-Order Speaker Cache (AOSC) and FIFO queue introduced in **Streaming Sortformer** [\[2\]](#ref-2). The AOSC retains speaker information from earlier chunks to preserve speaker identities over time, while the FIFO queue provides recent frame context for each processing step.

A single checkpoint supports input buffer latency as low as 80 ms for latency-critical applications, although the lowest recommended configuration is 0.32 s; the offline-style configuration uses a 30.4 s input buffer. The output frame resolution is configurable in multiples of 10 ms. With chunked inference, the maximum audio duration is not limited.

**This model is ready for commercial or non-commercial use.**


**[Nemotron 3 Diarization HuggingFace Blog](https://huggingface.co/blog/nvidia/nemotron-diarization)** 

## Release Date

September 23, 2026

## Live Action Demo Page

[**Hugging Face Spaces Demo: Nemotron-Diarization with Streaming ASR**](https://huggingface.co/spaces/nvidia/nemotron-diarization)
[![Nemotron-Diarization with Streaming ASR Demo](https://huggingface.co/nvidia/Nemotron-3-Diarization/resolve/main/streaming_diarization_demo.gif)](https://huggingface.co/spaces/nvidia/nemotron-diarization)

## What does max 8-speaker diarization mean ? 

<video controls src="https://huggingface.co/nvidia/Nemotron-3-Diarization/resolve/main/nemotron3_tts_8_open_voices.mp4" width="100%"></video>
---

## How to use this model

### Run locally with NeMo-Speech.cpp

[NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp) provides a
lightweight native C++ runtime for local speaker diarization. After
[installing the runtime](https://github.com/NVIDIA/NeMo-Speech.cpp#installation):

```bash
nemo-speech diarize meeting.wav
```

The same model can add word-level speaker tags to a transcription:

```bash
nemo-speech transcribe meeting.wav --diarize --json
```

See the [NeMo-Speech.cpp diarization guide](https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/docs/cli.md#diarize-audio)
for more usage examples.

### NVIDIA NeMo Speech

To train, fine-tune or perform inference with this model, install [NVIDIA NeMo Speech](https://github.com/NVIDIA-NeMo/Speech) after installing Python 3.12 or later, Cython, and a recent PyTorch version.

```bash
apt-get update && apt-get install -y libsndfile1 ffmpeg
uv pip install Cython packaging
uv pip install 'nemo-toolkit[asr]'
```

#### 🚀 Quick Start: Run Diarization Now

Here is a short example script that loads the model, runs diarization on a WAV file, and prints the results:

```python
from nemo.collections.asr.models import SortformerEncLabelModel
diar_model = SortformerEncLabelModel.from_pretrained("nvidia/Nemotron-3-Diarization")
diar_model.eval()

diar_model.sortformer_modules.chunk_len = 340
diar_model.sortformer_modules.chunk_right_context = 40
diar_model.sortformer_modules.fifo_len = 40
diar_model.sortformer_modules.spkcache_update_period = 300
diar_model._check_streaming_parameters()

predicted_segments = diar_model.diarize(audio=["/path/to/your/audio.wav"], batch_size=1)

for segment in predicted_segments[0]:
    print(segment)
```

#### Loading the Model

```python
from nemo.collections.asr.models import SortformerEncLabelModel

# load model from Hugging Face model card directly (You need a Hugging Face token)
diar_model = SortformerEncLabelModel.from_pretrained("nvidia/Nemotron-3-Diarization")

# If you have a downloaded model in "/path/to/Nemotron-3-Diarization.nemo", load model from a downloaded file
diar_model = SortformerEncLabelModel.restore_from(restore_path="/path/to/Nemotron-3-Diarization.nemo", map_location='cuda', strict=False)

# switch to inference mode
diar_model.eval()
```

#### Input Format
Input can be an individual audio file:
```python
audio_input="/path/to/multispeaker_audio1.wav"
```
or a list of paths to audio files:
```python
audio_input=["/path/to/multispeaker_audio1.wav", "/path/to/multispeaker_audio2.wav"]
```
or a numpy array (single or list):
```python
import numpy as np
audio_input = np.random.randn(16000 * 10).astype(np.float32)  # 10 sec at 16kHz
# or a list of arrays
audio_input = [audio_array1, audio_array2]
diar_model.diarize(audio=audio_input, batch_size=2, sample_rate=16000)
```
Note: When using numpy arrays, you **MUST** specify a correct `sample_rate` in `diar_model.diarize()` function. 
Default `sample_rate` is `16000`.

or a line-delimited JSON manifest file:
```python
audio_input="/path/to/multispeaker_manifest.json"
```
where each line is a JSON object containing the following fields:
```jsonl
{"audio_filepath": "/path/to/multispeaker_audio1.wav", "offset": 0, "duration": 600}
{"audio_filepath": "/path/to/multispeaker_audio2.wav", "offset": 900, "duration": 580}
```

#### Setting up Streaming Configuration

Streaming configuration is defined by the following parameters, all measured in **80 ms frames**:
* `SPKCACHE_LEN`: Total number of frames in the speaker cache. 
* `FIFO_LEN`: Number of previous frames attached before the current chunk from the FIFO queue.
* `CHUNK_LEN`: Number of frames in a processing chunk.
* `RIGHT_CONTEXT`: Number of future frames attached after the chunk.
* `UPDATE_PERIOD`: Number of frames extracted from the FIFO queue to update the speaker cache.

Here are recommended configurations for different scenarios:
| **Configuration**           | **Latency**              | `SPKCACHE_LEN`  | `FIFO_LEN`  | `CHUNK_LEN`  | `RIGHT_CONTEXT` | `UPDATE_PERIOD` |
| --------------------------- | ------------------------ | --------------- | ----------- | ------------ | --------------- | --------------- |
| Very high latency (offline) | 30.4 s                   | 264             | 40          | 340          | 40              | 300             |
| Low latency                 | 1.04 s                   | 264             | 264         | 9            | 4               | 222             |
| Very low latency            | 0.64 s                   | 264             | 264         | 6            | 2               | 222             |
| Ultra-low latency           | 0.32 s                   | 264             | 264         | 3            | 1               | 222             |

> [!Note]
> **Latency** refers to **Input Buffer Latency**, calculated as (**CHUNK_LEN** + **RIGHT_CONTEXT**) × 80 ms. This value does not include computational processing time.

To set streaming configuration, use:
```python
diar_model.sortformer_modules.spkcache_len = SPKCACHE_LEN
diar_model.sortformer_modules.fifo_len = FIFO_LEN
diar_model.sortformer_modules.chunk_len = CHUNK_LEN
diar_model.sortformer_modules.chunk_right_context = RIGHT_CONTEXT
diar_model.sortformer_modules.spkcache_update_period = UPDATE_PERIOD
diar_model._check_streaming_parameters()
```

#### Getting Diarization Results

To perform speaker diarization and get a list of speaker-marked speech segments in the format 'begin_seconds, end_seconds, speaker_index', simply use:
```python
predicted_segments = diar_model.diarize(audio=audio_input, batch_size=1)
```

To obtain tensors of speaker activity probabilities, use:
```python
predicted_segments, predicted_probs = diar_model.diarize(audio=audio_input, batch_size=1, include_tensor_outputs=True)
```
Note that if you are feeding a list of numpy arrays, you **MUST** provide the `sample_rate` in integer format.

```python
predicted_segments, predicted_probs = diar_model.diarize(audio=[np_array1, np_array2], batch_size=2, sample_rate=16000)
```

#### 🔬 For more detailed evaluations (DER)

If you need to perform a comprehensive evaluation and calculate the accuracy and speed metrics across different parameter settings, use the NeMo example script [e2e_diarize_speech.py](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/neural_diarizer/e2e_diarize_speech.py).
This script allows you to test the streaming behavior of the model by adjusting key parameters like `chunk_len`, `fifo_len`, `chunk_right_context` and `spkcache_update_period`.
```bash
python ${NEMO_ROOT}/examples/speaker_tasks/diarization/neural_diarizer/e2e_diarize_speech.py \
    pretrained_name="nvidia/Nemotron-3-Diarization" \
    dataset_manifest="/path/to/diarization_manifest.json" \
    batch_size=32 \
    collar=0 \
    precision=bf16 \
    compile_encoder=false \
    spkcache_len=264 \
    spkcache_update_period=300 \
    fifo_len=40 \
    chunk_len=340 \
    chunk_right_context=40
```

More details on the evaluation can be found in the [Diarization Evaluation](diarization_evaluation.md) subcard.

### 🤗 Transformers usage

This model is supported natively in [🤗 Transformers](https://github.com/huggingface/transformers)!
Install from source:

```bash
pip install git+https://github.com/huggingface/transformers
```

For more details about usage, please refer to the [Transformers documentation](https://huggingface.co/docs/transformers/en/model_doc/nemotron3_diarization).

<details>
  <summary>➡️ Offline diarization</summary>

```python
import torch
from transformers import AutoModelForAudioFrameClassification, AutoProcessor
from transformers.audio_utils import load_audio

model_id = "nvidia/Nemotron-3-Diarization"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForAudioFrameClassification.from_pretrained(model_id, device_map="auto")

sampling_rate = processor.feature_extractor.sampling_rate
audio = load_audio(
    "https://huggingface.co/datasets/hf-internal-testing/dummy-audio-samples/resolve/main/diarization_example.mp3",
    sampling_rate=sampling_rate,
)
inputs = processor(audio, sampling_rate=sampling_rate).to(model.device, dtype=model.dtype)

with torch.inference_mode():
    logits = model(**inputs).logits  # (1, num_frames, 8), one frame every 10 ms

segments = processor.extract_speaker_dict(logits, inputs.attention_mask)[0]
for segment in segments:
    print(f"speaker_{segment['Speaker']}: {segment['Start']:.2f}s - {segment['End']:.2f}s")
```
</details>

<details>
  <summary>➡️ Streaming diarization</summary>

Audio arrives chunk by chunk, and each forward takes one chunk: the processor cuts it for its `streaming_mode` and
adds `num_lookahead_frames`, the number of trailing look-ahead frames the model attends to but does not score, since
they open the next chunk. The forward returns the `speaker_cache` to pass to the next call. The last chunk of a
session is extracted with `is_last_audio_chunk=True`: it has no look-ahead, so every remaining frame is scored.


| `streaming_mode`          | Latency¹ |
| ------------------------- | -------- |
| `"low_latency"` (default) | 1.04 s   |
| `"very_low_latency"`      | 0.64 s   |
| `"ultra_low_latency"`     | 0.32 s   |


¹ Audio to wait for before the model runs on a chunk: the chunk plus its look-ahead, excluding compute time.

```python
import torch
from transformers import AutoModelForAudioFrameClassification, AutoProcessor
from transformers.audio_utils import load_audio

model_id = "nvidia/Nemotron-3-Diarization"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForAudioFrameClassification.from_pretrained(model_id, device_map="auto")
processor.set_streaming_mode("low_latency")  # the default, can also be "very_low_latency" and "ultra_low_latency"
print(f"Streaming latency: {processor.streaming_latency_ms} ms")

sampling_rate = processor.feature_extractor.sampling_rate
audio = load_audio(
    "https://huggingface.co/datasets/hf-internal-testing/dummy-audio-samples/resolve/main/diarization_example.mp3",
    sampling_rate=sampling_rate,
)


def inputs_generator():
    """Yields the processor outputs of each chunk."""
    yield processor(
        audio[: processor.num_samples_first_audio_chunk],
        sampling_rate=sampling_rate,
        is_streaming=True,
        is_first_audio_chunk=True,
    )

    mel_frame_idx = processor.num_mel_frames_per_step
    start_idx = processor.audio_chunk_start(mel_frame_idx)
    while (end_idx := start_idx + processor.num_samples_per_audio_chunk) <= audio.shape[0]:
        yield processor(
            audio[start_idx:end_idx],
            sampling_rate=sampling_rate,
            is_streaming=True,
            is_first_audio_chunk=False,
        )
        mel_frame_idx += processor.num_mel_frames_per_step
        start_idx = processor.audio_chunk_start(mel_frame_idx)

    # the audio ended: the frames left in the buffer are the last ones of the session
    yield processor(
        audio[start_idx:],
        sampling_rate=sampling_rate,
        is_streaming=True,
        is_first_audio_chunk=False,
        is_last_audio_chunk=True,
    )


speaker_cache, logits = None, []
with torch.inference_mode():
    for inputs in inputs_generator():
        inputs = inputs.to(model.device, dtype=model.dtype)
        # `inputs` carries `num_lookahead_frames` for every chunk but the last, `speaker_cache` links the chunks
        outputs = model(**inputs, speaker_cache=speaker_cache)
        logits.append(outputs.logits)  # the chunk's frames, without its look-ahead
        speaker_cache = outputs.speaker_cache

logits = torch.cat(logits, dim=1)  # (1, num_frames, 8), one frame every 10 ms
segments = processor.extract_speaker_dict(logits)[0]  # [{"Start": 0.0, "End": 15.43, "Speaker": 0}, ...]
```
</details>

### Integration with Streaming ASR

Please refer to the [ASR Integration Guide](ASR_INTEGRATION_GUIDE.md) for the detailed instructions on integration of Nemotron Diarization with Streaming ASR.

---

## Model Architecture

**Architecture Type:** Transformer.

**Network Architecture:**

- A 31-layer Transformer encoder with Rotary Positional Embeddings (RoPE).
- 10 ms Mel-spectrogram input features downsampled by a factor of eight through feature stacking, producing an 80 ms encoder frame rate.
- A Conv1D layer above the encoder that upsamples predictions to the 10 ms input-feature resolution.
- AOSC and a FIFO queue for streaming inference.

**Number of model parameters:** 100M (1.0 × 10⁸).

## Input

**Input Type:** Audio.

**Input Format:** 16 kHz, single-channel audio in `.wav`, `.flac`, `.opus`, or `.mp3` format.

**Input Parameters:** One-dimensional, 16 kHz, single-channel audio waveform.

**Maximum Duration:** Not limited when chunked inference is used.

**Other Properties Related to Input:** Input audio must be sampled at 16 kHz and is converted into 10 ms Mel-spectrogram features. Chunked inference supports recordings without a fixed maximum duration.

## Output

**Output Type:** Other: Numerical tensor.

**Output Format:** Float Tensor.

**Output Parameters:** A two-dimensional tensor with shape `[T, 8]`, where `T` is the number of output frames and each value is a per-speaker activity probability in the range `[0, 1]`.

**Output Frame Resolution:** The default frame stride is 10 ms and can be configured to any multiple of 10 ms, such as 30 ms, 80 ms, or 240 ms.

**Speaker Ordering:** The eight speaker channels are ordered by the speakers' arrival time in the input audio.

**Derived Output:** Speaker activity probabilities can be converted into start time, end time, and a generic speaker label, for example `["speaker1", 0.51, 12.62]`.

**Other Properties Related to Output:** The output frame resolution is configurable in multiples of 10 ms. Speaker channels are ordered by first arrival, and probabilities can be postprocessed into generic speaker labels with start and end timestamps.

---

## Software Integration

**Runtime Engine(s):** NeMo Framework v3.0.

### Supported Hardware Microarchitecture Compatibility

Our AI models are designed and/or optimized to run on NVIDIA GPU-accelerated systems.

**Ampere NVIDIA GPUs:**

- GeForce RTX 3090 Ti, RTX 3090, RTX 3080 Ti, RTX 3080, RTX 3070 Ti, RTX 3070, RTX 3060 Ti, RTX 3060, and RTX 3050.
- NVIDIA RTX A6000, RTX A5500, RTX A5000, RTX A4500, RTX A4000, RTX A2000, RTX A1000, and RTX A400.
- NVIDIA A100 PCIe, A100 SXM, A30, A40, A16, A10, and A2.

**Ampere NVIDIA Workstations:** NVIDIA DGX Station A100.

**Ada Lovelace NVIDIA GPUs:**

- GeForce RTX 4090, RTX 4080, RTX 4070 Ti, RTX 4070, RTX 4060 Ti, RTX 4060, and RTX 4050.
- NVIDIA RTX 6000 Ada, RTX 5000 Ada, RTX 4500 Ada, RTX 4000 Ada, RTX 4000 SFF Ada, and RTX 2000 Ada.
- NVIDIA L4, L40, and L40S.

**Blackwell NVIDIA GPUs:**

- GeForce RTX 5090, RTX 5080, RTX 5070 Ti, RTX 5070, RTX 5060 Ti, RTX 5060, and RTX 5050.
- RTX PRO 6000 Blackwell Workstation Edition, RTX PRO 6000 Blackwell Max-Q Workstation Edition, RTX PRO 5000 Blackwell, RTX PRO 4500 Blackwell Workstation Edition, RTX PRO 4000 Blackwell, RTX PRO 4000 Blackwell SFF Edition, and RTX PRO 2000 Blackwell.
- RTX PRO 6000 Blackwell Server Edition and RTX PRO 4500 Blackwell Server Edition.
- NVIDIA B200, B300, GB200, and GB300.

**Blackwell NVIDIA Workstations:** NVIDIA DGX Spark and NVIDIA DGX Station.

**Hopper NVIDIA GPUs:** NVIDIA H100 PCIe, H100 SXM, H100 NVL, H200 SXM, H200 NVL, and GH200.

**Preferred/Supported Operating System(s):**
* Linux

The integration of foundation and fine-tuned models into AI systems requires additional testing using use-case-specific data to ensure safe and effective deployment. Following the V-model methodology, iterative testing and validation at both unit and system levels are essential to mitigate risks, meet technical and functional requirements, and ensure compliance with safety and ethical standards before deployment.

---

## Model Version

Nemotron 3 Diarization (General Access).

The model can be integrated into conversational AI systems through NeMo Framework inference pipelines to produce per-speaker activity probabilities or postprocessed generic speaker labels and timestamps.

## Training and Evaluation Datasets

### Training Datasets

The model was trained on a combination of real conversations and multi-talker audio mixtures with 1-8 speakers simulated using the [FastMSS](https://github.com/popcornell/FastMSS) toolkit [\[3\]](#ref-3).

**Real conversations:** Total duration is around 10,000 hours.

| Dataset                                           | Language                                 | Split or description                                 |
| ------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Fisher English                                    | English                                  | Training Part 1 and Part 2                           |
| AMI Meeting Corpus                                | English                                  | Train and development; force-aligned [\[4\]](#ref-4) |
| ICSI                                              | English                                  | Full                                                 |
| VoxConverse v0.3                                  | Multilingual                             | Development and test                                 |
| AISHELL-4                                         | Mandarin                                 | Train                                                |
| Third DIHARD Challenge                            | Multilingual                             | Development                                          |
| 2000 NIST Speaker Recognition Evaluation          | Multilingual                             | CALLHOME Part 1                                      |
| AliMeeting Mandarin Corpus                        | Mandarin                                 | Train; force-aligned [\[4\]](#ref-4)                 |
| DiPCo — Dinner Party Corpus                       | English                                  | Development                                          |
| NOTSOFAR1                                         | English                                  | Train and development; force-aligned [\[3\]](#ref-3) |
| DISPLACE 2024                                     | English, Hindi, Kannada, Telugu, Bengali | Development and evaluation                           |
| DISPLACE-M 2026                                   | Hindi, Kannada                           | Development 1, 2, and 3                              |
| David AI — [D2] Multispeaker                      | English                                  | Licensed under agreement; 3-4 speakers 1,000 hours   |
| YODAS-v2                                          | Multilingual                             | Pseudo-labeled 5,000-hour subset                     |

**Data used to simulate multi-talker audio mixtures:** Total duration of single-speaker audio recordings is around 28,000 hours.

| Dataset                                           | Language                                 | Split or description        |
| ------------------------------------------------- | ---------------------------------------- | --------------------------- |
| LibriSpeech                                       | English                                  | Train-960h                  |
| AMI Meeting Corpus (individual headsets)          | English                                  | Train and development       |
| AliMeeting Mandarin Corpus (individual headsets)  | Mandarin                                 | Train                       |
| Fisher English                                    | English                                  | Training Part 1 and Part 2  |
| David AI — [D1] Chit Chat                         | English                                  | Licensed under agreement    |
| David AI — [D2] Multispeaker                      | English                                  | Licensed under agreement    |
| David AI — [D6a] Podcast                          | English                                  | Licensed under agreement    |
| David AI — [D6b] Advice                           | English                                  | Licensed under agreement    |
| David AI — [D7] Expert Assistant                  | English                                  | Licensed under agreement    |
| David AI — [D12] Human Transcripts                | 21 languages                             | Licensed under agreement    |
| MUSAN noises                                      | Not applicable                           | Noises for augmentation     |

**Multi-talker audio mixtures used in training:**
* Librispeech: 6,694 hours
* AMI: 6,743 hours
* AliMeeting: 6,745 hours
* Fisher English: 6,755 hours
* David AI English: 36,458 hours
* David AI Multilingual: 19,216 hours

**Properties:** Approximately 10,000 hours of real conversations plus 82,611 hours of simulated multi-talker audio mixtures. The data modality is audio and includes conversational speech, telephone calls, meetings, podcasts, noise augmentation, and synthetic mixtures. Languages include English, Mandarin, Hindi, Kannada, Telugu, Bengali, and other languages represented in the multilingual sources. Voice recordings may constitute personal data.

### Evaluation Dataset

| Dataset              | Language     | Speakers | Recordings                                                  | Description                                   | Labels                           |
| -------------------- | ------------ | -------- | ----------------------------------------------------------- | --------------------------------------------- | -------------------------------- |
| DIHARD III Eval      | Multilingual | 1–9      | 1–4 speakers: 219<br>5–9 speakers: 40<br>**Total: 259**     | 11-domain benchmark                           | Original                         |
| CALLHOME-Part2       | Multilingual | 2–6      | 2: 148<br>3: 74<br>4: 20<br>5: 5<br>6: 3<br>**Total: 250**  | Telephonic speech                             | Original                         |
| AliMeeting Test Near | Mandarin     | 2–4      | 20                                                          | Meetings, mix of headset microphones          | [Forced alignment](https://github.com/nttcslab-sp/diar-forced-alignment) [\[4\]](#ref-4) |
| AliMeeting Test Far  | Mandarin     | 2–4      | 20                                                          | Meetings, far-field conditions                | [Forced alignment](https://github.com/nttcslab-sp/diar-forced-alignment) [\[4\]](#ref-4) |
| AMI Test MHM         | English      | 3–4      | 16                                                          | Meetings, mix of headset microphones          | [Forced alignment](https://github.com/nttcslab-sp/diar-forced-alignment) [\[4\]](#ref-4) |
| AMI Test SDM         | English      | 3–4      | 16                                                          | Meetings, far-field single-channel conditions | [Forced alignment](https://github.com/nttcslab-sp/diar-forced-alignment) [\[4\]](#ref-4) |
| NOTSOFAR1 Eval MHM   | English      | 3–7      | 3–4 speakers: 70<br>5–7 speakers: 90<br>**Total: 160**      | Meetings, mix of headset microphones          | [Forced alignment](https://github.com/popcornell/FastMSS/blob/master/resources/notsofar1-channels_mfa_rttms.tar.gz) [\[3\]](#ref-3) |
| NOTSOFAR1 Eval SC    | English      | 3–7      | 3–4 speakers: 70<br>5–7 speakers: 90<br>**Total: 160**      | Meetings, far-field single-channel conditions | [Forced alignment](https://github.com/popcornell/FastMSS/blob/master/resources/notsofar1-channels_mfa_rttms.tar.gz) [\[3\]](#ref-3) |

**Properties:** 901 condition-specific audio recordings comprising real-world multilingual conversational speech captured under telephone, meeting, near-field, far-field, and multi-microphone conditions. The data may contain personal data in the form of voice recordings. Languages include English, Mandarin, and other languages represented in the multilingual benchmarks.

---

## Training

The model training was initialized with a Transformer-based NEST [\[5\]](#ref-5) SSL checkpoint.
Training was performed on 8 nodes of 8×NVIDIA A100-SXM4-80GB GPUs in two stages.

1. Offline training on simulated data only using the [example script](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/neural_diarizer/sortformer_diar_train.py) and [base config](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/conf/neural_diarizer/sortformer_offline_8spk.yaml).
2. Streaming fine-tuning on a combination of real conversations and simulated mixtures using the [example script](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/neural_diarizer/streaming_sortformer_diar_train.py) and [base config](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/conf/neural_diarizer/sortformer_streaming_8spk.yaml).

## Performance Evaluation

> [!IMPORTANT]
>
> ### Use the published reference labels to reproduce these results!
>
> The DER scores reported in this model card were computed using the **exact reference annotations identified in the `Labels` column above**. Reference RTTMs are part of the evaluation protocol: changing the reference labels changes the measured result.
>
> We use forced-alignment based reference labels for **AMI**, **AliMeeting** and **NOTSOFAR1** because the original segment-level annotations were created primarily for transcription rather than frame-accurate diarization evaluation. These annotations may label substantial within-segment silence as speech, thereby overestimating reference speaker activity. When used for DER scoring, they can inflate missed-speech error by penalizing a diarization system for correctly predicting non-speech during those intervals. Forced alignment provides more precise speech boundaries and therefore a more appropriate and interpretable reference for frame-level diarization evaluation. Please refer to [\[4\]](#ref-4) for a detailed discussion of this annotation issue and the forced-alignment methodology.
>
> The `Forced alignment` links above point to the public repositories containing the reference RTTM files used for evaluation.
>
> Results obtained using different reference labels constitute a different evaluation protocol and are **not directly comparable** with the numbers reported here. Before reporting a reproduction discrepancy, score the same model outputs using the linked reference RTTMs, the listed dataset split, and the collar and overlap settings specified in the [Metrics](#metrics) section.


### Baseline

[nvidia/diar_streaming_sortformer_4spk-v2.1](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2.1)

**Baseline model's latency configurations:**

| **Configuration**           | **Latency** | `SPKCACHE_LEN` | `FIFO_LEN` | `CHUNK_LEN` | `RIGHT_CONTEXT` | `UPDATE_PERIOD` |
| --------------------------- | ----------- | -------------- | ---------- | ----------- | --------------- | --------------- |
| Very high latency (offline) | 30.4 s      | 188            | 40         | 340         | 40              | 300             |
| Low latency                 | 1.04 s      | 188            | 188        | 6           | 7               | 144             |
| Ultra-low latency           | 0.32 s      | 188            | 188        | 3           | 1               | 144             |

### Metrics

**Diarization Error Rate (DER):** The primary metric for diarization performance, consisting of false alarm (FA), missed speech (Miss), and speaker confusion (Conf).
* All evaluations include overlapping speech.  
* Collar tolerance is 0 s for DIHARD III Eval, AliMeeting Test, AMI Test and NOTSOFAR1 Eval.
* Collar tolerance is 0.25 s for CALLHOME-part2.

**Speaker Counting Accuracy (SCA):** `1` when the predicted and ground-truth speaker counts are equal; otherwise `0`. This metric does not capture the magnitude of a counting error.

**Speaker Counting Mean Absolute Error (MAE):** `|predicted speaker count - ground-truth speaker count|`. This metric is more informative than SCA because it reflects magnitude of speaker counting error.

**Real-Time Factor Speedup (RTFx):** `total audio duration / total processing time`.

### Performance Evaluation Results

Results reported below were obtained using the NeMo example script [e2e_diarize_speech.py](https://github.com/NVIDIA-NeMo/Speech/blob/main/examples/speaker_tasks/diarization/neural_diarizer/e2e_diarize_speech.py).

#### DIHARD III

| Model                                 | Latency | DER ↓<br>(1–4 spk) | DER ↓<br>(5–9 spk) | DER ↓<br>(full) | SCA ↑<br>(full) | MAE ↓<br>(full) |
| ------------------------------------- | ------- | ------------------ | ------------------ | --------------- | --------------- | --------------- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 13.98              | 40.21              | 19.09           | 75.29           | 0.5135          |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 14.33              | 41.39              | 19.60           | 69.50           | 0.5483          |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 14.37              | 42.71              | 19.85           | 66.80           | 0.5869          |
| `Nemotron-3-Diarization`              | 30.4 s  | **9.13**           | **27.58**          | **12.73**       | **81.47**       | **0.2664**      |
| `Nemotron-3-Diarization`              | 1.04 s  | **9.47**           | **28.65**          | **13.18**       | **76.83**       | **0.3243**      |
| `Nemotron-3-Diarization`              | 0.64 s  | **9.44**           | **29.16**          | **13.28**       | **77.22**       | **0.3205**      |
| `Nemotron-3-Diarization`              | 0.32 s  | **9.69**           | **29.49**          | **13.55**       | **76.45**       | **0.3282**      |

#### CALLHOME-Part2

| Model                                 | Latency | DER ↓<br>(2 spk) | DER ↓<br>(3 spk) | DER ↓<br>(4 spk) | DER ↓<br>(5 spk) | DER ↓<br>(6 spk) | DER ↓<br>(full) | SCA ↑<br>(full) | MAE ↓<br>(full) |
| ------------------------------------- | ------- | ---------------- | ---------------- | ---------------- | ---------------- | ---------------- | --------------- | --------------- | --------------- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 5.68             | 10.41            | 12.36            | 21.00            | 21.15            | 10.32           | 84.40           | 0.1720          |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 6.83             | 11.26            | 13.49            | 21.67            | 23.82            | 11.31           | 82.40           | 0.1880          |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 7.92             | 12.54            | 15.32            | 24.01            | 27.70            | 12.67           | 72.40           | 0.2920          |
| `Nemotron-3-Diarization`              | 30.4 s  | **5.98**         | **9.26**         | **11.03**        | **15.82**        | **15.80**        | **9.10**        | **91.60**       | **0.0840**      |
| `Nemotron-3-Diarization`              | 1.04 s  | **6.98**         | **10.90**        | **11.84**        | **18.47**        | **16.01**        | **10.29**       | **89.20**       | **0.1080**      |
| `Nemotron-3-Diarization`              | 0.64 s  | **7.21**         | **11.17**        | **12.10**        | **19.31**        | **16.70**        | **10.66**       | **88.40**       | **0.1160**      |
| `Nemotron-3-Diarization`              | 0.32 s  | **7.75**         | **11.84**        | **13.02**        | **20.65**        | **17.30**        | **11.32**       | **88.40**       | **0.1160**      |

#### AliMeeting Test Near

| Model                                 | Latency | DER ↓ | SCA ↑ | MAE ↓ |
| ------------------------------------- | ------- | ----- | ----- | ----- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 11.57 | 80.00 | 0.20  |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 12.47 | 70.00 | 0.30  |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 13.68 | 70.00 | 0.30  |
| `Nemotron-3-Diarization`              | 30.4 s  | **6.40** | **90.00** | **0.10** |
| `Nemotron-3-Diarization`              | 1.04 s  | **6.59** | **85.00** | **0.15** |
| `Nemotron-3-Diarization`              | 0.64 s  | **6.74** | **85.00** | **0.15** |
| `Nemotron-3-Diarization`              | 0.32 s  | **7.19** | **80.00** | **0.20** |

#### AliMeeting Test Far

| Model                                 | Latency | DER ↓ | SCA ↑ | MAE ↓ |
| ------------------------------------- | ------- | ----- | ----- | ----- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 13.69 | 95.00 | 0.05  |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 15.58 | 75.00 | 0.25  |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 16.85 | 65.00 | 0.35  |
| `Nemotron-3-Diarization`              | 30.4 s  | **10.47** | **100** | **0** |
| `Nemotron-3-Diarization`              | 1.04 s  | **10.80** | **95.00** | **0.05** |
| `Nemotron-3-Diarization`              | 0.64 s  | **11.03** | **85.00** | **0.15** |
| `Nemotron-3-Diarization`              | 0.32 s  | **11.60** | **85.00** | **0.15** |

#### AMI Test MHM

| Model                                 | Latency | DER ↓ | SCA ↑ | MAE ↓  |
| ------------------------------------- | ------- | ----- | ----- | ------ |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 15.81 | 93.75 | 0.0625 |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 16.36 | 93.75 | 0.0625 |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 17.77 | 93.75 | 0.0625 |
| `Nemotron-3-Diarization`              | 30.4 s  | **9.25** | **87.50** | **0.1250** |
| `Nemotron-3-Diarization`              | 1.04 s  | **9.48** | **81.25** | **0.1875** |
| `Nemotron-3-Diarization`              | 0.64 s  | **9.62** | **81.25** | **0.1875** |
| `Nemotron-3-Diarization`              | 0.32 s  | **10.05** | **81.25** | **0.1875** |

#### AMI Test SDM

| Model                                 | Latency | DER ↓ | SCA ↑ | MAE ↓  |
| ------------------------------------- | ------- | ----- | ----- | ------ |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 21.42 | 93.75 | 0.0625 |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 21.73 | 93.75 | 0.0625 |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 23.89 | 93.75 | 0.0625 |
| `Nemotron-3-Diarization`              | 30.4 s  | **11.14** | **87.50** | **0.1250** |
| `Nemotron-3-Diarization`              | 1.04 s  | **12.80** | **87.50** | **0.1250** |
| `Nemotron-3-Diarization`              | 0.64 s  | **13.06** | **87.50** | **0.1250** |
| `Nemotron-3-Diarization`              | 0.32 s  | **12.95** | **87.50** | **0.1250** |

#### NOTSOFAR1 MHM

| Model                                 | Latency | DER ↓<br>(3–4 spk) | DER ↓<br>(5–7 spk) | DER ↓<br>(full) | SCA ↑<br>(full) | MAE ↓<br>(full) |
| ------------------------------------- | ------- | ------------------ | ------------------ | --------------- | --------------- | --------------- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 11.14              | 29.38              | 21.77           | 35.00           | 0.9375          |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 12.03              | 29.49              | 22.12           | 34.38           | 0.9437          |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 12.94              | 30.75              | 23.37           | 32.50           | 0.9625          |
| `Nemotron-3-Diarization`              | 30.4 s  | **5.25**           | **7.86**           | **6.77**        | **93.75**       | **0.0625**      |
| `Nemotron-3-Diarization`              | 1.04 s  | **5.85**           | **9.02**           | **7.70**        | **79.37**       | **0.2062**      |
| `Nemotron-3-Diarization`              | 0.64 s  | **6.07**           | **9.39**           | **7.99**        | **79.37**       | **0.2062**      |
| `Nemotron-3-Diarization`              | 0.32 s  | **6.57**           | **10.16**          | **8.65**        | **74.38**       | **0.2687**      |

#### NOTSOFAR1 SC

| Model                                 | Latency | DER ↓<br>(3–4 spk) | DER ↓<br>(5–7 spk) | DER ↓<br>(full) | SCA ↑<br>(full) | MAE ↓<br>(full) |
| ------------------------------------- | ------- | ------------------ | ------------------ | --------------- | --------------- | --------------- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 19.67              | 38.42              | 30.49           | 33.12           | 0.9563          |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 20.58              | 39.84              | 31.81           | 33.12           | 0.9563          |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 22.14              | 40.80              | 32.95           | 31.87           | 0.9688          |
| `Nemotron-3-Diarization`              | 30.4 s  | **7.94**           | **13.21**          | **11.00**       | **78.12**       | **0.2188**      |
| `Nemotron-3-Diarization`              | 1.04 s  | **8.96**           | **15.44**          | **12.77**       | **60.62**       | **0.4062**      |
| `Nemotron-3-Diarization`              | 0.64 s  | **9.47**           | **16.16**          | **13.35**       | **55.00**       | **0.4625**      |
| `Nemotron-3-Diarization`              | 0.32 s  | **10.28**          | **17.61**          | **14.53**       | **55.00**       | **0.4625**      |

### Inference Speed Evaluation

| Model                                 | Latency | RTFx ↑ (`batch_size=1`) eager / compiled | RTFx ↑ (`batch_size=32`) eager / compiled |
| ------------------------------------- | ------- | ---------------------------------------- | ----------------------------------------- |
| `diar_streaming_sortformer_4spk-v2.1` | 30.4 s  | 874 / 1468                               | 3204 / 2619                               |
| `diar_streaming_sortformer_4spk-v2.1` | 1.04 s  | 16 / 42                                  | 193 / 136                                 |
| `diar_streaming_sortformer_4spk-v2.1` | 0.32 s  | 8  / 21                                  | 101 / 76                                  |
| `Nemotron-3-Diarization`              | 30.4 s  | **1340 / 4385**                          | **12196 / 15113**                         |
| `Nemotron-3-Diarization`              | 1.04 s  | **38 / 164**                             | **581 / 865**                             |
| `Nemotron-3-Diarization`              | 0.64 s  | **25 / 113**                             | **391 / 579**                             |
| `Nemotron-3-Diarization`              | 0.32 s  | **12.5 / 54**                            | **199 / 292**                             |

**Acceleration Engine:** PyTorch backend through the NeMo Framework, with and without `torch.compile()`.

**Test Hardware:** NVIDIA Blackwell RTX PRO 5000.

**Precision:** BF16.

---

## License/Terms of Use

Use of this model is governed by the [OpenMDW License Agreement, version 1.1](https://openmdw.ai/license/1-1/).

## Deployment Geography

Global

## Use Case

Nemotron 3 Diarization is intended for speaker diarization in live or recorded conversational audio, including meetings, calls, podcasts, and speech-recognition pipelines that need generic speaker labels and speaker timestamps.

## References

<a id="ref-1"></a>[1] [Sortformer: A Novel Approach for Permutation-Resolved Speaker Supervision in Speech-to-Text Systems](https://arxiv.org/abs/2409.06656)

<a id="ref-2"></a>[2] [Streaming Sortformer: Speaker Cache-Based Online Speaker Diarization with Arrival-Time Ordering](https://arxiv.org/abs/2507.18446)

<a id="ref-3"></a>[3] [Mind the Gap: Impact of Synthetic Conversational Data on Multi-Talker ASR and Speaker Diarization](https://arxiv.org/abs/2605.15442)

<a id="ref-4"></a>[4] [Can We Really Repurpose Multi-Speaker ASR Corpus for Speaker Diarization?](https://arxiv.org/abs/2507.09226)

<a id="ref-5"></a>[5] [NEST: Self-supervised Fast Conformer as All-purpose Seasoning to Speech Processing Tasks](https://arxiv.org/abs/2408.13106)

---

## Ethical Considerations

NVIDIA believes Trustworthy AI is a shared responsibility and has established policies and practices to enable development for a wide array of AI applications. Developers should evaluate the model with use-case-specific data and ensure that the complete system meets the requirements of the relevant industry and deployment context.

For more detailed information, see the [Bias](bias.md), [Explainability](explainability.md), [Safety & Security](safety.md), and [Privacy](privacy.md) subcards.

Please report model quality, risk, security vulnerabilities, or NVIDIA AI concerns through the [NVIDIA security reporting portal](https://www.nvidia.com/en-us/support/submit-security-vulnerability/).