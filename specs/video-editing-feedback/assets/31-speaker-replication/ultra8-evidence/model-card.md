---
language: en
license: apache-2.0
base_model: nvidia/diar_streaming_sortformer_4spk-v2.1
tags:
  - speaker-diarization
  - diarization
  - speech
  - nemo
  - sortformer
  - streaming
  - multilingual
---

# Ultra Diar Streaming Sortformer (8-Speaker)

This model extends **NVIDIA Streaming Sortformer** speaker diarization from **4 speakers to 8 speakers**. The original [diar_streaming_sortformer_4spk-v2.1](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2.1) supports up to 4 speakers; this model expands the capability to handle up to 8 speakers through fine-tuning and architectural modifications.

## Model Details

- **Base model**: [nvidia/diar_streaming_sortformer_4spk-v2.1](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2.1)
- **Extension**: 4spk → 8spk
- **Framework**: NeMo (NVIDIA)
- **Version**: 1.0
- **GitHub**: [github.com/LilDevsy0117/Ultra-Sortformer](https://github.com/LilDevsy0117/Ultra-Sortformer)

## Code & Training

Extension scripts, NeMo patches for split-head / split-LR training, synthetic data tooling, and documentation: **[Ultra-Sortformer (GitHub)](https://github.com/LilDevsy0117/Ultra-Sortformer)**.

### Training

- **Hardware**: 2× NVIDIA H100 GPUs

## Usage

This model requires the **NVIDIA NeMo toolkit** to train, fine-tune, or perform diarization. Install NeMo after installing Cython and the latest PyTorch.

### Install NeMo

```bash
apt-get update && apt-get install -y libsndfile1 ffmpeg
pip install Cython packaging
pip install git+https://github.com/NVIDIA/NeMo.git@main#egg=nemo_toolkit[asr]
```

### Quick Start: Run Diarization

```python
from nemo.collections.asr.models import SortformerEncLabelModel

# Load model from Hugging Face
diar_model = SortformerEncLabelModel.from_pretrained("devsy0117/ultra_diar_streaming_sortformer_8spk_v1")
diar_model.eval()

# Streaming parameters (recommended for best performance)
diar_model.sortformer_modules.chunk_len = 340
diar_model.sortformer_modules.chunk_right_context = 40
diar_model.sortformer_modules.fifo_len = 40
diar_model.sortformer_modules.spkcache_update_period = 300

# Run diarization
predicted_segments = diar_model.diarize(audio=["/path/to/your/audio.wav"], batch_size=1)

for segment in predicted_segments[0]:
    print(segment)
```

### Loading the Model

```python
from nemo.collections.asr.models import SortformerEncLabelModel

# Option 1: Load directly from Hugging Face
diar_model = SortformerEncLabelModel.from_pretrained("devsy0117/ultra_diar_streaming_sortformer_8spk_v1")

# Option 2: Load from a downloaded .nemo file
diar_model = SortformerEncLabelModel.restore_from(
    restore_path="/path/to/ultra_diar_streaming_sortformer_8spk_v1.nemo",
    map_location="cuda",
    strict=False,
)

diar_model.eval()
```

### Input Format

- Single audio file: `audio_input="/path/to/multispeaker_audio.wav"`
- Multiple files: `audio_input=["/path/to/audio1.wav", "/path/to/audio2.wav"]`

> **Note**: The base model is limited to 4 speakers. Extending to 8 speakers changes speaker-count behavior on short or low-speaker sessions; interpret `Spk_Count_Acc` together with DER. This release prioritizes strong DER on challenging multi-speaker settings.

## License

This repository’s model weights and documentation are released under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

The upstream base model may be subject to separate terms; see [nvidia/diar_streaming_sortformer_4spk-v2.1](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2.1) for its license and attribution requirements.
