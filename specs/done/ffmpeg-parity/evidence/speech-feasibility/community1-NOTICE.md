# Attribution and license scope

This is a mixed-license-scope repository. Fluid Inference intends the included
CC-BY-4.0 license text to cover only the following exact Community-1-derived
artifacts and their uncompiled counterparts listed in `provenance.json`:

- `Segmentation.mlmodelc`
- `FBank.mlmodelc`
- `Embedding.mlmodelc`
- `PLDA.mlmodelc`
- `PldaRho.mlmodelc`
- `plda-parameters.json`
- `xvector-transform.json`

The underlying Community-1 pipeline is published by pyannote under CC-BY-4.0:
https://huggingface.co/pyannote/speaker-diarization-community-1

The PLDA parameters originate from Brno University of Technology / BUT
Speech@FIT. The rights holder explicitly licenses `plda.npz` and
`xvec_transform.npz` under CC-BY-4.0, including commercial use:
https://huggingface.co/BUT-FIT/diarizen-wavlm-large-s80-md/blob/6285693ddd5b38e8229acb93f864f3d04a82bee1/plda/LICENSE

Fluid Inference converted the PyTorch components to Core ML, introduced fixed
and enumerated input shapes, applied mixed-precision storage where recorded in
the model metadata, separated the FBank frontend from the embedding backend,
and compiled packages for Apple platforms.

Appropriate attribution should identify pyannote, WeSpeaker, BUT Speech@FIT,
and Fluid Inference, retain the citations in README.md, link CC-BY-4.0, and
indicate that the files are modified Core ML conversions.

## Legacy exclusions

`pyannote_segmentation.mlmodelc`, `wespeaker.mlmodelc`,
`wespeaker_v2.mlmodelc`, `wespeaker_int8.mlmodelc`, and their packages predate
the supported Community-1 artifact set. They are retained for compatibility but
are not covered by this Community-1 provenance and license-scope confirmation.
Their original source and licensing must be evaluated separately.

Fluid Inference can grant rights only to the extent it is authorized to do so.
This notice does not restrict or replace rights granted directly by upstream
licensors.
