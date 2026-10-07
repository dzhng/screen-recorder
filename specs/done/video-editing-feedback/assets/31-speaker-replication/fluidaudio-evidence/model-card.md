---
license: other
license_name: scoped-cc-by-4.0
license_link: https://huggingface.co/FluidInference/speaker-diarization-coreml/blob/main/NOTICE.md
tags:
- speech
- audio
- voice
- speaker-diarization
- speaker-change-detection
- coreml
- speaker-segmentation
base_model:
- pyannote/speaker-diarization-community-1
pipeline_tag: voice-activity-detection
---

# Speaker Diarization Core ML

Core ML conversions used by
[FluidAudio](https://github.com/FluidInference/FluidAudio) for on-device speaker
diarization on Apple platforms.

The supported Community-1 artifact set is distributed under CC-BY-4.0. See
[NOTICE.md](NOTICE.md) for attribution and the precise license scope, and
[PROVENANCE.md](PROVENANCE.md) plus [provenance.json](provenance.json) for
source, conversion, environment, and file-integrity records.

## Supported Community-1 artifacts

| Artifact | Source |
| --- | --- |
| `Segmentation.mlmodelc` | `pyannote/speaker-diarization-community-1/segmentation/pytorch_model.bin` |
| `FBank.mlmodelc` | Deterministic feature-extraction graph configured from the embedding checkpoint |
| `Embedding.mlmodelc` | `pyannote/speaker-diarization-community-1/embedding/pytorch_model.bin` |
| `PLDA.mlmodelc`, `PldaRho.mlmodelc` | `plda/plda.npz` and `plda/xvec_transform.npz` |
| `plda-parameters.json`, `xvector-transform.json` | Serialized tensors from the same two PLDA files |

The snapshot includes uncompiled packages for `Segmentation`, `FBank`,
`Embedding`, and `PldaRho` under `mlpackages/`; no uncompiled `PLDA` package was
published. These are Core ML conversions, not fine-tuned models.

## Provenance status

The artifacts are pinned by SHA-256 in `provenance.json`. Their historical
source lineage has been reconstructed from the public Community-1 repository,
artifact metadata, and the published conversion source. The exact local
upstream checkout and Mobius commit used for the original 2025 conversion were
not recorded, so the existing binaries are not described as a fully attested
reproducible build.

The immutable upstream reference used for reconstruction is
[`pyannote/speaker-diarization-community-1@3533c8cf`](https://huggingface.co/pyannote/speaker-diarization-community-1/tree/3533c8cf8e369892e6b79ff1bf80f7b0286a54ee).
The public historical conversion reference is
[`FluidInference/mobius@33fd6eab`](https://github.com/FluidInference/mobius/tree/33fd6eab634966ae7db4d73da3376a90379642fb/models/speaker-diarization/pyannote-community-1/coreml).

The current conversion pipeline requires a full upstream commit SHA, records
input and output hashes, embeds source metadata in each model, and captures the
build environment. It is available at
[`FluidInference/mobius@ffbc3c8`](https://github.com/FluidInference/mobius/tree/ffbc3c8cae2d0ac83912a005a25a2874ced98a3a/models/speaker-diarization/pyannote-community-1/coreml).

## Legacy compatibility artifacts

The repository also retains `pyannote_segmentation.mlmodelc`,
`wespeaker.mlmodelc`, `wespeaker_v2.mlmodelc`, and `wespeaker_int8.mlmodelc`
for FluidAudio's legacy online diarizer. They predate the Community-1 export,
record a different toolchain, and are not included in the Community-1
provenance or license-scope confirmation in `NOTICE.md`.

## Technical specifications

- Input: 16 kHz mono audio
- Output: speaker segments with timestamps and speaker identifiers
- Framework: Core ML converted from PyTorch
- Deployment target: iOS 17 / macOS 14 or later
- Community-1 conversion metadata: PyTorch 2.8.0, coremltools 9.0b1,
  TorchScript source dialect
- Compiled MIL metadata: coremlc 3500.32.1, MIL 3500.14.1

## Usage

See the [FluidAudio diarization documentation](https://github.com/FluidInference/FluidAudio/tree/main/Documentation/Diarization).

## Citations

### Speaker segmentation

```bibtex
@inproceedings{Plaquet23,
  author={Alexis Plaquet and Hervé Bredin},
  title={{Powerset multi-class cross entropy loss for neural speaker diarization}},
  year=2023,
  booktitle={Proc. INTERSPEECH 2023},
}
```

### Speaker embedding

```bibtex
@inproceedings{Wang2023,
  title={Wespeaker: A research and production oriented speaker embedding learning toolkit},
  author={Wang, Hongji and Liang, Chengdong and Wang, Shuai and Chen, Zhengyang and Zhang, Binbin and Xiang, Xu and Deng, Yanlei and Qian, Yanmin},
  booktitle={ICASSP 2023, IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)},
  pages={1--5},
  year={2023},
  organization={IEEE}
}
```

### Speaker clustering

```bibtex
@article{Landini2022,
  author={Landini, Federico and Profant, J{\'a}n and Diez, Mireia and Burget, Luk{\'a}{\v{s}}},
  title={{Bayesian HMM clustering of x-vector sequences (VBx) in speaker diarization: theory, implementation and analysis on standard tasks}},
  year={2022},
  journal={Computer Speech & Language},
}
```
